// popup.js
// DEV: zet hier een placeholder. NIET in productie in de client.
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
const MODEL = "gemini-1.5-pro"; // pas aan indien nodig

// CONFIG
const MAX_CHUNK_CHARS = 15000; // grove limiet om tokenlimits te vermijden
const CHUNK_SUMMARY_PROMPT = (content) => `Summarize the following webpage fragment concisely:\n\n${content}`;
const FINAL_SUMMARY_PROMPT = (summaries) => `Combine and refine these summaries into a single clear and concise summary:\n\n${summaries.join("\n\n---\n\n")}`;
const QA_PROMPT = (content, question) => `Answer the following question based on the webpage content.\n\nPage content:\n${content}\n\nQuestion:\n${question}`;

// Kleine helper: timeout wrapper voor fetch
async function fetchWithTimeout(resource, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return resp;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Central call to Gemini (or proxy). For production switch URL to your server proxy.
async function callGemini(prompt, { maxOutputTokens = 800, temperature = 0.1 } = {}) {
  // In prod point to your own server endpoint that stores the real key.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [
      { parts: [{ text: prompt }] }
    ],
    // Optional generationConfig depending on API support/version
    // generationConfig: { temperature, maxOutputTokens }
  };

  const resp = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, 20000);

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`API fout ${resp.status} ${resp.statusText} ${txt}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Geen antwoord van model.");
  return text.trim();
}

// Splits lange tekst in chunks op paragrafen zonder woorden te breken.
function chunkText(text, maxChars = MAX_CHUNK_CHARS) {
  if (!text) return [];
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n{2,}/);
  const chunks = [];
  let current = "";

  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length <= maxChars) {
      current = current ? current + "\n\n" + p : p;
    } else {
      if (current) chunks.push(current);
      if (p.length > maxChars) {
        // fallback: harde split als een enkele paragraaf te groot is
        for (let i = 0; i < p.length; i += maxChars) {
          chunks.push(p.slice(i, i + maxChars));
        }
        current = "";
      } else {
        current = p;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// Retrieve page text using scripting.executeScript wrapped in a Promise
function getActiveTabPageText() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) return reject(new Error("Geen actieve tab."));
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          // prefer main, else body. remove scripts/styles.
          function visibleText(root) {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
              acceptNode(node) {
                if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                // skip script/style
                if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(node.parentElement?.tagName)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
              }
            });
            let out = "";
            while (walker.nextNode()) {
              out += walker.currentNode.nodeValue + "\n";
            }
            return out;
          }
          const main = document.querySelector("main");
          const root = main || document.body;
          return visibleText(root);
        }
      }, (results) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        const r = results?.[0]?.result;
        if (!r) return reject(new Error("Lege paginatekst."));
        resolve(r);
      });
    });
  });
}

// Summarize function with chunking and final merge
async function summarizePageContent(content) {
  const chunks = chunkText(content);
  if (chunks.length === 0) return "Pagina bevat geen tekst.";

  // If single chunk, request directly
  if (chunks.length === 1) {
    return await callGemini(CHUNK_SUMMARY_PROMPT(chunks[0]));
  }

  // Otherwise summarize each chunk sequentially then merge
  const partials = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      const s = await callGemini(CHUNK_SUMMARY_PROMPT(chunks[i]));
      partials.push(`Chunk ${i+1} summary:\n${s}`);
    } catch (err) {
      // fallback: include truncated chunk when a chunk fails
      partials.push(`Chunk ${i+1} failed to summarize. Fallback excerpt:\n${chunks[i].slice(0, 800)}`);
    }
    // small delay to reduce burst risk
    await new Promise(res => setTimeout(res, 300));
  }

  // Final combined summary
  return await callGemini(FINAL_SUMMARY_PROMPT(partials));
}

async function askQuestionAboutPage(content, question) {
  // If content too large, reduce to first N chars for QA context or create short summary
  const context = content.length > MAX_CHUNK_CHARS
    ? await callGemini(CHUNK_SUMMARY_PROMPT(content.slice(0, MAX_CHUNK_CHARS)))
    : content;
  return await callGemini(QA_PROMPT(context, question));
}

/* UI wiring */
document.addEventListener("DOMContentLoaded", () => {
  const summarizeBtn = document.getElementById("summarizeBtn");
  const askBtn = document.getElementById("askBtn");
  const questionInput = document.getElementById("questionInput");
  const output = document.getElementById("output");

  function setBusy(isBusy, message) {
    summarizeBtn.disabled = isBusy;
    askBtn.disabled = isBusy;
    output.textContent = message || (isBusy ? "Verwerken..." : "");
  }

  summarizeBtn.addEventListener("click", async () => {
    setBusy(true, "Pagina ophalen...");
    try {
      const pageText = await getActiveTabPageText();
      setBusy(true, "Samenvatting wordt gegenereerd...");
      const summary = await summarizePageContent(pageText);
      output.textContent = summary;
    } catch (err) {
      console.error(err);
      output.textContent = `Fout: ${err.message}`;
    } finally {
      setBusy(false);
    }
  });

  // Debounce ask button to avoid accidental double-clicks
  let lastAsk = 0;
  askBtn.addEventListener("click", async () => {
    const now = Date.now();
    if (now - lastAsk < 1000) return;
    lastAsk = now;

    const question = questionInput.value.trim();
    if (!question) {
      output.textContent = "Typ eerst een vraag.";
      return;
    }

    setBusy(true, `Vraag wordt verwerkt: "${question}"`);
    try {
      const pageText = await getActiveTabPageText();
      const answer = await askQuestionAboutPage(pageText, question);
      output.textContent = answer;
    } catch (err) {
      console.error(err);
      output.textContent = `Fout: ${err.message}`;
    } finally {
      setBusy(false);
    }
  });
});
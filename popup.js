async function summarizePageContent(content) {
  const apiKey = CONFIG.OPENAI_API_KEY;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: `This is raw text from a webpage. Please summarize the meaningful content clearly and concisely. Focus on the main ideas and useful information. Ignore timestamps, dates, comment counts, navigation menus, buttons, and unrelated UI elements:\n\n${content}`
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error("Error during summarization:", error);
    return "Er is een fout opgetreden bij het genereren van de samenvatting.";
  }
}


async function askQuestionAboutPage(content, question) {
  const apiKey = CONFIG.OPENAI_API_KEY;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You answer questions based on the given page content." },
        { role: "user", content: `Page content:\n\n${content}\n\nQuestion:\n${question}` }
      ],
      temperature: 0.7
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

document.addEventListener("DOMContentLoaded", () => {
  const summarizeBtn = document.getElementById("summarizeBtn");
  const askBtn = document.getElementById("askBtn");
  const questionInput = document.getElementById("questionInput");
  const output = document.getElementById("output");

  summarizeBtn.addEventListener("click", async () => {
    output.textContent = "Samenvatting wordt gegenereerd...";
    try {
  const summary = await summarizePageContent(pageText);
  output.textContent = summary;
} catch (error) {
  output.textContent = "Er ging iets mis bij het ophalen van de samenvatting.";
}
    
    // Later: hier komt de echte samenvatting via content.js + API
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
  const main = document.querySelector("main");
  return main ? main.innerText : document.body.innerText;
}
      }, async (results) => {
        const pageText = results[0].result;
        const summary = await summarizePageContent(pageText);
        output.textContent = summary;
      });
    });
  });

  askBtn.addEventListener("click", async () => {
    const question = questionInput.value.trim();
    if (!question) {
      output.textContent = "Typ eerst een vraag.";
      return;
    }

    output.textContent = `Vraag wordt verwerkt: "${question}"`;

    // Later: hier komt de echte vraagverwerking via Prompt API
  });
});

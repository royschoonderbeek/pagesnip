document.addEventListener('DOMContentLoaded', () => {
  const summarizeButton = document.getElementById('summarizeButton');
  const loadingText = document.getElementById('loadingText');
  const dots = document.getElementById('dots');
  let dotAnim;
  const loader = document.getElementById('loader');
  const output = document.getElementById('summaryOutput');
  const languageSelect = document.getElementById('languageSelect');
  const applyFiltering = true;

  summarizeButton.addEventListener('click', () => {
    summarizeButton.disabled = true;
    loader.style.display = 'block';
    output.style.display = 'none';
    requestAnimationFrame(() => startSummarizing());
  });

  function showLoadingText() {
  loadingText.style.display = 'inline';
  let count = 0;
  dotAnim = setInterval(() => {
    count = (count + 1) % 4; // 0–3 puntjes
    dots.textContent = '.'.repeat(count);
  }, 500); // halve seconde per update
}

function hideLoadingText() {
  clearInterval(dotAnim);
  loadingText.style.display = 'none';
  dots.textContent = '';
}

  function startSummarizing() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        doneWithError('No active tab found.');
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          func: (filter) => {
            try {
              let text = document.querySelector('article')?.innerText || document.querySelector('main')?.innerText || document.body?.innerText || '';
              if (!text) return '';

              if (filter) {
                let lines = text
                  .split('\n')
                  .filter(line => line.trim().split(' ').length > 3)
                  .filter(line => !line.match(/^(https?:\/\/|www\.|#|\S+@\S+)/i))
                  .filter(line => !line.match(/(login|sign up|cookie|advertisement|subscribe|privacy|settings)/i))
                  .filter(line => !line.match(/\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i));

                lines = [...new Set(lines)];
                text = lines.join('\n').replace(/\n\s*\n/g, '\n').trim();
                text = text.replace(/\s{2,}/g, ' ');
              }
              return text;
            } catch (err) {
              console.error('Error extracting text:', err);
              return '';
            }
          },
          args: [applyFiltering]
        },
        (results) => {
          if (!results || !results[0] || !results[0].result) {
            doneWithError('Failed to extract text from the active tab.');
            return;
          }

          const pageText = results[0].result;
          if (!pageText.trim()) {
            doneWithError('No text could be retrieved from the page.');
            return;
          }

          const paragraphs = pageText.split('\n').filter(p => p.length > 50);
          const limitedText = paragraphs.slice(0, 3).join('\n');
          const selectedLanguage = languageSelect.value;

          showLoadingText();

          chrome.runtime.sendMessage({
            action: 'summarize',
            limitedText,
            language: selectedLanguage
          }, response => {
            hideLoadingText();
            if (response?.error) {
              doneWithError(`Something went wrong: ${response.error}`);
              return;
            }
            output.value = response.summary || '';
            output.style.display = 'block';
            loader.style.display = 'none';
            summarizeButton.disabled = false;
          });
        }
      );
    });
  }

  function doneWithError(msg) {
    alert(msg);
    loader.style.display = 'none';
    summarizeButton.disabled = false;
  }

});








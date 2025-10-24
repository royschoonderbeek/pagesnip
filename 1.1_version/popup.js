document.addEventListener('DOMContentLoaded', () => {
  const loadingText = document.getElementById('loadingText');
  const dots = document.getElementById('dots');
  const loader = document.getElementById('loader');
  const output = document.getElementById('summaryOutput');
  const applyFiltering = true;
  let dotAnim;

  const showLoadingText = () => {
    loadingText.style.display = 'inline';
    let count = 0;
    dotAnim = setInterval(() => {
      count = (count + 1) % 4;
      dots.textContent = '.'.repeat(count);
    }, 500);
  };

  const hideLoadingText = () => {
    clearInterval(dotAnim);
    loadingText.style.display = 'none';
    dots.textContent = '';
  };

  const doneWithError = (msg) => {
    alert(msg);
    hideLoadingText();
    loader.style.display = 'none';
  };

  const extractPageText = (filter) => {
    try {
      let text =
        document.querySelector('article')?.innerText ||
        document.querySelector('main')?.innerText ||
        document.body?.innerText ||
        '';

      if (!text) return '';

      if (filter) {
        const lines = [...new Set(
          text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.split(' ').length > 3)
            .filter(line => !/^(https?:\/\/|www\.|#|\S+@\S+)/i.test(line))
            .filter(line => !/(login|sign up|cookie|advertisement|subscribe|privacy|settings)/i.test(line))
            .filter(line => !/\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(line))
        )];

        text = lines.join('\n').replace(/\n\s*\n/g, '\n').replace(/\s{2,}/g, ' ').trim();
      }

      return text;
    } catch (err) {
      console.error('extractPageText error:', err);
      return '';
    }
  };

  const startSummarizing = () => {
    loader.style.display = 'block';
    output.style.display = 'none';
    showLoadingText();

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (!tab) return doneWithError('No active tab found.');

      chrome.tabs.detectLanguage(tab.id, () => {
        chrome.scripting.executeScript(
          { target: { tabId: tab.id }, func: extractPageText, args: [applyFiltering] },
          (results) => {
            const pageText = results?.[0]?.result?.trim();
            if (!pageText) return doneWithError('No text could be retrieved from the page.');

            const paragraphs = pageText.split('\n').filter(p => p.length > 50);
            const limitedText = paragraphs.join('\n');

            chrome.runtime.sendMessage(
              { action: 'summarize', limitedText },
              (response) => {
                hideLoadingText();
                loader.style.display = 'none';
                if (response?.error) return doneWithError(response.error);
                output.value = response.summary || '';
                output.style.display = 'block';
              }
            );
          }
        );
      });
    });
  };

  requestAnimationFrame(startSummarizing);
  
});
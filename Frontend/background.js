chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'summarize') return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);

    const prompt = `
    Summarize the following text in the same language as the original.
    Write fluently and naturally.
    The summary should capture all key points, arguments, and context.
    Text:
    ${msg.limitedText}`;

  console.log('Sending prompt to server:', { selectedLanguage: msg.language, promptPreview: prompt.slice(0,200) });

  fetch('http://localhost:4000/api/prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    signal: controller.signal
  })
    .then(response => {
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (!data || !data.response) throw new Error('No summary returned by API');
      sendResponse({ summary: data.response });
    })
    .catch(error => {
      console.error('Background fetch error:', error);
      sendResponse({
        error: error.name === 'AbortError' ? 'Request timed out.' : error.message
      });
    });

  return true;
});



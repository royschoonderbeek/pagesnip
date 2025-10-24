chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'summarize') return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  const wordCount = msg.limitedText.trim().split(/\s+/).length;
  const targetWords = Math.min(Math.max(Math.round(wordCount * 0.1), 80), 500);
  
  const prompt = `
  Summarize the following text in the same language as the original.
  Write a fluent, concise, and well-structured summary.
  Focus on the main arguments, conclusions, and essential details only.
  Do not restate or rephrase the whole text.
  Keep the length proportional to the source and never exceed ${targetWords} words.
  
  Original text length: ${wordCount} words.
  
  Text:
  ${msg.limitedText}
  `;

  console.log('Sending prompt to server:', {
    language: msg.language,
    preview: prompt.slice(0, 200),
  });

  fetch('http://localhost:4000/api/prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    signal: controller.signal,
  })
    .then(async (response) => {
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      if (!data?.response) throw new Error('No summary returned by API');
      sendResponse({ summary: data.response });
    })
    .catch((error) => {
      console.error('Background fetch error:', error);
      sendResponse({ error: error.name === 'AbortError' ? 'Request timed out' : error.message });
    });

  return true; 
});



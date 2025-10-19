chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'summarize') return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const languageMap = {
    en: 'English',
    nl: 'Dutch',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese'
  };

  const selectedLanguageName = languageMap[msg.language] || 'English';

  const prompt = `You are a multilingual assistant. Always respond ONLY in ${selectedLanguageName}, no matter what language the input text is.
  Summarize the following text in ${selectedLanguageName}.
  The summary must be fluent, natural, and limited to 10 sentences.
  If the text is not in ${selectedLanguageName}, first understand it and then write the summary entirely in ${selectedLanguageName}.
  Text to summarize:
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



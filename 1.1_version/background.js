chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'summarize') return;

  (async () => {
    try {
      const text = String(msg.limitedText || '').trim();
      if (!text) throw new Error('No text provided');

      const wordCount = text.split(/\s+/).length;
      const targetWords = Math.min(Math.max(Math.round(wordCount * 0.1), 80), 500);

      const prompt = `
Summarize the following text in the same language as the original.
Write a brief summary only, not a restatement or explanation.
Focus on main ideas, core arguments, and conclusions.
Omit examples, quotes, and minor details.
Never exceed ${targetWords} words in total.

Original text length: ${wordCount} words.

Text:
${text}
`.trim();

      if (!('ai' in self) || !('summarizer' in self.ai)) {
        throw new Error('Chrome built-in Summarizer API not available in this browser');
      }

      const summarizer = await self.ai.summarizer.create();
      const summary = await summarizer.summarize(prompt);
      if (!summary) throw new Error('Empty summary');

      sendResponse({ summary });
    } catch (err) {
      console.error('Summarizer error:', err);
      sendResponse({ error: err.message || 'Summarization failed' });
    }
  })();

  return true;
});
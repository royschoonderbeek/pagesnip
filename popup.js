const GEMINI_API_KEY = "Your gemini api key"; // We still need a key to make everything work
const MODEL = "gemini-1.5-pro";
const MAX_CHUNK_CHARS = 15000;

/* Goal: Generate a summary of a fragment of a web page.
Usage: Send this prompt to Gemini to receive a concise summary of the retrieved content. */
function makeSummaryPrompt(content) {
    return `Summarize the following webpage fragment concisely:\n\n${content}`;
}

/* Goal: Combine multiple summaries into one clear summary.
Usage: Useful if you have split the page into sections and summarized each part separately. */
function makeFinalPrompt(summaries) {
    return `Combine and refine these summaries into a single clear and concise summary:\n\n${summaries.join("\n\n---\n\n")}`;
}

/* Goal: Ask a question about the content of a web page.
Usage: You can use this to ask Gemini questions such as “What is the main message of this page?” or “What does this text say about climate change?” */
function makeQuestionPrompt(content, question) {
  return `Answer the following question based on the webpage content.\n\nPage content:\n${content}\n\nQuestion:\n${question}`;
}

async function fetchWithTimeout(url, options = {}) {
  const { timeOut = 15000 } = options;
  // const { timeout = 15000 } = options extracts the timeout value in milliseconds from the options object, defaulting to 15 seconds.
  const controller = new AbortController();
  /* const controller = new AbortController() creates an instance of AbortController, 
  which allows you to cancel fetch() requests. A new controller must be created for each request. */
  const timer = setTimeout(() => controller.abort(), timeOut);
  /* const timer = setTimeout(() => controller.abort(), timeout) sets a timer (in this case, 15 seconds).
  If the request takes longer than that time, the timer says: “controller.abort()” → Stop that request! */
   const response = await fetch(url, {
    ...options,
    signal: controller.signal  
  });
  /* controller.signal is the connection between your stop button and your fetch request.
  It tells fetch: “If I press stop, you must stop.”
  Without that connection, fetch doesn’t know that a stop button exists. */
  clearTimeout(timer);
  return response;
  /* setTimeout(...) starts a timer that, after for example 15000 ms (15 seconds), says: “Stop the fetch request!”
  If the fetch request finishes earlier, you don’t want that timer to stop it anyway.
  That’s why you use clearTimeout(timer) to turn off the timer as soon as the request completes successfully. */


  /* Without one of those components...
  You have no stop button (without AbortController).
  Fetch can’t listen to that button (without signal).
  The button is never pressed (without setTimeout).
  The button might go off too late by accident (without clearTimeout). */
  
}
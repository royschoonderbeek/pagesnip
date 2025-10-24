import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) console.warn('Warning: GOOGLE_API_KEY is missing.');
console.log('Using model:', MODEL);

app.post('/api/prompts', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    console.log('Received prompt (preview):', prompt.slice(0, 300));
    const summary = await generateResponse(prompt);
    res.json({ response: summary });
  } catch (error) {
    console.error('Prompt processing failed:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

async function generateResponse(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4000 },
        }),
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const output =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') ||
      data?.error?.message ||
      'No response text';

    console.log('Gemini response OK.');
    return output.trim();
  } catch (error) {
    clearTimeout(timeout);
    console.error('generateResponse error:', error);
    throw error.name === 'AbortError' ? new Error('Request timed out') : error;
  }
}

app.listen(4000, () => console.log('Server running on port 4000'));








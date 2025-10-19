import 'dotenv/config';
import express from "express";
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
console.log('API KEY:', process.env.GOOGLE_API_KEY ? 'Loaded' : 'Missing');
console.log('Using model:', MODEL);

app.post('/api/prompts', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    console.log("Received prompt (preview):", prompt.slice(0, 300));

    const summary = await generateResponse(prompt);
    res.status(200).json({ response: summary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

async function generateResponse(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GOOGLE_API_KEY}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    console.log('Gemini response (preview):', JSON.stringify(data?.candidates?.[0] || {}, null, 2));

    const output = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("\n") ||
                   data?.error?.message ||
                   "No response text";

    return output;
    
  } catch (error) {
    clearTimeout(timeout);
    console.error('generateResponse error:', error);
    throw error;
  }
}

app.listen(4000, () => {
  console.log('SERVER RUNNING ON PORT:4000');
});








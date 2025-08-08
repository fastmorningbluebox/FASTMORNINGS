// Vercel Serverless Function
// Path: api/translate.js

import OpenAI from "openai";

// Use Vercel environment variables directly
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ALLOWED_DIRS = new Set([
  "EN>JA", "EN>ZH-TW", "JA>EN", "ZH-TW>EN", "JA>ZH-TW", "ZH-TW>JA"
]);

const SYSTEM_TEMPLATE = `You are a professional translator specialized in EN, JA, and zh-Hant (Traditional Chinese).
- Preserve emojis, line breaks, and playful formatting.
- Adapt tone to {TONE}: (Cute = kawaii, fluffy; Flirty = teasing, light spice; Sassy = playful attitude; Polite = soft and respectful).
- Keep messages short, natural, and chat-ready for DMs.
- If the source includes slang or teasing, mirror that energy appropriately in the target language.
- Never add content that changes meaning; do not remove emojis.
- When translating into Japanese: keep casual feminine kawaii speech if tone is Cute/Flirty.
- When translating into Traditional Chinese: keep chatty, sweet style used in Taiwan/HK; avoid Simplified forms.
- Return only the translated text.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  // Optional token lock using Vercel env var
  const requiredToken = process.env.TEAM_ACCESS_TOKEN;
  if (requiredToken) {
    const providedToken = req.headers['x-access-token'];
    if (!providedToken || providedToken !== requiredToken) {
      return res.status(401).send('Unauthorized');
    }
  }

  try {
    const { text, direction, tone } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).send('Missing text');
    }
    if (!ALLOWED_DIRS.has(direction)) {
      return res.status(400).send('Bad direction');
    }

    const [from, to] = direction.split('>');
    const systemPrompt = SYSTEM_TEMPLATE.replace('{TONE}', tone || 'Cute');
    const userPrompt = `Translate the following from ${from} to ${to} in the requested tone.\n\nSOURCE:\n${text}`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const translation = completion.choices?.[0]?.message?.content?.trim() || '';
    if (!translation) {
      return res.status(500).send('Empty response');
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ translation });
  } catch (err) {
    console.error(err);
    res.status(500).send(err?.message || 'Server error');
  }
}

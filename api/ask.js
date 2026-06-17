import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from './_auth.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Simple in-memory rate limit: max 20 requests per hospital per hour
const rateLimitMap = new Map();
function checkRateLimit(hospitalId) {
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const max = 20;
  const entry = rateLimitMap.get(hospitalId) || { count: 0, resetAt: now + window };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + window; }
  if (entry.count >= max) return false;
  entry.count++;
  rateLimitMap.set(hospitalId, entry);
  return true;
}

const SYSTEM_PROMPT = `You are an EMS outreach analytics assistant for Baylor Scott & White Medical Center. \
You help the outreach coordinator understand transport patterns, identify growth opportunities, and make data-driven decisions.

Your role is to:
- Analyze transport volume trends across cities and agencies in the DFW metroplex
- Identify cities or agencies with unusually high or low activity
- Suggest outreach strategies to improve relationships with EMS agencies
- Highlight month-over-month or year-over-year patterns
- Point out which counties or areas need more attention
- Be concise, practical, and grounded in the data provided

The user will provide current stats context in their first message. Respond conversationally but keep answers focused and actionable.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const hospitalId = await requireAuth(req, res);
  if (!hospitalId) return;

  if (!checkRateLimit(hospitalId)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in an hour.' });
  }

  const { question, context, history = [] } = req.body;
  if (!question) return res.status(400).json({ error: 'question required' });
  if (typeof question !== 'string' || question.length > 2000)
    return res.status(400).json({ error: 'question too long' });
  if (!Array.isArray(history) || history.length > 50)
    return res.status(400).json({ error: 'invalid history' });

  // Build multi-turn message array from conversation history
  const messages = history
    .filter(m => m.text?.trim())
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));

  // First message includes the data context; follow-ups are plain questions
  const isFirst = messages.length === 0;
  const currentContent = isFirst && context
    ? `${context}\n\nMy question: ${question}`
    : question;
  messages.push({ role: 'user', content: currentContent });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Ask API error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}

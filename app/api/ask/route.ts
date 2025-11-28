import { NextResponse } from 'next/server';

type Req = { text?: string; language?: string };

const SYSTEM_PROMPT = `You are an AI assistant. Detect the user's language automatically based on the user's message.
Always respond in the same language the user used.
Return only valid JSON, with TWO keys:
{
  "language": "<BCP-47 language code like 'hi' or 'mr-IN' or 'en'>",
  "answer": "<the assistant's reply in the user's language>"
}
Do not add any other text, explanation, or commentary outside the JSON object.
`;

export async function POST(req: Request) {
  try {
    const body: Req = await req.json().catch(() => ({}));
    const text = body.text;
    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    if (!OPENAI_API_KEY) return NextResponse.json({ error: 'Server missing OPENAI_API_KEY' }, { status: 500 });

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return NextResponse.json({ error: `OpenAI error: ${resp.status} ${txt}` }, { status: 500 });
    }

    const data = await resp.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: 'Invalid response from LLM' }, { status: 500 });

    // Try to parse JSON from model output
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = String(content).match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          // fall through
        }
      }
    }

    if (!parsed) {
      // As a fallback, return language as undefined and answer as raw content
      return NextResponse.json({ language: undefined, answer: String(content) });
    }

    const language = parsed.language || parsed.lang || undefined;
    const answer = parsed.answer || parsed.text || '';
    return NextResponse.json({ language, answer });
  } catch (err: any) {
    console.error('/api/ask error', err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}

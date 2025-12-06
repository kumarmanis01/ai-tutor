import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { logApiUsage } from '@/utils/logApiUsage';
import { getServerSessionForHandlers } from '@/lib/session';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  logApiUsage('/api/i18n/translate', 'POST');
  const { text, targetLang } = await req.json();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `Translate to ${targetLang}.` },
      { role: 'user', content: text },
    ],
  });
  return NextResponse.json({
    translated: completion.choices[0].message?.content,
  });
}

import { logger } from '@/lib/logger';
import { logApiUsage } from '@/utils/logApiUsage';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSessionForHandlers } from '@/lib/session';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    logApiUsage('/api/ai/voice', 'POST');
    const { text, voice } = await req.json();

    const mp3 = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: voice || 'alloy', // "alloy" | "verse" | "bright" etc.
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline; filename=voice.mp3',
      },
    });
  } catch (err) {
    logger.error('ai/voice route error', { className: 'api.ai.voice', methodName: 'POST', error: String(err) });
    return NextResponse.json({ error: 'voice_failed' }, { status: 500 });
  }
}

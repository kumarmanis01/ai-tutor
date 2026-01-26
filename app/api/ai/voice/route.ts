import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { logApiUsage } from '@/utils/logApiUsage';
import { NextResponse } from 'next/server';
import { createSpeech } from '@/lib/callLLM';
import { getServerSessionForHandlers } from '@/lib/session';

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    logApiUsage('/api/ai/voice', 'POST');
    const { text, voice } = await req.json();
    const mp3 = await createSpeech({
      model: 'gpt-4o-mini-tts',
      voice: voice || 'alloy',
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer())
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline; filename=voice.mp3',
      },
    });
  } catch (err) {
    logger.error('ai/voice route error', { className: 'api.ai.voice', methodName: 'POST', error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}

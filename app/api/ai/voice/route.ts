import { logApiUsage } from '@/utils/logApiUsage';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
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
    console.error(err);
    return NextResponse.json({ error: 'voice_failed' }, { status: 500 });
  }
}

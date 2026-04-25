import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { uploadBufferToR2 } from '@/lib/storage/r2';
import { logger } from '@/lib/logger';

/**
 * POST /api/student/whiteboard/save
 * Body: { sessionId: string, conceptName?: string, canvasDataUrl: string, aiSteps?: string[], visualHint?: string }
 *
 * Saves student whiteboard PNG + metadata to R2 and returns public URLs.
 * Minimal server-side persistence without DB migration (stores in R2).
 */
export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}) as any);
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
    const canvasDataUrl = typeof body.canvasDataUrl === 'string' ? body.canvasDataUrl : null;
    const conceptName = typeof body.conceptName === 'string' ? body.conceptName : null;
    const aiSteps = Array.isArray(body.aiSteps) ? body.aiSteps : undefined;
    const visualHint = typeof body.visualHint === 'string' ? body.visualHint : null;

    if (!sessionId) return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
    if (!canvasDataUrl || !canvasDataUrl.startsWith('data:')) {
      return NextResponse.json({ error: 'Missing canvasDataUrl' }, { status: 400 });
    }

    // Extract base64 payload
    const match = canvasDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    const contentType = match?.[1] ?? 'image/png';
    const base64 = match?.[2] ?? canvasDataUrl.split(',')[1] ?? '';
    const buffer = Buffer.from(base64, 'base64');

    const studentId = session.user.id;
    const ts = Date.now();
    const key = `whiteboards/${studentId}/${sessionId}/${ts}.png`;

    // Upload image
    const imageUrl = await uploadBufferToR2(buffer, key, contentType);

    // Compose metadata and upload 'latest' pointer
    const metadata = {
      studentId,
      sessionId,
      conceptName,
      aiSteps: aiSteps ?? null,
      visualHint: visualHint ?? null,
      imageUrl,
      createdAt: new Date().toISOString(),
    };
    const metaKey = `whiteboards/${studentId}/${sessionId}/latest.json`;
    const metadataUrl = await uploadBufferToR2(
      Buffer.from(JSON.stringify(metadata), 'utf8'),
      metaKey,
      'application/json'
    );

    return NextResponse.json({ imageUrl, metadataUrl });
  } catch (err) {
    logger.error('whiteboard.save.error', { error: String(err) });
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}

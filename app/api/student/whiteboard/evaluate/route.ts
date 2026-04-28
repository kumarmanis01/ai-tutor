import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { callTutorLLM } from '@/lib/callLLM';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const dynamic = 'force-dynamic';

const EVAL_TIMEOUT_MS = 8_000;

const FALLBACK_FEEDBACK =
  'Great effort putting your working down! Keep exploring this approach -- you are on the right track.';

async function uploadDataUrlToS3(dataUrl: string, keyPrefix: string): Promise<string | null> {
  try {
    const bucket = process.env.S3_BUCKET ?? process.env.NEXT_PUBLIC_S3_BUCKET ?? 'test-bucket';
    if (!bucket) return null;
    const match = String(dataUrl || '').match(/^data:(.+);base64,(.*)$/);
    if (!match) return null;
    const mime = match[1] || 'image/png';
    const base64 = match[2] || '';
    const buf = Buffer.from(base64, 'base64');
    const region = process.env.AWS_REGION ?? 'us-east-1';

    const client = new S3Client({
      region,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            }
          : undefined,
    });

    const key = `${keyPrefix}/${Date.now()}.png`;
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: buf, ContentType: mime });
    await client.send(cmd);

    // Best-effort public URL (may vary by bucket policy / region)
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  } catch (err) {
    try {
      logger.warn('whiteboard.upload.failed', { error: String(err) });
    } catch {}
    return null;
  }
}

/**
 * POST /api/student/whiteboard/evaluate
 * Body: { sessionId: string, conceptName: string, canvasDataUrl?: string }
 *
 * Evaluates student working drawn on the whiteboard.
 * Uses text-based evaluation (conceptName + session context) via callTutorLLM.
 * Returns { feedback: string } -- always a single encouraging sentence.
 *
 * AC-04: F-STU-014 Virtual Whiteboard.
 */
export async function POST(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const user = session?.user;

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { sessionId, conceptName } = body ?? {};

  // Optional canvas data URL (base64 PNG) that can be persisted for session replay.
  const canvasDataUrl =
    typeof (body as any)?.canvasDataUrl === 'string' ? (body as any).canvasDataUrl : undefined;

  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const name = typeof conceptName === 'string' && conceptName ? conceptName : 'this concept';

  const prompt = [
    `A student has submitted their working for "${name}".`,
    'Give a single short sentence (max 20 words) of encouraging, specific feedback.',
    'Acknowledge their effort, highlight one thing they are doing right, and give one gentle nudge toward the next step.',
    'Tone: warm, forward-looking. Never say "wrong", "incorrect", "failed", "missed".',
    'Output ONLY the sentence -- no preamble, no quotation marks.',
  ].join('\n');

  try {
    // Run evaluation LLM and attempt artifact persistence in parallel. Persistence
    // is best-effort and must not block returning feedback to the client.
    const llmPromise = callTutorLLM(
      prompt,
      { callType: 'tutor:eval', studentId: user.id, sessionId },
      EVAL_TIMEOUT_MS
    );

    let artifactUrl: string | null = null;
    let artifactRecordId: string | null = null;
    if (canvasDataUrl) {
      // fire-and-forget but await to include artifact URL when available
      try {
        artifactUrl = await uploadDataUrlToS3(
          canvasDataUrl,
          `whiteboards/${user.id}/${String(sessionId)}`
        );
      } catch (e) {
        try {
          logger.warn('whiteboard.artifact.upload_error', {
            studentId: user.id,
            sessionId,
            error: String(e),
          });
        } catch {}
        artifactUrl = null;
      }
    }

    // Persist artifact metadata to the DB (best-effort). Failure should not
    // block the main evaluation flow.
    if (artifactUrl) {
      try {
        const rec = await (prisma as any).sessionArtifact.create({
          data: {
            studentId: user.id,
            sessionId: sessionId ?? null,
            type: 'whiteboard',
            url: artifactUrl,
            meta: { source: 'whiteboard.evaluate' },
            uploadedBy: user.id,
          },
        });
        if (rec && rec.id) artifactRecordId = String(rec.id);
      } catch (e) {
        try {
          logger.warn('whiteboard.artifact.persist_error', {
            studentId: user.id,
            sessionId,
            error: String(e),
          });
        } catch {}
      }
    }

    const result = await llmPromise;
    const feedback = (result?.content ?? '').trim() || FALLBACK_FEEDBACK;
    logger.info('whiteboard.evaluated', { studentId: user.id, sessionId });
    const payload: any = { feedback };
    if (artifactUrl) payload.artifactUrl = artifactUrl;
    if (artifactRecordId) payload.artifactId = artifactRecordId;
    const res = NextResponse.json(payload);
    logger.logAPI(req, res, { className: 'WhiteboardEvaluateAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('WhiteboardEvaluateAPI.error', { userId: user.id, error: err });
    return NextResponse.json({ feedback: FALLBACK_FEEDBACK });
  }
}

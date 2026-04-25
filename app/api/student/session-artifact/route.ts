/**
 * F-STU-014 AC-06: Persist whiteboard state as a SessionArtifact for session replay.
 *
 * POST /api/student/session-artifact
 *   Body: { sessionId: string, type: string, dataUrl: string }
 *   Creates a SessionArtifact row with type='whiteboard' and the canvas data URL.
 *
 * Production note: dataUrl should be uploaded to Cloudflare R2 and the public
 * URL stored here. Storing the raw data URL in Postgres is acceptable for this
 * sprint but should be migrated to R2 before launch.
 *
 * EDIT LOG:
 * - 2026-04-14 | claude | created for F-STU-014 AC-06
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const ALLOWED_TYPES = ['whiteboard'] as const;
type ArtifactType = (typeof ALLOWED_TYPES)[number];

// 5 MB safety cap for data URL length (base64 PNG of a 600x400 canvas is ~300KB)
const MAX_DATA_URL_LENGTH = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'SessionArtifactAPI', methodName: 'POST' }, start);
    return res;
  }

  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : null;
  const type = typeof body.type === 'string' ? (body.type.trim() as ArtifactType) : null;
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : null;

  if (!type || !ALLOWED_TYPES.includes(type)) {
    const res = NextResponse.json(
      { error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` },
      { status: 400 }
    );
    logger.logAPI(req, res, { className: 'SessionArtifactAPI', methodName: 'POST' }, start);
    return res;
  }

  if (!dataUrl || !dataUrl.startsWith('data:')) {
    const res = NextResponse.json(
      { error: 'dataUrl is required and must be a data URL' },
      { status: 400 }
    );
    logger.logAPI(req, res, { className: 'SessionArtifactAPI', methodName: 'POST' }, start);
    return res;
  }

  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    const res = NextResponse.json({ error: 'dataUrl exceeds size limit' }, { status: 413 });
    logger.logAPI(req, res, { className: 'SessionArtifactAPI', methodName: 'POST' }, start);
    return res;
  }

  // If sessionId provided, verify it belongs to this student
  if (sessionId) {
    const sess = await prisma.structuredSession.findFirst({
      where: { id: sessionId, studentId: userId },
      select: { id: true },
    });
    if (!sess) {
      const res = NextResponse.json({ error: 'Session not found' }, { status: 404 });
      logger.logAPI(req, res, { className: 'SessionArtifactAPI', methodName: 'POST' }, start);
      return res;
    }
  }

  const artifact = await prisma.sessionArtifact.create({
    data: {
      studentId: userId,
      sessionId: sessionId ?? undefined,
      type,
      url: dataUrl,
      uploadedBy: userId,
    },
    select: { id: true, type: true, sessionId: true, createdAt: true },
  });

  const res = NextResponse.json({ ok: true, artifactId: artifact.id });
  logger.logAPI(req, res, { className: 'SessionArtifactAPI', methodName: 'POST' }, start);
  return res;
}

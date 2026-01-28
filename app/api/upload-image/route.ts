import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  let res: Response;
  if (!session?.user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'UploadImageAPI', methodName: 'POST' }, start);
    return res;
  }
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      res = NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      logger.logAPI(req, res, { className: 'UploadImageAPI', methodName: 'POST' }, start);
      return res;
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    const originalName = (file as any).name || `upload-${Date.now()}`;
    const safeName = path.basename(originalName).replace(/\s+/g, '_');
    const filename = `${Date.now()}-${safeName}`;
    const filePath = path.join(uploadDir, filename);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Basic file size limit (10MB)
    if (buffer.length > 10 * 1024 * 1024) {
      res = NextResponse.json({ error: 'File too large' }, { status: 413 });
      logger.logAPI(req, res, { className: 'UploadImageAPI', methodName: 'POST' }, start);
      return res;
    }

    await fs.writeFile(filePath, buffer);

    const url = `/uploads/${filename}`;
    res = NextResponse.json({ ok: true, url });
    logger.logAPI(req, res, { className: 'UploadImageAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('upload-image error', { className: 'api.upload-image', methodName: 'POST', error: err });
    res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
    logger.logAPI(req, res, { className: 'UploadImageAPI', methodName: 'POST' }, start);
    return res;
  }
}

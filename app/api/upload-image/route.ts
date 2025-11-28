import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
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
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    await fs.writeFile(filePath, buffer);

    const url = `/uploads/${filename}`;
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('upload-image error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

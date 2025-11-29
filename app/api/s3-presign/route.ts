import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

/*
  POST /api/s3-presign
  Body: { filename: string, contentType: string, userId?: string }
  Returns: { url: presignedPutUrl, key, objectUrl }

  Environment required:
  - AWS_REGION
  - S3_BUCKET
  - AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
*/

const s3 = new S3Client({ region: process.env.AWS_REGION });

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const filename = String((body as any).filename || '').trim();
    const contentType = String((body as any).contentType || '').trim();
    const userId = (body as any).userId;

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Missing filename or contentType' }, { status: 400 });
    }

    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      return NextResponse.json({ error: 'Server missing S3_BUCKET' }, { status: 500 });
    }

    const key = `uploads/${userId ?? 'anon'}/${Date.now()}-${uuidv4()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ACL: 'private',
    });

    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });

    const objectUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURIComponent(key)}`;

    return NextResponse.json({ url: presignedUrl, key, objectUrl });
  } catch (e) {
    console.error('/api/s3-presign error', e);
    return NextResponse.json({ error: 'presign_failed' }, { status: 500 });
  }
}

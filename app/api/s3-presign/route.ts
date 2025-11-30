import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { getPresignCredentials } from '../../../lib/awsSecrets';

/*
  POST /api/s3-presign
  Body: { filename: string, contentType: string, userId?: string }
  Returns: { url: presignedPutUrl, key, objectUrl }

  Environment required:
  - AWS_REGION
  - S3_BUCKET
  - AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
*/

// NOTE: S3 client will be constructed per-request below so we can optionally
// pull credentials from AWS Secrets Manager (server-only) and fall back to
// environment-provided credentials when Secrets Manager is not configured.

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

    // Build S3 client using secrets manager credentials if available
    let s3: S3Client;
    try {
      const creds = await getPresignCredentials();
      if (creds && creds.accessKeyId && creds.secretAccessKey) {
        s3 = new S3Client({ region: process.env.AWS_REGION, credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey } });
      } else {
        s3 = new S3Client({ region: process.env.AWS_REGION });
      }
    } catch (err) {
      // Fallback to default client (environment or instance role)
      console.error('Error building S3 client from Secrets Manager, falling back to env', err);
      s3 = new S3Client({ region: process.env.AWS_REGION });
    }

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

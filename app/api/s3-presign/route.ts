import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { getPresignCredentials } from '@/lib/awsSecrets';
import { getServerSessionForHandlers } from '@/lib/session';

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
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
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

    // Build S3 client using explicit env credentials if provided first (helps local dev),
    // otherwise prefer credentials from our Secrets helper, and finally fall back
    // to the default credential chain (IMDS, profile, environment, etc.).
    let s3: S3Client;
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-north-1';
    try {
      const s3Opts: any = { region };

      // Prefer explicit env credentials if set (useful for local workflows)
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        s3Opts.credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          sessionToken: process.env.AWS_SESSION_TOKEN || undefined,
        };
      } else {
        // Try to load from Secrets Manager helper if available
        try {
          const creds = (await getPresignCredentials()) as any;
          if (creds && creds.accessKeyId && creds.secretAccessKey) {
            s3Opts.credentials = {
              accessKeyId: creds.accessKeyId,
              secretAccessKey: creds.secretAccessKey,
              ...(creds.sessionToken ? { sessionToken: creds.sessionToken } : {}),
            } as any;
          }
        } catch (innerErr) {
          // ignore and continue to default provider chain
          logger.warn('getPresignCredentials failed, falling back to default credentials chain', { className: 'api.s3-presign', methodName: 'POST', error: innerErr });
        }
      }

      s3 = new S3Client(s3Opts);
    } catch (err) {
      logger.error('Error constructing S3 client', { className: 'api.s3-presign', methodName: 'POST', error: err });
      return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
    }

    // Do not include ACL in presign to avoid requiring x-amz-acl header on the browser PUT
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });

    // expiry can be configured via env (seconds), default 5 minutes
    const expiresIn = Number(process.env.S3_PRESIGN_EXPIRES ?? process.env.NEXT_PUBLIC_S3_PRESIGN_EXPIRES ?? 300);

    let presignedUrl: string;
    try {
      presignedUrl = await getSignedUrl(s3, command, { expiresIn });
    } catch (err) {
      // Detect common credential errors and return a helpful message to developer
      logger.error('/api/s3-presign getSignedUrl error', { className: 'api.s3-presign', methodName: 'POST', error: err });
      const anyErr: any = err || {};
      const msg = (anyErr.message || '').toString().toLowerCase();
      const name = (anyErr.name || '').toString().toLowerCase();
      const isCredError =
        name.includes('credential') ||
        name.includes('credentialsprovidererror') ||
        msg.includes('session has expired') ||
        msg.includes('unable to locate credentials') ||
        msg.includes('expired') ||
        msg.includes('invalid access key id');

      if (isCredError) {
        return NextResponse.json(
          {
            error: 'aws_credentials',
            message:
              'AWS credentials error: your session may have expired or credentials are missing. For local dev run `aws sso login` (if using SSO) or set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` env vars, or configure a valid `AWS_PROFILE`.',
          },
          { status: 401 },
        );
      }

      return NextResponse.json({ error: 'presign_failed', message: 'Failed to create presigned URL' }, { status: 500 });
    }

    // Also provide a short-lived presigned GET for immediate browser preview (object remains private)
    let previewUrl: string | undefined;
    try {
      const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key });
      previewUrl = await getSignedUrl(s3, getCmd, { expiresIn: Math.min(expiresIn, 300) });
    } catch (e) {
      logger.warn('Failed to generate preview URL', { className: 'api.s3-presign', methodName: 'POST', error: e });
      // ignore preview failures; client can use objectUrl if public policy allows
    }

    const objectUrl = `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key)}`;

    return NextResponse.json({ url: presignedUrl, key, objectUrl, previewUrl });
  } catch (e) {
    logger.error('/api/s3-presign error', { className: 'api.s3-presign', methodName: 'POST', error: e });
    return NextResponse.json({ error: formatErrorForResponse(e) }, { status: 500 });
  }
}

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

let _s3: S3Client | null = null;
function getS3Client() {
  if (_s3) return _s3;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT; // e.g. https://<account>.r2.cloudflarestorage.com
  const region = process.env.R2_REGION ?? 'auto';
  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error('[r2] R2 configuration missing (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT)');
  }
  _s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
  return _s3;
}

export async function uploadBufferToR2(buffer: Buffer, key: string, contentType = 'application/pdf') {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error('[r2] R2_BUCKET not configured');
  const client = getS3Client();
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await client.send(cmd);

  // Public URL: allow override via R2_PUBLIC_URL, else construct from endpoint
  if (process.env.R2_PUBLIC_URL) {
    return `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }

  // Try to construct from endpoint
  const endpoint = process.env.R2_ENDPOINT!.replace(/\/$/, '');
  const bucketPart = bucket;
  return `${endpoint}/${bucketPart}/${key}`;
}

export async function downloadBufferFromR2(key: string): Promise<Buffer> {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error('[r2] R2_BUCKET not configured');
  const client = getS3Client();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await client.send(cmd);
  if (!response.Body) throw new Error(`[r2] empty response for key: ${key}`);
  const stream = response.Body as Readable;
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export async function deleteFromR2(key: string): Promise<void> {
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error('[r2] R2_BUCKET not configured');
  const client = getS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

const R2 = { uploadBufferToR2, downloadBufferFromR2, deleteFromR2 };
export default R2;

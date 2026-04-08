/**
 * Archival worker: find `AuditLog` rows older than 1 year, push gzipped JSON
 * to S3-compatible storage (Cloudflare R2) and mark rows archived (read-only).
 */

import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getPresignCredentials } from '@/lib/awsSecrets'
import { gzipSync } from 'zlib'

const BATCH_SIZE = 100
const ARCHIVE_PREFIX = process.env.AUDIT_ARCHIVE_PREFIX ?? 'audit-archive'

function buildS3Client() {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-north-1'
  const s3Opts: any = { region }
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    s3Opts.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN || undefined,
    }
  } else {
    try {
      const creds = (getPresignCredentials && (getPresignCredentials as any)()) as any
      if (creds && creds.accessKeyId && creds.secretAccessKey) {
        s3Opts.credentials = {
          accessKeyId: creds.accessKeyId,
          secretAccessKey: creds.secretAccessKey,
          ...(creds.sessionToken ? { sessionToken: creds.sessionToken } : {}),
        }
      }
    } catch (err) {
      // ignore and let default provider chain be used
    }
  }
  return new S3Client(s3Opts)
}

export async function runAuditArchivalCycle(): Promise<{ archived: number }> {
  const now = new Date()
  const threshold = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  let archived = 0

  const bucket = process.env.S3_BUCKET
  if (!bucket) {
    logger.error('auditArchivalWorker.missingBucket', { message: 'S3_BUCKET not configured' })
    return { archived }
  }

  const s3 = buildS3Client()

  // Fetch in batches
  const candidates = await prisma.auditLog.findMany({ where: { createdAt: { lt: threshold }, archived: false }, take: BATCH_SIZE })

  for (const row of candidates) {
    try {
      const key = `${ARCHIVE_PREFIX}/${row.createdAt.toISOString().slice(0,10)}/${row.id}.json.gz`
      const payload = JSON.stringify({ id: row.id, adminId: row.adminId, targetEntity: row.targetEntity, targetId: row.targetId, action: row.action, previousValue: row.previousValue, newValue: row.newValue, reason: row.reason, ipAddress: row.ipAddress, details: row.details, createdAt: row.createdAt })
      const body = gzipSync(Buffer.from(payload))

      const put = new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/json', ContentEncoding: 'gzip' })
      await s3.send(put)

      const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-north-1'
      const objectUrl = `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key)}`

      // Mark archived (allowed by DB trigger since we only change archive fields)
      await prisma.auditLog.update({ where: { id: row.id }, data: { archived: true, archivedAt: now, archiveUrl: objectUrl } })
      archived++
      logger.info('auditArchivalWorker.archived', { id: row.id, key })
    } catch (err) {
      logger.error('auditArchivalWorker.failed', { id: row.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  logger.info('auditArchivalWorker.cycleComplete', { archived })
  return { archived }
}

export default runAuditArchivalCycle

/**
 * Admin Content Quality Monitoring -- ApprovalAudit and pending draft counts for admin dashboard.
 */

import { prisma } from '@/lib/prisma';

export interface ContentQualitySummary {
  approved: number;
  rejected: number;
  byType: Record<string, { approved: number; rejected: number }>;
  rejectionReasons: { reason: string; count: number }[];
}

export interface ContentQualityPendingSummary {
  totalPending: number;
  byType: Record<string, number>;
  oldestPendingAt: Date | null;
}

export interface ModerationHistoryEntry {
  id: string;
  entityType: string;
  entityId: string;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  actorId: string | null;
  createdAt: Date;
}

export async function getQualitySummary(opts: {
  from?: Date;
  to?: Date;
}): Promise<ContentQualitySummary> {
  const where: { createdAt?: object } = {};
  if (opts.from || opts.to) {
    where.createdAt = {};
    if (opts.from) (where.createdAt as Record<string, Date>).gte = opts.from;
    if (opts.to) (where.createdAt as Record<string, Date>).lte = opts.to;
  }

  const audits = await prisma.approvalAudit.findMany({
    where,
    select: {
      entityType: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  let approved = 0;
  let rejected = 0;
  const byType: Record<string, { approved: number; rejected: number }> = {};
  const reasonCounts = new Map<string, number>();

  for (const a of audits) {
    const isApproved = a.toStatus === 'approved';
    if (isApproved) approved++;
    else rejected++;

    const type = a.entityType ?? 'unknown';
    if (!byType[type]) byType[type] = { approved: 0, rejected: 0 };
    if (isApproved) byType[type].approved++;
    else byType[type].rejected++;

    if (!isApproved && a.reason) {
      const r = a.reason.trim().slice(0, 200);
      reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
    }
  }

  const rejectionReasons = Array.from(reasonCounts.entries())
    .map(([reason, count]: [string, number]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return { approved, rejected, byType, rejectionReasons };
}

export async function getPendingSummary(): Promise<ContentQualityPendingSummary> {
  const [syllabusDraft, chaptersDraft, topicsDraft, notesDraft] = await Promise.all([
    prisma.syllabus.count({ where: { status: 'DRAFT' } }),
    prisma.chapterDef.count({ where: { status: 'draft', lifecycle: 'active' } }),
    prisma.topicDef.count({ where: { status: 'draft', lifecycle: 'active' } }),
    prisma.topicNote.count({ where: { status: 'draft', lifecycle: 'active' } }),
  ]);

  const byType: Record<string, number> = {
    syllabus: syllabusDraft,
    chapter: chaptersDraft,
    topic: topicsDraft,
    note: notesDraft,
  };
  const totalPending = syllabusDraft + chaptersDraft + topicsDraft + notesDraft;

  const oldest = await Promise.all([
    prisma.syllabus.findFirst({ where: { status: 'DRAFT' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.chapterDef.findFirst({ where: { status: 'draft', lifecycle: 'active' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.topicDef.findFirst({ where: { status: 'draft', lifecycle: 'active' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.topicNote.findFirst({ where: { status: 'draft', lifecycle: 'active' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
  ]);

  const dates = oldest.map((r) => r?.createdAt).filter(Boolean) as Date[];
  const oldestPendingAt = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;

  return { totalPending, byType, oldestPendingAt };
}

export async function getHistoryForEntity(
  entityType: string,
  entityId: string
): Promise<ModerationHistoryEntry[]> {
  const rows = await prisma.approvalAudit.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      entityType: true,
      entityId: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      actorId: true,
      createdAt: true,
    },
  });

  return rows.map((r: { id: string; entityType: string; entityId: string; fromStatus: string; toStatus: string; reason: string | null; actorId: string | null; createdAt: Date }) => ({
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    fromStatus: r.fromStatus,
    toStatus: r.toStatus,
    reason: r.reason,
    actorId: r.actorId,
    createdAt: r.createdAt,
  }));
}

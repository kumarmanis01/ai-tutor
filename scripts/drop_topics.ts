/**
 * DROP TOPICS SCRIPT (SAFE)
 * - Soft-deletes TopicDef rows by setting lifecycle = 'deleted'
 * - Creates an AuditLog entry for each topic soft-deleted
 * - Idempotent: running again will skip already-deleted topics
 * - Supports `--dry-run` which only lists topics that would be affected
 *
 * Usage:
 *   ts-node scripts/drop_topics.ts        # actually perform deletions
 *   ts-node scripts/drop_topics.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log(`Starting drop_topics script. dryRun=${dryRun}`);

  // Find all active topics (follow soft-delete guardrail)
  const toDelete = await prisma.topicDef.findMany({ where: { lifecycle: 'active' } });

  console.log(`Found ${toDelete.length} active topics.`);
  if (toDelete.length === 0) {
    console.log('Nothing to do. Exiting.');
    return;
  }

  if (dryRun) {
    for (const t of toDelete) {
      console.log(`DRY-RUN: would soft-delete TopicDef id=${t.id} name="${t.name}" chapterId=${t.chapterId}`);
    }
    return;
  }

  // Delete in series to ensure audit logs are written and to be resumable if interrupted
  let success = 0;
  for (const t of toDelete) {
    try {
      await prisma.topicDef.update({ where: { id: t.id }, data: { lifecycle: 'deleted' } });

      await prisma.auditLog.create({
        data: {
          userId: null,
          action: 'soft-delete-topic',
          details: {
            topicId: t.id,
            topicName: t.name,
            chapterId: t.chapterId,
          },
        },
      });

      console.log(`Soft-deleted topic ${t.id} (${t.name})`);
      success += 1;
    } catch (err) {
      console.error(`Failed to soft-delete topic ${t.id}:`, err);
    }
  }

  console.log(`Completed: soft-deleted ${success}/${toDelete.length} topics.`);
}

main()
  .catch((e) => {
    console.error('Script failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

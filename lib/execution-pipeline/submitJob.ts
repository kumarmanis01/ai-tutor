import { prisma } from '@/lib/prisma';

export type SubmitJobInput = {
  jobType: unknown; // validated by callers; cast to Prisma enum at write-time
  entityType: string;
  entityId: string;
  payload?: any;
  maxAttempts?: number;
};

export async function submitJob(input: SubmitJobInput) {
  const { jobType, entityType, entityId, payload = {}, maxAttempts = 5 } = input;

  // Basic validation: ensure ID exists for the referenced entity
  let exists = false;
  switch (entityType) {
    case 'BOARD':
      exists = !!(await prisma.board.findUnique({ where: { id: entityId } }));
      break;
    case 'CLASS':
      exists = !!(await prisma.classLevel.findUnique({ where: { id: entityId } }));
      break;
    case 'SUBJECT':
      exists = !!(await prisma.subjectDef.findUnique({ where: { id: entityId } }));
      break;
    case 'CHAPTER':
      exists = !!(await prisma.chapterDef.findUnique({ where: { id: entityId } }));
      break;
    case 'TOPIC':
      exists = !!(await prisma.topicDef.findUnique({ where: { id: entityId } }));
      break;
    default:
      throw new Error(`Unsupported entityType: ${entityType}`);
  }

  if (!exists) {
    throw new Error(`Entity not found: ${entityType} ${entityId}`);
  }

  // Idempotency: return existing pending/running job if present
  const existing = await prisma.executionJob.findFirst({
    where: {
      jobType: jobType as any,
      entityType,
      entityId,
      status: { in: ['pending', 'running'] },
    },
  });

  if (existing) {
    return { jobId: existing.id, existing: true };
  }

  const job = await prisma.executionJob.create({
    data: {
      jobType: jobType as any,
      entityType,
      entityId,
      payload,
      status: 'pending',
      maxAttempts,
    },
  });

  return { jobId: job.id, existing: false };
}

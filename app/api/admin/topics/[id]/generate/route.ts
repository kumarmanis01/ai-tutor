import { submitJob } from '@/lib/execution-pipeline/submitJob';
import { prisma } from '@/lib/prisma';

export async function POST(
  _: Request,
  { params }: { params: { id: string } }
) {
  const topicId = params.id;
  if (!topicId) return Response.json({ error: 'missing id' }, { status: 400 });

  // Ensure topic exists (ID-first enforcement)
  const topic = await prisma.topicDef.findUnique({ where: { id: topicId } });
  if (!topic) return Response.json({ error: 'topic_not_found' }, { status: 404 });

  // Create separate jobs via submitJob so we get audit logs and JobExecutionLog entries
  // Notes in English and Hindi
  await submitJob({ jobType: 'notes', entityType: 'TOPIC', entityId: topicId, payload: { language: 'en', topicId } });
  await submitJob({ jobType: 'notes', entityType: 'TOPIC', entityId: topicId, payload: { language: 'hi', topicId } });

  // Questions at multiple difficulties
  for (const d of ['easy', 'medium', 'hard']) {
    await submitJob({ jobType: 'questions', entityType: 'TOPIC', entityId: topicId, payload: { difficulty: d, topicId } });
  }

  // Assemble test
  await submitJob({ jobType: 'assemble', entityType: 'TOPIC', entityId: topicId, payload: { topicId } });

  return Response.json({ queued: true });
}

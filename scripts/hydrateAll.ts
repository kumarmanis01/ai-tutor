import { hydrateNotes } from "@/hydrators/hydrateNotes"
import { hydrateQuestions } from "@/hydrators/hydrateQuestions"
import { enqueueSyllabusHydration } from "@/hydrators/hydrateSyllabus"
// yargs is dynamic-required at runtime to avoid ESM import issues in Jest
type Arguments<T> = T & Record<string, any>;
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function runHydrateAll(options?: { fromTopic?: string }) {
  const argv = options ? (options as any) : ((): Arguments<{ fromTopic?: string }> => {
    // Defer requiring yargs to runtime so tests don't attempt to parse ESM-only module at import time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const yargs = require('yargs');
    const parsed = yargs(process.argv.slice(2)).option('fromTopic', { type: 'string' }).parseSync();
    return parsed as Arguments<{ fromTopic?: string }>;
  })();

  // First, enqueue syllabus hydration jobs for all subjects (subject-scoped)
  const subjects = await prisma.subjectDef.findMany({ include: { class: { include: { board: true } } } })

  for (const subj of subjects) {
    try {
      // enqueue syllabus for English (and optionally other languages)
      await enqueueSyllabusHydration({ board: subj.class.board.name, grade: subj.class.grade, subject: subj.name, subjectId: subj.id, language: 'en' })
    } catch (err) {
      // don't stop the whole run for a single subject
      console.error('enqueueSyllabusHydration failed for subject', subj.id, err)
    }
  }

  const topics = await prisma.topicDef.findMany({
    where: options && options.fromTopic ? { id: { gte: options.fromTopic } } : (argv.fromTopic ? { id: { gte: argv.fromTopic } } : {})
  })

  for (const topic of topics) {
    try {
      await hydrateNotes(topic.id, "en")
      await hydrateNotes(topic.id, "hi")
      await hydrateQuestions(topic.id, "easy", "en")
      await hydrateQuestions(topic.id, "medium", "en")
      await hydrateQuestions(topic.id, "hard", "en")
      await hydrateQuestions(topic.id, "easy", "hi")
      await hydrateQuestions(topic.id, "medium", "hi")
      await hydrateQuestions(topic.id, "hard", "hi")
    } catch (e) {
      logger.error(`FAILED at topic: ${topic.id} ${e}`)
      throw e
    }
  }
}

// Export default for downstream callers
export default runHydrateAll;

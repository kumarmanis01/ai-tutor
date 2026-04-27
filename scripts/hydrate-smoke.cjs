// CommonJS runner: loads DATABASE_URL from .env.local and dynamically imports built dist modules
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Load DATABASE_URL from .env.local if present
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) {
      process.env.DATABASE_URL = m[1].trim();
      break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set in .env.local or environment');
  process.exit(1);
}

(async () => {
  try {
    console.log('Using DATABASE_URL:', process.env.DATABASE_URL.replace(/(postgres:\/\/)(.*@)/, '$1***@'));

    // Resolve dist module paths
    const base = path.join(process.cwd(), 'dist');
    const enqueueTopicPath = path.join(base, 'lib', 'execution-pipeline', 'enqueueTopicHydration.js');

    if (!fs.existsSync(enqueueTopicPath)) {
      console.error('Cannot find built enqueueTopicHydration at', enqueueTopicPath);
      process.exit(1);
    }

    const enqueueTopicMod = await import(pathToFileURL(enqueueTopicPath).href);
    const { enqueueNotesHydration, enqueueQuestionsHydration, enqueueTestsHydration } = enqueueTopicMod;

    // Find a subject and a topic using the generated prisma client in dist
    const prismaPath = path.join(base, 'lib', 'prisma.js');
    if (!fs.existsSync(prismaPath)) {
      console.error('Cannot find built prisma client wrapper at', prismaPath);
      process.exit(1);
    }
    const prismaMod = await import(pathToFileURL(prismaPath).href);
    const prisma = prismaMod.prisma;

    // pick one subject (resolve subjectDef with class + board)
    const subj = await prisma.subjectDef.findFirst({ include: { class: { include: { board: true } } } });
    if (!subj) {
      console.error('No subject found in DB');
      process.exit(1);
    }
    console.log('Selected subject:', subj.name, subj.id);

    // pick one topic belonging to that subject
    const topic = await prisma.topicDef.findFirst({ where: { chapter: { subjectId: subj.id } } });
    const chosenTopic = topic || (await prisma.topicDef.findFirst());
    if (!chosenTopic) {
      console.error('No topic found');
      process.exit(1);
    }
    console.log('Selected topic id:', chosenTopic.id);

    // Enqueue notes
    const notesRes = await enqueueNotesHydration({ topicId: chosenTopic.id, language: 'en' });
    console.log('enqueueNotesHydration result:', notesRes);

    // Enqueue questions for three difficulties
    for (const d of ['easy', 'medium', 'hard']) {
      const qres = await enqueueQuestionsHydration({ topicId: chosenTopic.id, language: 'en', difficulty: d });
      console.log(`enqueueQuestionsHydration ${d} result:`, qres);
    }

    // Enqueue assemble/tests
    const tres = await enqueueTestsHydration({ topicId: chosenTopic.id, language: 'en', difficulty: 'medium' });
    console.log('enqueueTestsHydration result:', tres);

    // List recent hydration jobs for subject/topic
    const jobs = await prisma.hydrationJob.findMany({ where: { OR: [{ subjectId: subj.id }, { topicId: chosenTopic.id }] }, orderBy: { createdAt: 'desc' }, take: 20 });
    console.log('\nRecent HydrationJobs (id, jobType, status, topicId, subjectId, createdAt):');
    for (const j of jobs) {
      console.log(j.id, j.jobType, j.status, j.topicId, j.subjectId, j.createdAt);
    }

    // List recent outbox rows
    const outboxes = await prisma.outbox.findMany({ where: { meta: { path: ['topicId'], equals: chosenTopic.id } } });
    // The above filter may not work in older Prisma; fallback to recent 20 outbox rows
    const recentOutbox = outboxes.length ? outboxes : await prisma.outbox.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    console.log('\nRecent Outbox rows (id, queue, meta):');
    for (const o of recentOutbox) console.log(o.id, o.queue, o.meta, o.payload);

    await prisma.$disconnect();
    process.exit(0);
  }
  catch (err) {
    console.error('Error running hydrate-smoke:', err);
    process.exit(1);
  }
})();

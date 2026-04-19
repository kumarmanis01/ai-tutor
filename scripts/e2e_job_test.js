(async () => {
  try {
    const fetch = globalThis.fetch || (await import('node-fetch')).default;
    console.log('E2E: fetching boards...');
    let res = await fetch('http://localhost:3000/api/boards');
    let boards = await res.json();
    if (!Array.isArray(boards) && boards.boards) boards = boards.boards; // handle wrapped response
    if (!boards || boards.length === 0) throw new Error('No boards returned from /api/boards');

    const board = boards[0];
    console.log('Using board:', board.name, board.id);

    // pick first class from board.classes
    const classObj = Array.isArray(board.classes) && board.classes.length > 0 ? board.classes[0] : null;
    if (!classObj) throw new Error('No classes on the selected board');
    console.log('Using class grade:', classObj.grade, 'id:', classObj.id);

    // fetch subjects for class
    console.log('Fetching subjects for classId=', classObj.id);
    res = await fetch(`http://localhost:3000/api/subjects?classId=${encodeURIComponent(classObj.id)}`);
    let subjects = await res.json();
    if (!Array.isArray(subjects)) throw new Error('Subjects endpoint did not return array');
    if (subjects.length === 0) throw new Error('No subjects for class');
    const subject = subjects[0];
    console.log('Using subject:', subject.name, subject.id);

    // get chapters (subject may include chapters)
    const chapters = subject.chapters ?? [];
    console.log('Chapters on subject:', chapters.length);
    const chapter = chapters.length > 0 ? chapters[0] : null;
    if (chapter) console.log('Using chapter:', chapter.name, chapter.id);

    // fetch topics for subject (across chapters)
    console.log('Fetching topics for subjectId=', subject.id);
    res = await fetch(`http://localhost:3000/api/topics?subjectId=${encodeURIComponent(subject.id)}`);
    const topics = await res.json();
    console.log('Topics count:', Array.isArray(topics) ? topics.length : 'unknown');

    // Submit an execution job for the subject
    const jobPayload = {
      jobType: 'syllabus',
      entityType: 'SUBJECT',
      entityId: subject.id,
      payload: { reason: 'e2e-test' },
      maxAttempts: 3,
    };

    console.log('Submitting job...', jobPayload);
    res = await fetch('http://localhost:3000/api/admin/content-engine/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(jobPayload),
    });
    const postResult = await res.json();
    console.log('POST result:', postResult);

    // Verify in DB using Prisma
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const job = await prisma.executionJob.findFirst({ where: { entityId: subject.id }, orderBy: { createdAt: 'desc' } });
    console.log('DB job found:', job ? { id: job.id, jobType: job.jobType, status: job.status } : null);
    await prisma.$disconnect();

    process.exit(0);
  } catch (err) {
    console.error('E2E failed:', err);
    process.exit(1);
  }
})();

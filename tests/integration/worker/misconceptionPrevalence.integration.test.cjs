const logger = require('../../../lib/logger');
/* eslint-disable */
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');

(async function main() {
  if (!process.env.DATABASE_URL) {
    logger.info('Skipping integration test: DATABASE_URL not set');
    process.exit(0);
  }

  const prisma = new PrismaClient();
  try {
    // Create test concept id
    const conceptId = `int-test-concept-${Date.now()}`;

    // Create a minimal misconception row
    const mis = await prisma.misconception.create({ data: { subjectId: 'INT_SUB', conceptId, name: `INT_MIS_${Date.now()}`, description: 'integration test', triggerPatterns: [], correction: 'n/a' } });

    // Create 10 answer events for the concept
    const answerEvents = [];
    for (let i = 0; i < 10; i++) {
      answerEvents.push(prisma.answerEvent.create({ data: { studentId: `s-${i}`, sessionId: `sess-${i}`, conceptId, isCorrect: false, studentAnswer: 'x', source: 'integration', createdAt: new Date() } }));
    }
    await Promise.all(answerEvents);

    // Create distinct StudentMisconception detections for 4 students
    const detections = [];
    for (let i = 0; i < 4; i++) {
      detections.push(prisma.studentMisconception.create({ data: { studentId: `s-${100 + i}`, misconceptionId: mis.id, firstDetectedAt: new Date(), lastSeenAt: new Date(), occurrenceCount: 1 } }));
    }
    await Promise.all(detections);

    // Run the worker runner via tsx
    const runnerPath = 'tests/integration/worker/runner.ts';
    const p = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', runnerPath], { env: process.env });

    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d.toString(); });
    p.stderr.on('data', (d) => { err += d.toString(); });

    const code = await new Promise((resolve) => p.on('close', resolve));
    logger.info('misconceptionPrevalence.runner.exit', code);
    if (err) logger.error(err);
    if (code !== 0) {
      logger.error('Runner failed', out);
      throw new Error('Runner process failed');
    }

    // Verify updated prevalenceRate on misconception
    const refreshed = await prisma.misconception.findUnique({ where: { id: mis.id } });
    if (!refreshed) throw new Error('Misconception not found after run');
    if (refreshed.prevalenceRate <= 0.3) throw new Error(`Expected prevalenceRate > 0.3, got ${refreshed.prevalenceRate}`);

    // Verify a system alert exists for high prevalence
    const alerts = await prisma.systemAlert.findMany({ where: { type: 'MISCONCEPTION_HIGH_PREVALENCE' } });
    if (!alerts || alerts.length === 0) throw new Error('Expected at least one MISCONCEPTION_HIGH_PREVALENCE alert');

    logger.info('Integration tests passed: misconception prevalence updated and alert emitted');

    // cleanup created rows
    await prisma.systemAlert.deleteMany({ where: { type: 'MISCONCEPTION_HIGH_PREVALENCE' } }).catch(()=>{});
    await prisma.studentMisconception.deleteMany({ where: { misconceptionId: mis.id } }).catch(()=>{});
    await prisma.answerEvent.deleteMany({ where: { conceptId } }).catch(()=>{});
    await prisma.misconception.delete({ where: { id: mis.id } }).catch(()=>{});

    process.exit(0);
  } catch (err) {
    logger.error('Integration test failed', err);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
})();

/**
 * Validate recommendation engine behaviour against scenario seed data.
 *
 * Prerequisites:
 *   1. Run seed first: npx tsx scripts/seed-scenario-curriculum.ts
 *   2. DATABASE_URL must be set (e.g. .env or .db.env)
 *
 * Usage:
 *   npx tsx scripts/validate-recommendation-scenarios.ts
 *
 * Or: npm run seed:scenarios && npm run validate:scenarios
 *
 * This script calls getNextAction(studentId, { returnTrace: true }) for each
 * scenario student and prints expected vs actual rule and trace.
 * Phase-2 rules (P0 homework_pending, P3 spaced_revision, P2 weak_topic_urgent
 * as a separate rule) may not be implemented yet -- see engine rule order.
 */

import path from 'path';
import { readFileSync } from 'fs';
import { register } from 'tsconfig-paths';

try {
  const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');
  const tsConfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
  const baseUrl = path.resolve(process.cwd(), tsConfig.compilerOptions?.baseUrl ?? '.');
  const paths = tsConfig.compilerOptions?.paths ?? {};
  register({ baseUrl, paths });
} catch {
  // ignore
}

import { prisma } from '../lib/prisma';
import { getNextAction } from '../lib/homeEngine/getNextAction';

const SCENARIO_EMAILS = [
  { scenario: 'A -- Fresh', email: 'fresh@scenario.test', expectedRule: 'next_new_topic', phase2: false },
  { scenario: 'B -- Mid-session', email: 'midsession@scenario.test', expectedRule: 'resume_session', phase2: false },
  { scenario: 'C -- Weak topic', email: 'weak@scenario.test', expectedRule: 'low_accuracy', phase2: false },
  { scenario: 'D -- Spaced revision', email: 'spaced@scenario.test', expectedRule: 'spaced_revision', phase2: true },
  { scenario: 'E -- Homework pending', email: 'homework@scenario.test', expectedRule: 'homework_pending', phase2: true },
  { scenario: 'P2 -- Daily task', email: 'daily@scenario.test', expectedRule: 'daily_task', phase2: false },
] as const;

function unwrap(result: Awaited<ReturnType<typeof getNextAction>>) {
  if (result == null) return { action: null, trace: null, traceId: null };
  if (typeof result === 'object' && 'action' in result) {
    const r = result as { action: unknown; traceId?: string; trace?: unknown };
    return { action: r.action, trace: r.trace ?? null, traceId: r.traceId ?? null };
  }
  return { action: result, trace: null, traceId: null };
}

async function main() {
  console.log('Recommendation engine scenario validation\n');
  console.log('Expectations: Phase-1 engine uses resume_session, daily_task, low_mastery, low_accuracy, next_new_topic.');
  console.log('Phase-2 rules (homework_pending, spaced_revision) may show as next_new_topic/low_accuracy until implemented.\n');

  const users = await prisma.user.findMany({
    where: { email: { in: SCENARIO_EMAILS.map((s) => s.email) } },
    select: { id: true, email: true },
  });
  const byEmail = new Map<string, string>(
    users.map((u) => [u.email!, u.id] as [string, string]),
  );

  const missing = SCENARIO_EMAILS.filter((s) => !byEmail.has(s.email));
  if (missing.length) {
    console.error('Missing scenario students. Run seed first: npx tsx scripts/seed-scenario-curriculum.ts');
    console.error('Missing:', missing.map((m) => m.email).join(', '));
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const { scenario, email, expectedRule, phase2 } of SCENARIO_EMAILS) {
    const studentId = byEmail.get(email)!;
    const result = await getNextAction(studentId, { returnTrace: true });
    const { action, trace } = unwrap(result);

    const actualRule = action && typeof action === 'object' && 'ruleId' in action ? (action as { ruleId: string }).ruleId : 'null';
    const ok = actualRule === expectedRule;
    if (ok) passed++;
    else if (!phase2) failed++;

    const latencyMs = trace && typeof trace === 'object' && 'latencyMs' in trace ? (trace as { latencyMs?: number }).latencyMs : undefined;
    const rulesEval = trace && typeof trace === 'object' && 'rulesEvaluated' in trace ? (trace as { rulesEvaluated?: string[] }).rulesEvaluated : [];

    console.log(`Scenario ${scenario}`);
    console.log(`  Email: ${email}`);
    console.log(`  Expected rule: ${expectedRule}`);
    console.log(`  Actual ruleId: ${actualRule}`);
    console.log(`  ${ok ? 'PASS' : phase2 ? 'Phase-2 (data ready)' : 'FAIL'}`);
    if (latencyMs != null) console.log(`  Latency: ${latencyMs}ms`);
    if (rulesEval.length) console.log(`  Rules evaluated: ${rulesEval.join(' → ')}`);
    if (action && typeof action === 'object' && 'resumePhase' in action && (action as { resumePhase?: string }).resumePhase) {
      console.log(`  resumePhase: ${(action as { resumePhase: string }).resumePhase}`);
    }
    console.log('');
  }

  console.log('---');
  console.log(`Passed: ${passed}, Failed: ${failed}`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});

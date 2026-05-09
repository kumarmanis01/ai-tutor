/**
 * FILE OBJECTIVE:
 * - Execute nightly VPS unit and integration test checks via the shared Jest infra wrapper and email the result summary to health@spinzyacademy.com.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/jobs/nightlyTestReport.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | created nightly test execution and email reporting job for scheduler automation
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import { sendMailSafe } from '@/lib/mailer';

const NIGHTLY_REPORT_RECIPIENT = 'health@spinzyacademy.com';
const RUNNER_SCRIPT_RELATIVE_PATH = path.join('scripts', 'run-focused-tests.cjs');
const MAX_LOG_TAIL_CHARS = 12_000;
const NODE_MEMORY_LIMIT = '--max-old-space-size=4096';

export interface NightlyTestCommand {
  name: 'unit' | 'integration';
  args: string[];
  env: NodeJS.ProcessEnv;
}

export interface NightlyTestExecutionResult {
  name: 'unit' | 'integration';
  exitCode: number;
  durationMs: number;
  passed: boolean;
  stdoutTail: string;
  stderrTail: string;
}

export interface NightlyTestReport {
  startedAtIso: string;
  finishedAtIso: string;
  durationMs: number;
  allPassed: boolean;
  results: NightlyTestExecutionResult[];
}

export function getNightlyTestCommands(repoRoot: string): NightlyTestCommand[] {
  const runnerScript = path.resolve(repoRoot, RUNNER_SCRIPT_RELATIVE_PATH);

  return [
    {
      name: 'unit',
      args: [
        runnerScript,
        '--',
        '--testPathPattern=tests/unit',
        '--runInBand',
        '--watchAll=false',
      ],
      env: {
        ...process.env,
        NODE_OPTIONS: NODE_MEMORY_LIMIT,
      },
    },
    {
      name: 'integration',
      args: [
        runnerScript,
        'tests/integration/',
        '--',
        '--config',
        'jest.integration.config.cjs',
        '--passWithNoTests',
        '--runInBand',
        '--watchAll=false',
      ],
      env: {
        ...process.env,
      },
    },
  ];
}

function appendTail(current: string, chunk: string): string {
  return `${current}${chunk}`.slice(-MAX_LOG_TAIL_CHARS);
}

function runOneCommand(repoRoot: string, command: NightlyTestCommand): Promise<NightlyTestExecutionResult> {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let stdoutTail = '';
    let stderrTail = '';

    const child = spawn(process.execPath, command.args, {
      cwd: repoRoot,
      env: command.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdoutTail = appendTail(stdoutTail, String(chunk));
    });

    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderrTail = appendTail(stderrTail, String(chunk));
    });

    child.on('error', (error) => {
      stderrTail = appendTail(stderrTail, `spawn error: ${error instanceof Error ? error.message : String(error)}\n`);
    });

    child.on('close', (code) => {
      const exitCode = typeof code === 'number' ? code : 1;
      const durationMs = Date.now() - startedAt;
      resolve({
        name: command.name,
        exitCode,
        durationMs,
        passed: exitCode === 0,
        stdoutTail,
        stderrTail,
      });
    });
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildNightlyReportEmail(report: NightlyTestReport): { subject: string; text: string; html: string } {
  const statusLabel = report.allPassed ? 'PASS' : 'FAIL';
  const subject = `[${statusLabel}] VPS nightly test report ${report.startedAtIso}`;

  const lines: string[] = [
    `Nightly test report (${statusLabel})`,
    `Started: ${report.startedAtIso}`,
    `Finished: ${report.finishedAtIso}`,
    `Duration (ms): ${report.durationMs}`,
    '',
  ];

  for (const result of report.results) {
    lines.push(
      `${result.name.toUpperCase()}: ${result.passed ? 'PASS' : 'FAIL'} (exit=${result.exitCode}, durationMs=${result.durationMs})`,
    );
    if (result.stdoutTail.trim()) {
      lines.push('stdout tail:');
      lines.push(result.stdoutTail);
    }
    if (result.stderrTail.trim()) {
      lines.push('stderr tail:');
      lines.push(result.stderrTail);
    }
    lines.push('');
  }

  const htmlRows = report.results
    .map((result) => {
      const status = result.passed ? 'PASS' : 'FAIL';
      return `<tr>
        <td>${escapeHtml(result.name.toUpperCase())}</td>
        <td>${escapeHtml(status)}</td>
        <td>${result.exitCode}</td>
        <td>${result.durationMs}</td>
      </tr>`;
    })
    .join('');

  const html = `
    <h2>Nightly VPS Test Report (${escapeHtml(statusLabel)})</h2>
    <p><strong>Started:</strong> ${escapeHtml(report.startedAtIso)}</p>
    <p><strong>Finished:</strong> ${escapeHtml(report.finishedAtIso)}</p>
    <p><strong>Total duration (ms):</strong> ${report.durationMs}</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead>
        <tr>
          <th>Suite</th>
          <th>Status</th>
          <th>Exit Code</th>
          <th>Duration (ms)</th>
        </tr>
      </thead>
      <tbody>
        ${htmlRows}
      </tbody>
    </table>
    ${report.results
      .map((result) => {
        const stdout = result.stdoutTail.trim();
        const stderr = result.stderrTail.trim();
        return `
          <h3>${escapeHtml(result.name.toUpperCase())}</h3>
          ${stdout ? `<p><strong>stdout tail</strong></p><pre>${escapeHtml(stdout)}</pre>` : ''}
          ${stderr ? `<p><strong>stderr tail</strong></p><pre>${escapeHtml(stderr)}</pre>` : ''}
        `;
      })
      .join('')}
  `;

  return { subject, text: lines.join('\n'), html };
}

export async function runNightlyTestReportAndEmail(repoRoot: string = process.cwd()): Promise<NightlyTestReport> {
  const startedAt = new Date();
  const runnerScript = path.resolve(repoRoot, RUNNER_SCRIPT_RELATIVE_PATH);

  logger.info('scheduler.nightlyTests.starting', {
    runnerScript,
    repoRoot,
    recipient: NIGHTLY_REPORT_RECIPIENT,
  });

  let results: NightlyTestExecutionResult[];

  if (!fs.existsSync(runnerScript)) {
    results = [
      {
        name: 'unit',
        exitCode: 1,
        durationMs: 0,
        passed: false,
        stdoutTail: '',
        stderrTail: `runner script not found: ${runnerScript}`,
      },
      {
        name: 'integration',
        exitCode: 1,
        durationMs: 0,
        passed: false,
        stdoutTail: '',
        stderrTail: `runner script not found: ${runnerScript}`,
      },
    ];
  } else {
    const commands = getNightlyTestCommands(repoRoot);
    results = [];

    for (const command of commands) {
      const result = await runOneCommand(repoRoot, command);
      results.push(result);
      logger.info('scheduler.nightlyTests.command.completed', {
        suite: result.name,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
      });
    }
  }

  const finishedAt = new Date();
  const report: NightlyTestReport = {
    startedAtIso: startedAt.toISOString(),
    finishedAtIso: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    allPassed: results.every((result) => result.passed),
    results,
  };

  const email = buildNightlyReportEmail(report);
  await sendMailSafe({
    to: NIGHTLY_REPORT_RECIPIENT,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  logger.info('scheduler.nightlyTests.email.dispatched', {
    allPassed: report.allPassed,
    durationMs: report.durationMs,
    recipient: NIGHTLY_REPORT_RECIPIENT,
  });

  return report;
}

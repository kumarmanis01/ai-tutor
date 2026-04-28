#!/usr/bin/env node
/**
 * FILE OBJECTIVE:
 * - Cross-platform CJS wrapper to run seed-board-chapter-weights.ts via tsx.
 *
 * LINKED UNIT TEST:
 * - None (thin wrapper; logic lives in seed-board-chapter-weights.ts).
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-04-20T00:00:00Z | claude | created
 *
 * Usage:
 *   node scripts/seed-board-chapter-weights.cjs
 *   node scripts/seed-board-chapter-weights.cjs --dry-run
 *   node scripts/seed-board-chapter-weights.cjs --force
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');

// On Windows the executable is tsx.cmd; on POSIX it is tsx.
const isWin = process.platform === 'win32';
const tsxBin = path.join(process.cwd(), 'node_modules', '.bin', isWin ? 'tsx.cmd' : 'tsx');

const args = ['scripts/seed-board-chapter-weights.ts', ...process.argv.slice(2)];
const child = spawn(tsxBin, args, { stdio: 'inherit', cwd: process.cwd(), shell: isWin });
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});

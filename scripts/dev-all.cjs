#!/usr/bin/env node
'use strict';

/**
 * Local full-stack dev launcher.
 *
 * Starts Next.js (web) and the BullMQ worker+scheduler in one terminal.
 * Output from each process is prefixed so you can tell them apart:
 *   [web]    next dev output
 *   [worker] tsx worker/dev-supervisor.ts output
 *
 * Prerequisites (set in .env):
 *   REDIS_URL=redis://localhost:6379   (Memurai default port)
 *   DATABASE_URL=postgresql://...      (local PostgreSQL)
 *
 * Usage:
 *   npm run dev:all
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

function tsxBin() {
  const bin = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';
  return path.resolve(ROOT, 'node_modules', '.bin', bin);
}

function nextBin() {
  const bin = process.platform === 'win32' ? 'next.cmd' : 'next';
  return path.resolve(ROOT, 'node_modules', '.bin', bin);
}

function prefixedSpawn(bin, args, name) {
  const child = spawn(bin, args, {
    cwd: ROOT,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const prefix = `[${name}] `;

  child.stdout.on('data', (chunk) => {
    process.stdout.write(
      String(chunk)
        .split('\n')
        .map((l) => (l ? prefix + l : l))
        .join('\n')
    );
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(
      String(chunk)
        .split('\n')
        .map((l) => (l ? prefix + l : l))
        .join('\n')
    );
  });

  child.on('exit', (code, signal) => {
    const msg = signal ? `signal ${signal}` : `code ${code}`;
    process.stderr.write(`[dev-all] ${name} exited (${msg}) -- shutting down\n`);
    shutdown(code ?? 1);
  });

  return child;
}

const tsxPath = tsxBin();
const nextPath = nextBin();

if (!fs.existsSync(tsxPath)) {
  process.stderr.write('[dev-all] tsx not found -- run npm install\n');
  process.exit(1);
}
if (!fs.existsSync(nextPath)) {
  process.stderr.write('[dev-all] next not found -- run npm install\n');
  process.exit(1);
}

const children = [
  prefixedSpawn(nextPath, ['dev'], 'web'),
  prefixedSpawn(tsxPath, ['worker/dev-supervisor.ts'], 'worker'),
];

let shuttingDown = false;
function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try { c.kill('SIGTERM'); } catch { /* already gone */ }
  }
  setTimeout(() => process.exit(exitCode), 500);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

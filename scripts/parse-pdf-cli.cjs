#!/usr/bin/env node
// Wrapper to run the TypeScript parse-pdf CLI using local tsx binary
const { spawn } = require('child_process');
const path = require('path');

function tsxBin() {
  return path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
}

const args = ['scripts/parse-pdf-cli.ts', ...process.argv.slice(2)];
const child = spawn(tsxBin(), args, { stdio: 'inherit', cwd: process.cwd() });
child.on('exit', (code) => process.exit(code));

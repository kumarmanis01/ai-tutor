#!/usr/bin/env node
// Wrapper to run seed-board-chapter-weights.ts via tsx.
// Usage:
//   node scripts/seed-board-chapter-weights.cjs
//   node scripts/seed-board-chapter-weights.cjs --dry-run
//   node scripts/seed-board-chapter-weights.cjs --force
const { spawn } = require('child_process')
const path = require('path')

function tsxBin() {
  return path.join(process.cwd(), 'node_modules', '.bin', 'tsx')
}

const args = ['scripts/seed-board-chapter-weights.ts', ...process.argv.slice(2)]
const child = spawn(tsxBin(), args, { stdio: 'inherit', cwd: process.cwd() })
child.on('exit', (code) => process.exit(code ?? 0))

#!/usr/bin/env node
// Wrapper to run the TypeScript seed runner for CBSE grade 10
const { spawn } = require('child_process')
const path = require('path')

function tsxBin() {
  return path.join(process.cwd(), 'node_modules', '.bin', 'tsx')
}

const args = ['scripts/seed-cbse-grade10.ts', ...process.argv.slice(2)]
const child = spawn(tsxBin(), args, { stdio: 'inherit', cwd: process.cwd() })
child.on('exit', (code) => process.exit(code))

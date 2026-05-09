#!/usr/bin/env node
/**
 * FILE OBJECTIVE:
 * - Consolidated VPS-safe seed orchestration for taxonomy and board chapter weights.
 * - Runs deterministic idempotent base seed first, then chapter weight seed.
 *
 * LINKED UNIT TEST:
 * - None (orchestration script; validate by running with --dry-run and DB checks).
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-09T10:00:00Z | copilot | created consolidated CJS seeding runner for VPS
 */
'use strict'

const { spawnSync } = require('child_process')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const forwardedArgs = process.argv.slice(2)

function runNodeScript(scriptPath, args) {
  const fullScript = path.join('scripts', scriptPath)
  const result = spawnSync(process.execPath, [fullScript, ...args], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    throw new Error(`Failed: node ${fullScript} ${args.join(' ')}`)
  }
}

function main() {
  console.log('START consolidated seeding: taxonomy + board chapter weights')
  runNodeScript('seed-ai-content.cjs', [])
  runNodeScript('seed-board-chapter-weights.cjs', forwardedArgs)
  console.log('DONE consolidated seeding')
}

try {
  main()
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}

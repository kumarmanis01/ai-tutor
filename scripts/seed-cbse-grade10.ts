/**
 * FILE OBJECTIVE:
 * - Convenience script to run NCERT scraper for CBSE Grade 10 Mathematics and Science (English).
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/seed-cbse-grade10.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | copilot | created seed runner for CBSE Grade 10 Math+Science
 */

import { spawn } from 'child_process'
import path from 'path'

function tsxBin() {
  return path.join(process.cwd(), 'node_modules', '.bin', 'tsx')
}

function runScript(args: string[]) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(tsxBin(), args, { stdio: 'inherit', cwd: process.cwd() })
    child.on('exit', (code) => {
      if (typeof code === 'number') resolve(code)
      else reject(new Error('Process terminated'))
    })
    child.on('error', (err) => reject(err))
  })
}

async function main() {
  console.log('Seeding CBSE Grade 10 Mathematics...')
  let code = await runScript(['scripts/scrape-ncert.ts', '--grade', '10', '--subject', 'mathematics', '--lang', 'en'])
  if (code !== 0) process.exit(code)

  console.log('Seeding CBSE Grade 10 Science...')
  code = await runScript(['scripts/scrape-ncert.ts', '--grade', '10', '--subject', 'science', '--lang', 'en'])
  if (code !== 0) process.exit(code)

  console.log('Seed complete.')
}

if (require.main === module) {
  main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
}

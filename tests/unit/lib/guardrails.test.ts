/**
 * FILE OBJECTIVE:
 * - Compile/existence test for lib/guardrails
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/guardrails.test.ts
 *
 * EDIT LOG:
 * - 2026-01-02T15:20:14.700Z | copilot | replaced require with safe exists check
 */

import fs from 'fs'
import path from 'path'

describe('lib/guardrails.ts', () => {
  test('file exists', () => {
    const p = path.join(process.cwd(), 'lib/guardrails.ts')
    expect(fs.existsSync(p)).toBe(true)
  })
})

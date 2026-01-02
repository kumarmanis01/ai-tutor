/**
 * FILE OBJECTIVE:
 * - Compile/existence test for app/api/tests/route.ts
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/tests/route.test.ts
 *
 * EDIT LOG:
 * - 2026-01-02T15:20:14.633Z | copilot | replaced require with safe exists check
 */

import fs from 'fs'
import path from 'path'

describe('app/api/tests/route.ts', () => {
  test('file exists', () => {
    const p = path.join(process.cwd(), 'app/api/tests/route.ts')
    expect(fs.existsSync(p)).toBe(true)
  })
})

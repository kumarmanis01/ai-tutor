/**
 * FILE OBJECTIVE:
 * - Unit tests for `scripts/check-curriculum-seed.ts` helper functions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/check-curriculum-seed.test.ts
 *
 * EDIT LOG:
 * - 2026-04-21T00:00:00Z | copilot | added unit tests for getFlag
 */

import { getFlag } from '../../../scripts/check-curriculum-seed'

describe('check-curriculum-seed getFlag', () => {
  const OLD_ARGV = process.argv

  afterEach(() => {
    process.argv = OLD_ARGV
  })

  test('returns undefined for missing flag', () => {
    process.argv = [...OLD_ARGV.slice(0, 2)]
    expect(getFlag('--board')).toBeUndefined()
  })

  test('parses provided flag values', () => {
    process.argv = [...OLD_ARGV.slice(0, 2), '--board', 'CBSE', '--grade', '10']
    expect(getFlag('--board')).toBe('CBSE')
    expect(getFlag('--grade')).toBe('10')
  })
})

/**
 * FILE OBJECTIVE:
 * - Validate VALID_LANGUAGES constant does not include 'auto'
 *
 * LINKED SOURCE:
 * - app/api/student/subject-language/route.ts
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | add subject-language unit test
 */

import { VALID_LANGUAGES } from '@/app/api/student/subject-language/route'

describe('subject-language VALID_LANGUAGES', () => {
  it('does not include auto and contains en, hi', () => {
    expect(VALID_LANGUAGES).not.toContain('auto')
    expect(VALID_LANGUAGES).toEqual(expect.arrayContaining(['en', 'hi']))
  })
})

/**
 * FILE OBJECTIVE:
 * - Unit tests for LanguageSelector helpers.
 *
 * LINKED SOURCE:
 * - components/LanguageSelector.tsx
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | add helper tests (.test.ts)
 */

import { normalizeToCode, resolveAutoCode } from '@/components/LanguageSelector'

describe('LanguageSelector helpers', () => {
  test('normalizeToCode maps display to code and handles auto', () => {
    expect(normalizeToCode('English')).toBe('en')
    expect(normalizeToCode('हिंदी (Hindi)')).toBe('hi')
    expect(normalizeToCode('auto')).toBe('auto')
    expect(normalizeToCode(undefined)).toBe('en')
  })

  test('resolveAutoCode prefers browser languages and falls back to availableCodes', () => {
    expect(resolveAutoCode(['hi', 'en'], ['hi-IN', 'en-US'])).toBe('hi')
    expect(resolveAutoCode(['en'], ['es-ES', 'en-US'])).toBe('en')
    expect(resolveAutoCode(['en'], [])).toBe('en')
  })
})
/**
 * FILE OBJECTIVE:
 * - Unit tests for LanguageSelector helpers.
 *
 * LINKED SOURCE:
 * - components/LanguageSelector.tsx
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | add helper tests
 */

import { normalizeToCode, resolveAutoCode } from '@/components/LanguageSelector'

describe('LanguageSelector helpers', () => {
  test('normalizeToCode maps display to code and handles auto', () => {
    expect(normalizeToCode('English')).toBe('en')
    expect(normalizeToCode('हिंदी (Hindi)')).toBe('hi')
    expect(normalizeToCode('auto')).toBe('auto')
    expect(normalizeToCode(undefined)).toBe('en')
  })

  test('resolveAutoCode prefers browser languages and falls back to availableCodes', () => {
    expect(resolveAutoCode(['hi', 'en'], ['hi-IN', 'en-US'])).toBe('hi')
    expect(resolveAutoCode(['en'], ['es-ES', 'en-US'])).toBe('en')
    expect(resolveAutoCode(['en'], [])).toBe('en')
  })
})
/**
 * FILE OBJECTIVE:
 * - Unit tests for LanguageSelector helpers.
 *
 * LINKED SOURCE:
 * - components/LanguageSelector.tsx
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | add helper tests
 */

import { normalizeToCode, resolveAutoCode } from '@/components/LanguageSelector'

describe('LanguageSelector helpers', () => {
  test('normalizeToCode maps display to code and handles auto', () => {
    expect(normalizeToCode('English')).toBe('en')
    expect(normalizeToCode('हिंदी (Hindi)')).toBe('hi')
    expect(normalizeToCode('auto')).toBe('auto')
    expect(normalizeToCode(undefined)).toBe('en')
  })

  test('resolveAutoCode prefers browser languages and falls back to availableCodes', () => {
    expect(resolveAutoCode(['hi', 'en'], ['hi-IN', 'en-US'])).toBe('hi')
    expect(resolveAutoCode(['en'], ['es-ES', 'en-US'])).toBe('en')
    expect(resolveAutoCode(['en'], [])).toBe('en')
  })
})

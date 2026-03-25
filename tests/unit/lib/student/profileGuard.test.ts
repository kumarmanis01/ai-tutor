/**
 * Unit tests for isProfileComplete in lib/student/profileGuard.ts
 *
 * Covers:
 *  - All four academic fields present -> true
 *  - Postgres wire-format string subjects ("{english,mathematics}") -> true
 *  - null subjects (pre-migration row) -> false
 *  - empty array subjects -> false
 *  - empty Postgres string ("{}") -> false
 *  - missing board / grade / language -> false
 *  - extra fields (e.g. age, parentEmail) are ignored -- only 4 academic fields matter
 */

import { isProfileComplete } from '@/lib/student/profileGuard'

const BASE = {
  board: 'cbse',
  grade: '10',
  language: 'en',
  subjects: ['mathematics', 'science', 'english'],
}

describe('isProfileComplete', () => {
  // ── Happy paths ──────────────────────────────────────────────────────────────

  it('should return true when all four fields are filled (string[] subjects)', () => {
    expect(isProfileComplete(BASE)).toBe(true)
  })

  it('should return true when subjects is a Postgres wire-format string', () => {
    expect(isProfileComplete({ ...BASE, subjects: '{english,mathematics,science}' })).toBe(true)
  })

  it('should return true when subjects wire-format has spaces after commas', () => {
    expect(isProfileComplete({ ...BASE, subjects: '{english, mathematics}' })).toBe(true)
  })

  it('should return true when grade is a number (session/raw DB row)', () => {
    expect(isProfileComplete({ ...BASE, grade: 10 })).toBe(true)
  })

  it('should return true when grade is a numeric string "6"', () => {
    expect(isProfileComplete({ ...BASE, grade: '6' })).toBe(true)
  })

  it('should return true when extra fields (age, parentEmail) are present', () => {
    // parentEmail/age are not checked by isProfileComplete
    expect(isProfileComplete({ ...BASE, subjects: ['english'], age: 14, parentEmail: null } as any)).toBe(true)
  })

  // ── Missing / empty subjects ─────────────────────────────────────────────────

  it('should return false when subjects is null (pre-migration row)', () => {
    expect(isProfileComplete({ ...BASE, subjects: null })).toBe(false)
  })

  it('should return false when subjects is undefined', () => {
    expect(isProfileComplete({ ...BASE, subjects: undefined })).toBe(false)
  })

  it('should return false when subjects is an empty array', () => {
    expect(isProfileComplete({ ...BASE, subjects: [] })).toBe(false)
  })

  it('should return false when subjects is empty Postgres string "{}"', () => {
    expect(isProfileComplete({ ...BASE, subjects: '{}' })).toBe(false)
  })

  it('should return false when subjects is a plain empty string', () => {
    expect(isProfileComplete({ ...BASE, subjects: '' })).toBe(false)
  })

  it('should return false when subjects is a non-array/non-string type (number)', () => {
    expect(isProfileComplete({ ...BASE, subjects: 0 })).toBe(false)
  })

  // ── Missing board ────────────────────────────────────────────────────────────

  it('should return false when board is null', () => {
    expect(isProfileComplete({ ...BASE, board: null })).toBe(false)
  })

  it('should return false when board is empty string', () => {
    expect(isProfileComplete({ ...BASE, board: '' })).toBe(false)
  })

  it('should return false when board is whitespace-only', () => {
    expect(isProfileComplete({ ...BASE, board: '   ' })).toBe(false)
  })

  // ── Missing grade ────────────────────────────────────────────────────────────

  it('should return false when grade is null', () => {
    expect(isProfileComplete({ ...BASE, grade: null })).toBe(false)
  })

  it('should return false when grade is undefined', () => {
    expect(isProfileComplete({ ...BASE, grade: undefined })).toBe(false)
  })

  it('should return false when grade is empty string', () => {
    expect(isProfileComplete({ ...BASE, grade: '' })).toBe(false)
  })

  // ── Missing language ─────────────────────────────────────────────────────────

  it('should return false when language is null', () => {
    expect(isProfileComplete({ ...BASE, language: null })).toBe(false)
  })

  it('should return false when language is empty string', () => {
    expect(isProfileComplete({ ...BASE, language: '' })).toBe(false)
  })

  // ── Nullish user object ──────────────────────────────────────────────────────

  it('should return false when called with null-like user', () => {
    expect(isProfileComplete(null as any)).toBe(false)
  })
})

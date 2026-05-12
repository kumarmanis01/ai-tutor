/**
 * FILE OBJECTIVE:
 * - Unit tests for isProfileComplete, enforcing the new parent channel pattern (parentEmail or parentWhatsappPhone).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/profileGuard.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | align parent contact tests to parentWhatsappPhone pattern with legacy fallback coverage
 */

import { isProfileComplete } from '@/lib/student/profileGuard'

const BASE = {
  board: 'cbse',
  grade: '10',
  language: 'en',
  subjects: ['mathematics', 'science', 'english'],
  age: 14,
  parentEmail: 'parent@example.com',
  parentWhatsappPhone: null,
}

describe('isProfileComplete', () => {
  // ── Happy paths ──────────────────────────────────────────────────────────────

  it('should return true when all required fields are present (email contact)', () => {
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

  it('should return true when parent contact is phone instead of email', () => {
    expect(isProfileComplete({ ...BASE, parentEmail: null, parentWhatsappPhone: '+919876543210' })).toBe(true)
  })

  it('should return true when both parent email and phone are present', () => {
    expect(isProfileComplete({ ...BASE, parentEmail: 'parent@example.com', parentWhatsappPhone: '+919876543210' })).toBe(true)
  })

  it('should return true with legacy whatsappPhone field when parentWhatsappPhone is absent', () => {
    expect(isProfileComplete({ ...BASE, parentEmail: null, whatsappPhone: '+919876543210' })).toBe(true)
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

  // ── Missing or invalid age (DPDP compliance) ─────────────────────────────────

  it('should return false when age is null', () => {
    expect(isProfileComplete({ ...BASE, age: null })).toBe(false)
  })

  it('should return false when age is undefined', () => {
    expect(isProfileComplete({ ...BASE, age: undefined })).toBe(false)
  })

  it('should return false when age is 0', () => {
    expect(isProfileComplete({ ...BASE, age: 0 })).toBe(false)
  })

  it('should return false when age is negative', () => {
    expect(isProfileComplete({ ...BASE, age: -1 })).toBe(false)
  })

  it('should return false when age is > 120', () => {
    expect(isProfileComplete({ ...BASE, age: 121 })).toBe(false)
  })

  it('should return false when age is NaN', () => {
    expect(isProfileComplete({ ...BASE, age: NaN })).toBe(false)
  })

  // ── Missing parent contact (email OR phone required) ───────────────────────────

  it('should return false when both parentEmail and parentWhatsappPhone are null', () => {
    expect(isProfileComplete({ ...BASE, parentEmail: null, parentWhatsappPhone: null })).toBe(false)
  })

  it('should return false when parentEmail is invalid (no @)', () => {
    expect(isProfileComplete({ ...BASE, parentEmail: 'invalid-email', parentWhatsappPhone: null })).toBe(false)
  })

  it('should return false when parentWhatsappPhone is too short (< 10 digits)', () => {
    expect(isProfileComplete({ ...BASE, parentEmail: null, parentWhatsappPhone: '9876' })).toBe(false)
  })

  it('should return false when parentEmail is whitespace-only', () => {
    expect(isProfileComplete({ ...BASE, parentEmail: '   ', parentWhatsappPhone: null })).toBe(false)
  })

  // ── Nullish user object ──────────────────────────────────────────────────────

  it('should return false when called with null-like user', () => {
    expect(isProfileComplete(null as any)).toBe(false)
  })
})

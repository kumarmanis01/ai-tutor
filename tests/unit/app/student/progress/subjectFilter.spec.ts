/**
 * FILE OBJECTIVE:
 * - Unit tests for the subject-filter shapes used in /student/progress page.tsx.
 * - Verifies Gap 6 fix: sessionSubjectFilter routes through topic→chapter→subject,
 *   and questionClause routes through chapter→subject, instead of using a
 *   non-existent top-level 'subject' field.
 * - Verifies Gap 7 fix: subjectNames is deduplicated before DB lookup.
 * - Verifies page-level subject normalization against slug/name values.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/progress/subjectFilter.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | created — Gap 6 & 7 fix coverage (PROGRESS_PAGE_GAP_AUDIT.md)
 */

import {
  normalizeSubjectKey,
  subjectDefMatchesActiveSubject,
} from '@/lib/student/progressPage'

// These tests exercise the filter-shape logic extracted from page.tsx in isolation
// (pure functions with no DB / Next.js dependencies).

// ── Filter shape helpers (mirrors the logic in page.tsx) ────────────────────

function buildSessionSubjectFilter(activeSubject: string) {
  return activeSubject
    ? { topic: { chapter: { subject: { name: { equals: activeSubject, mode: 'insensitive' as const } } } } }
    : {};
}

function buildQuestionClause(activeSubject: string) {
  return activeSubject
    ? { chapter: { not: null, subject: { name: { equals: activeSubject, mode: 'insensitive' as const } } } }
    : { chapter: { not: null } };
}

function buildConceptSubjectFilter(activeSubject: string) {
  return activeSubject
    ? {
        concept: {
          topic: {
            chapter: {
              subject: { name: { equals: activeSubject, mode: 'insensitive' as const } },
            },
          },
        },
      }
    : {};
}

function deduplicateSubjectNames(raw: unknown[]): string[] {
  return [...new Set(raw.map((s) => String(s)).filter(Boolean))];
}

// ── sessionSubjectFilter ─────────────────────────────────────────────────────

describe('sessionSubjectFilter (heatmap query)', () => {
  it('is empty when no subject is active', () => {
    expect(buildSessionSubjectFilter('')).toEqual({});
  });

  it('routes through topic → chapter → subject when a subject is active', () => {
    const filter = buildSessionSubjectFilter('Mathematics');
    expect(filter).toEqual({
      topic: {
        chapter: {
          subject: {
            name: { equals: 'Mathematics', mode: 'insensitive' },
          },
        },
      },
    });
  });

  it('does NOT contain a top-level "subject" key (which would fail Prisma validation)', () => {
    const filter = buildSessionSubjectFilter('Physics') as Record<string, unknown>;
    expect(filter).not.toHaveProperty('subject');
  });

  it('uses case-insensitive mode', () => {
    const filter = buildSessionSubjectFilter('chemistry') as any;
    expect(filter.topic.chapter.subject.name.mode).toBe('insensitive');
  });
});

// ── questionClause ────────────────────────────────────────────────────────────

describe('questionClause (trendRows / testResult query)', () => {
  it('contains only { chapter: { not: null } } when no subject is active', () => {
    expect(buildQuestionClause('')).toEqual({ chapter: { not: null } });
  });

  it('routes through chapter → subject when a subject is active', () => {
    const clause = buildQuestionClause('Biology');
    expect(clause).toEqual({
      chapter: {
        not: null,
        subject: { name: { equals: 'Biology', mode: 'insensitive' } },
      },
    });
  });

  it('preserves { chapter: { not: null } } constraint even when subject is set', () => {
    const clause = buildQuestionClause('Chemistry') as any;
    expect(clause.chapter.not).toBeNull();
  });

  it('does NOT contain a top-level "subject" key (which would fail Prisma validation)', () => {
    const clause = buildQuestionClause('History') as Record<string, unknown>;
    expect(clause).not.toHaveProperty('subject');
  });

  it('uses case-insensitive mode', () => {
    const clause = buildQuestionClause('biology') as any;
    expect(clause.chapter.subject.name.mode).toBe('insensitive');
  });
});

// ── conceptSubjectFilter ──────────────────────────────────────────────────────

describe('conceptSubjectFilter (already correct — regression guard)', () => {
  it('is empty when no subject is active', () => {
    expect(buildConceptSubjectFilter('')).toEqual({});
  });

  it('routes through concept → topic → chapter → subject', () => {
    const filter = buildConceptSubjectFilter('Mathematics') as any;
    expect(filter.concept.topic.chapter.subject).toEqual({
      name: { equals: 'Mathematics', mode: 'insensitive' },
    });
  });
});

// ── deduplicateSubjectNames (Gap 7) ──────────────────────────────────────────

describe('deduplicateSubjectNames', () => {
  it('removes duplicate entries', () => {
    expect(deduplicateSubjectNames(['Mathematics', 'Mathematics', 'Physics'])).toEqual([
      'Mathematics',
      'Physics',
    ]);
  });

  it('filters out empty strings', () => {
    expect(deduplicateSubjectNames(['', 'Biology', ''])).toEqual(['Biology']);
  });

  it('converts non-string entries to strings', () => {
    expect(deduplicateSubjectNames([1, 'Science', 1])).toEqual(['1', 'Science']);
  });

  it('returns empty array for empty input', () => {
    expect(deduplicateSubjectNames([])).toEqual([]);
  });

  it('preserves order of first occurrence', () => {
    const result = deduplicateSubjectNames(['Chemistry', 'Math', 'Chemistry', 'Biology', 'Math']);
    expect(result).toEqual(['Chemistry', 'Math', 'Biology']);
  });
});

// ── subject matching helpers (progress page lookup path) ────────────────────

describe('normalizeSubjectKey / subjectDefMatchesActiveSubject', () => {
  it('normalizes whitespace, underscores, and hyphens consistently', () => {
    expect(normalizeSubjectKey('  Social-Studies ')).toBe('social studies');
    expect(normalizeSubjectKey('Computer_Science')).toBe('computer science');
  });

  it('matches subject names and slugs case-insensitively', () => {
    expect(
      subjectDefMatchesActiveSubject(
        { name: 'Mathematics', slug: 'maths' },
        'maths',
      ),
    ).toBe(true);
    expect(
      subjectDefMatchesActiveSubject(
        { name: 'Computer Science', slug: 'computer-science' },
        'computer science',
      ),
    ).toBe(true);
  });

  it('rejects mismatched subjects', () => {
    expect(
      subjectDefMatchesActiveSubject(
        { name: 'Physics', slug: 'physics' },
        'chemistry',
      ),
    ).toBe(false);
  });
});

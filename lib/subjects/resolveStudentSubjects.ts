/**
 * FILE OBJECTIVE:
 * - Centralise logic to resolve a user's enrolled subject strings (names/slugs)
 *   to canonical SubjectDef rows. Used by UI and onboarding flows.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/subjects/resolveStudentSubjects.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-16T00:00:00Z | copilot | created central subject resolver
 * - 2026-05-17T00:00:00Z | reviewer | skip unscoped lookup when scoped resolves all enrolled subjects;
 *   tag scoped vs unscoped so dedup deterministically prefers scoped rows
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

type UserLike = { subjects?: any; grade?: any; board?: any }

// Internal shape that tracks whether a row came from the scoped (board+grade) lookup.
// Used by dedup to deterministically prefer scoped rows over unscoped ones when
// both lookups return the same slug/name, regardless of insertion order.
type SubjectEntry = { id: string; name: string; slug: string; scoped: boolean }

export default async function resolveStudentSubjects(
  user: UserLike | null | undefined,
  learningPlans: Array<{ subjectId: string }> | null | undefined = [],
) {
  const subjects: SubjectEntry[] = []

  if (!user) return subjects.map(({ scoped: _, ...s }) => s)

  // Extract enrolled subject tokens from user.subjects (array or Postgres wire-format)
  let enrolledSubjects: string[] | null = null
  if (user?.subjects) {
    if (Array.isArray(user.subjects)) {
      // Lowercase + trim so legacy capitalised values ("Mathematics") match the
      // canonical lowercased slug column on SubjectDef.
      const arr = (user.subjects as string[]).filter(Boolean).map((s) => String(s).trim().toLowerCase())
      if (arr.length > 0) enrolledSubjects = arr
    } else if (typeof user.subjects === 'string' && user.subjects.length > 0) {
        const cleaned = (user.subjects as string).replace(/^\{/, '').replace(/\}$/, '').trim()
        const parts =
          cleaned.length > 0
            ? cleaned
                .split(',')
                .map((s) =>
                  String(s)
                    .trim()
                    // Remove surrounding single or double quotes that appear in Postgres array wire-format
                    .replace(/^"(.*)"$/, '$1')
                    .replace(/^'(.*)'$/, '$1')
                    .toLowerCase(),
                )
                .filter(Boolean)
            : []
      if (parts.length > 0) enrolledSubjects = parts
    }
  }

  const planSubjectIds = Array.from(new Set((learningPlans || []).map((p) => p.subjectId).filter(Boolean)))

  // Helper: parse numeric grade when possible
  const parsedUserGrade =
    typeof user?.grade === 'string'
      ? (() => {
          const normalizedGrade = user.grade.trim()
          if (normalizedGrade.length === 0) return null
          const numericGrade = Number(normalizedGrade)
          return Number.isInteger(numericGrade) ? numericGrade : null
        })()
      : null

  // Guard: without both board and grade we cannot resolve a subject to a specific
  // class scope, and the unscoped fallback would risk pulling cross-grade rows
  // sharing the same slug (e.g. "English" exists in every grade). Bail out so
  // the caller treats the student as not-yet-onboarded rather than guessing.
  const hasScope = !!user?.board && parsedUserGrade !== null
  if (!hasScope && (!planSubjectIds || planSubjectIds.length === 0)) {
    logger.debug('resolveStudentSubjects.missing_scope', { hasBoard: !!user?.board, grade: parsedUserGrade })
    return subjects.map(({ scoped: _, ...s }) => s)
  }

  // Primary resolution: prefer scoped lookup (board+grade) when possible and prefer slug matches
  try {
    if (enrolledSubjects && enrolledSubjects.length > 0) {
      // 1) Scoped lookup: only when both board and grade are available
      if (user?.board && parsedUserGrade !== null) {
        const classFilter = {
          grade: parsedUserGrade,
          board: { slug: { equals: user.board, mode: 'insensitive' as const } },
        }

        // 1a) Scoped slug match
        let rows = await prisma.subjectDef.findMany({
          where: { lifecycle: 'active', class: { ...classFilter, lifecycle: 'active' }, slug: { in: enrolledSubjects } },
          select: { id: true, name: true, slug: true },
        })

        // 1b) Scoped name match (case-insensitive)
        if (rows.length === 0) {
          rows = await prisma.subjectDef.findMany({
            where: { lifecycle: 'active', class: { ...classFilter, lifecycle: 'active' }, name: { in: enrolledSubjects, mode: 'insensitive' } },
            select: { id: true, name: true, slug: true },
          })
        }

        if (rows.length > 0) {
          for (const r of rows) {
            subjects.push({ id: (r as any).id, name: (r as any).name, slug: (r as any).slug, scoped: true })
          }
        }
      }

      // 2) Unscoped supplementary lookup: only run when the scoped lookup did NOT
      //    resolve every enrolled subject. Running it unconditionally could introduce
      //    rows from other boards/grades that share a slug/name, polluting results.
      const scopedKeys = new Set(
        subjects.flatMap((s) => [s.slug.toLowerCase(), s.name.toLowerCase()])
      )
      const allScopedResolved = enrolledSubjects.every((s) => scopedKeys.has(s.toLowerCase()))

      if (!allScopedResolved) {
        const unscopedRows = await prisma.subjectDef.findMany({
          where: {
            lifecycle: 'active',
            OR: [
              { slug: { in: enrolledSubjects } },
              { name: { in: enrolledSubjects, mode: 'insensitive' } },
            ],
          },
          select: { id: true, name: true, slug: true },
        })

        for (const r of unscopedRows) {
          subjects.push({ id: (r as any).id, name: (r as any).name, slug: (r as any).slug, scoped: false })
        }
      }

      if (subjects.length === 0) {
        logger.debug('resolveStudentSubjects.no_match', { enrolledSubjects, grade: parsedUserGrade, board: user.board })
      }
    }

    // 3) LearningPlan fallback: use subjectIds from plans when name/slug resolution found nothing
    if (subjects.length === 0 && planSubjectIds.length > 0) {
      const rows = await prisma.subjectDef.findMany({ where: { id: { in: planSubjectIds }, lifecycle: 'active' }, select: { id: true, name: true, slug: true } })
      for (const r of rows) {
        subjects.push({ id: (r as any).id, name: (r as any).name, slug: (r as any).slug, scoped: false })
      }
    }
  } catch (err) {
    logger.warn('resolveStudentSubjects.failed', { error: String(err), enrolledSubjects })
  }

  // Deduplicate by slug when available, otherwise by lowercased name.
  // Scoped rows always win over unscoped rows for the same key, regardless of
  // insertion order. Among same-source rows, planSet membership breaks ties.
  const planSet = new Set(planSubjectIds)
  const seen = new Map<string, SubjectEntry>()
  for (const s of subjects) {
    const key = (s.slug ?? s.name).toLowerCase()
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, s)
    } else if (!existing.scoped && s.scoped) {
      // Scoped row replaces an unscoped one for the same key.
      seen.set(key, s)
    } else if (existing.scoped === s.scoped && planSet.has(s.id)) {
      // Same source: prefer plan-matched id (signals higher relevance).
      seen.set(key, s)
    }
  }

  return Array.from(seen.values()).map(({ scoped: _, ...s }) => s)
}

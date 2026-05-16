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
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

type UserLike = { subjects?: any; grade?: any; board?: any }

export default async function resolveStudentSubjects(
  user: UserLike | null | undefined,
  learningPlans: Array<{ subjectId: string }> | null | undefined = [],
) {
  const subjects: { id: string; name: string; slug: string }[] = []

  if (!user) return subjects

  // Extract enrolled subject tokens from user.subjects (array or Postgres wire-format)
  let enrolledSubjects: string[] | null = null
  if (user?.subjects) {
    if (Array.isArray(user.subjects)) {
      const arr = (user.subjects as string[]).filter(Boolean).map((s) => String(s).trim())
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
                    .replace(/^'(.*)'$/, '$1'),
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
          subjects.push(...rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug })))
        }
      }

      // 2) Unscoped fallback: always run when scoped lookup produced nothing (or was skipped
      //    due to missing board/grade). Matches slug OR name across all active SubjectDefs.
      if (subjects.length === 0) {
        const rows = await prisma.subjectDef.findMany({
          where: {
            lifecycle: 'active',
            OR: [
              { slug: { in: enrolledSubjects } },
              { name: { in: enrolledSubjects, mode: 'insensitive' } },
            ],
          },
          select: { id: true, name: true, slug: true },
        })

        if (rows.length > 0) {
          subjects.push(...rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug })))
        } else {
          logger.debug('resolveStudentSubjects.no_match', { enrolledSubjects, grade: parsedUserGrade, board: user.board })
        }
      }
    }

    // 3) LearningPlan fallback: use subjectIds from plans when name/slug resolution found nothing
    if (subjects.length === 0 && planSubjectIds.length > 0) {
      const rows = await prisma.subjectDef.findMany({ where: { id: { in: planSubjectIds }, lifecycle: 'active' }, select: { id: true, name: true, slug: true } })
      subjects.push(...rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug })))
    }
  } catch (err) {
    logger.warn('resolveStudentSubjects.failed', { error: String(err), enrolledSubjects })
  }

  // Deduplicate by slug when available, otherwise by lowercased name.
  const planSet = new Set(planSubjectIds)
  const seen = new Map<string, { id: string; name: string; slug: string }>()
  for (const s of subjects) {
    const key = (s.slug ?? s.name).toLowerCase()
    if (!seen.has(key) || planSet.has(s.id)) seen.set(key, s)
  }

  return Array.from(seen.values())
}

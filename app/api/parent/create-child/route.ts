/**
 * FILE OBJECTIVE:
 * - API to allow a parent to create a minimal child account and link it to their parent profile.
 * - Accepts: name, email, phone, dateOfBirth, grade, board, medium (language) (F-PAR-002 AC-01).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-create-child.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | created
 * - 2026-04-12T12:00:00Z | copilot | use FAMILY_MAX_CHILDREN constant from billing constants
 * - 2026-04-14T00:00:00Z | claude | added dateOfBirth, grade, board, medium fields (F-PAR-002 AC-01)
 * - 2026-04-14T12:00:00Z | staff-engineer | fix: create child with role 'user', default language, remove unused const
 * - 2026-05-04T00:00:00Z | copilot | require relationship and explicit consent bundle for parent-created child accounts
 * - 2026-05-05T00:00:00Z | copilot | fix: remove unused ConsentScope import (lint)
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendEmailUnifiedSafe } from '@/lib/mail'
import { sendSms } from '@/lib/sms'
import { parentWelcomeHtml } from '@/lib/email/templates'
import { FAMILY_MAX_CHILDREN } from '@/app/api/billing/constants'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

// Valid consent scope strings - used for both validation and required scopes
const VALID_CONSENT_SCOPES = [
  'DATA_PROCESSING',
  'AI_INTERACTION',
  'PARENT_NOTIFICATION',
  'COMMUNITY_FEATURES',
  'MARKETING',
] as const

const REQUIRED_CONSENT_SCOPES = [
  'DATA_PROCESSING',
  'AI_INTERACTION',
  'PARENT_NOTIFICATION',
  'COMMUNITY_FEATURES',
] as const



export async function POST(req: Request) {
  const start = Date.now()
  const session = await getServerSessionForHandlers()
  const parentId = (session?.user as { id?: string })?.id
  if (!parentId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
    return res
  }

  const body = await req.json().catch(() => ({})) as any
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' && body.email.includes('@') ? body.email.trim() : undefined
  const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : undefined

  // F-PAR-002 AC-01 fields
  const grade = typeof body.grade === 'string' ? body.grade.trim() : undefined
  const board = typeof body.board === 'string' ? body.board.trim() : undefined
  const relationship = typeof body.relationship === 'string' ? body.relationship.trim().toLowerCase() : ''
  // medium maps to language field on User
  const medium = typeof body.medium === 'string' ? body.medium.trim() : undefined
  const dateOfBirth = typeof body.dateOfBirth === 'string' && body.dateOfBirth ? new Date(body.dateOfBirth) : undefined
  const consentScopesRaw = Array.isArray(body.consentScopes) ? body.consentScopes : []
  const consentScopes = consentScopesRaw.filter(
    (scope: unknown): scope is string => typeof scope === 'string' && VALID_CONSENT_SCOPES.includes(scope as any)
  )

  if (!name) {
    const res = NextResponse.json({ error: 'child name required' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
    return res
  }

  if (!['father', 'mother', 'guardian'].includes(relationship)) {
    const res = NextResponse.json({ error: 'relationship required (father|mother|guardian)' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
    return res
  }

  const missingScopes = REQUIRED_CONSENT_SCOPES.filter((requiredScope) => !consentScopes.includes(requiredScope))
  if (missingScopes.length > 0) {
    const res = NextResponse.json({ error: 'required consents missing', missingScopes }, { status: 400 })
    logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
    return res
  }

  if (dateOfBirth && isNaN(dateOfBirth.getTime())) {
    const res = NextResponse.json({ error: 'invalid dateOfBirth' }, { status: 400 })
    logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
    return res
  }

  try {
    // Enforce server-side cap: max FAMILY_MAX_CHILDREN active child links per parent
    const activeCount = await prisma.parentStudent.count({ where: { parentId, status: 'active' } })
    if (activeCount >= FAMILY_MAX_CHILDREN) {
      const res = NextResponse.json({ error: `Parent already has maximum linked children (${FAMILY_MAX_CHILDREN})` }, { status: 409 })
      logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
      return res
    }

    // Fetch parent details to derive defaults (language) and for notifications
    const parentUser = await prisma.user.findUnique({ where: { id: parentId }, select: { language: true, name: true, email: true, phone: true } })
    const defaultLanguage = (parentUser?.language as any) ?? 'en'

    // Create child user and parentStudent link in a transaction
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const userAgent = req.headers.get('user-agent') ?? null
    const child = await prisma.$transaction(async (tx) => {
      const normalizedMedium = typeof medium === 'string' ? medium.toLowerCase() : ''
      const resolvedLanguage = normalizedMedium === 'hi' || normalizedMedium === 'hindi' ? 'hi' : normalizedMedium === 'en' || normalizedMedium === 'english' ? 'en' : defaultLanguage

      const userData: Prisma.UserCreateInput = {
        name,
        email,
        phone,
        role: 'user',
        language: resolvedLanguage as any,
        createdByParentId: parentId,
      }
      if (grade) (userData as any).grade = grade
      if (board) (userData as any).board = board
      if (dateOfBirth) (userData as any).dateOfBirth = dateOfBirth

      const created = await tx.user.create({ data: userData as any })
      await tx.parentStudent.create({ data: { parentId, studentId: created.id, status: 'active', relationship: relationship as any } })

      await Promise.all(
        REQUIRED_CONSENT_SCOPES.map((scope) =>
          tx.consent.upsert({
            where: { id: `${created.id}:${scope}` },
            update: {
              givenAt: new Date(),
              withdrawnAt: null,
              ipAddress: ip,
              userAgent,
              version: '1.0',
            },
            create: {
              id: `${created.id}:${scope}`,
              userId: created.id,
              scope,
              ipAddress: ip,
              userAgent,
              version: '1.0',
            },
          }),
        ),
      )

      // promote parent role if necessary
      const p = await tx.user.findUnique({ where: { id: parentId }, select: { role: true } })
      if (p?.role === 'user') {
        await tx.user.update({ where: { id: parentId }, data: { role: 'parent' } })
      }
      return created
    })

    // Notify parent with enriched welcome content (F-PAR-001 AC-07)
    try {
      const parent = parentUser ?? await prisma.user.findUnique({ where: { id: parentId }, select: { email: true, phone: true, name: true } })
      const parentName = parent?.name ?? 'Parent'
      const _childGrade = grade ? `Class ${grade}` : ''
      if (parent?.email) {
        await sendEmailUnifiedSafe({
          mode: 'raw',
          delivery: 'best_effort',
          to: parent.email,
          subject: `${child.name}'s learning account is ready on Spinzy`,
          // TODO(email-consolidation): this bypasses sendEmailUnified -- migrate to EMAIL_TEMPLATES catalog
          html: parentWelcomeHtml(parentName, child.name),
          reason: 'parent_child_created_welcome',
          featureFlagDomain: 'notification',
        })
      }
      if (parent?.phone) {
        await sendSms(parent.phone, `Hi ${parentName}! ${child.name}'s Spinzy Academy account is ready. Log in to track their progress. - Team Spinzy`)
      }
    } catch (err) {
      logger.error('[parent:create-child] notification suppressed', { error: String(err) })
    }

    const res = NextResponse.json({
      ok: true,
      child: {
        id: child.id,
        name: child.name,
        grade: (child as any).grade ?? null,
        board: (child as any).board ?? null,
        medium: (child as any).language ?? null,
        dateOfBirth: (child as any).dateOfBirth ? (child as any).dateOfBirth.toISOString() : null,
      },
    }, { status: 201 })
    logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('ParentCreateChildAPI failed', { className: 'ParentCreateChildAPI', methodName: 'POST', error: String(err) })
    const res = NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    logger.logAPI(req, res, { className: 'ParentCreateChildAPI', methodName: 'POST' }, start)
    return res
  }
}

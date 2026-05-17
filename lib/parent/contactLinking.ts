/**
 * FILE OBJECTIVE:
 * - Provide helper utilities for auto-linking parent accounts from student contact fields and computing per-channel parent verification status.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/parent/contactLinking.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add parent auto-link and channel verification helper utilities
 * - 2026-05-11T00:20:00Z | copilot | fix implicit-any typing in consumed phone key mapping
 */

import { UserRole, type PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'
import { invalidateUserSessionCache } from '@/lib/auth'

const CLASS_NAME = 'parent.contactLinking'
const EMAIL_KEY_PREFIX = 'email:'
const WHATSAPP_KEY_PREFIX = 'whatsapp:'

export type ParentChannelVerificationStatus = {
  accountVerified: boolean
  email: {
    configured: boolean
    verified: boolean
    masked: string | null
  }
  whatsapp: {
    configured: boolean
    verified: boolean
    masked: string | null
  }
}

function normalizeEmail(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase()
}

function normalizePhoneDigits(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '')
}

function toE164Candidates(digits: string): string[] {
  if (!digits) return []
  const candidates = new Set<string>([digits])
  if (digits.length === 10) {
    candidates.add(`91${digits}`)
    candidates.add(`+91${digits}`)
  }
  candidates.add(`+${digits}`)
  return Array.from(candidates)
}

function toEmailOtpKey(email: string): string {
  return `${EMAIL_KEY_PREFIX}${Buffer.from(email).toString('base64').slice(0, 20)}`
}

function toWhatsappOtpKeys(phoneDigits: string): string[] {
  if (!phoneDigits) return []
  // Support legacy key (plain digits) plus prefixed key for new channel-specific records.
  return [
    `${WHATSAPP_KEY_PREFIX}${phoneDigits}`,
    phoneDigits,
  ]
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  const masked = local.charAt(0) + '***' + (local.length > 1 ? local.charAt(local.length - 1) : '')
  return `${masked}@${domain}`
}

function maskPhone(phoneDigits: string): string {
  if (!phoneDigits) return '***'
  const tail = phoneDigits.slice(-4)
  return `+** *****${tail}`
}

export function resolveParentChannels(parentEmail: string | null | undefined, whatsappPhone: string | null | undefined, parentPhone: string | null | undefined) {
  const normalizedEmail = normalizeEmail(parentEmail)
  const whatsappDigits = normalizePhoneDigits(whatsappPhone)
  const parentPhoneDigits = normalizePhoneDigits(parentPhone)
  const resolvedWhatsappDigits = whatsappDigits || parentPhoneDigits

  return {
    normalizedEmail,
    resolvedWhatsappDigits,
    hasEmail: normalizedEmail.includes('@'),
    hasWhatsapp: resolvedWhatsappDigits.length >= 10,
  }
}

export async function ensureAutoLinkedParentsForStudent(params: {
  prisma: PrismaClient
  studentId: string
  parentEmail?: string | null
  whatsappPhone?: string | null
  parentPhone?: string | null
}): Promise<void> {
  const { prisma, studentId } = params
  const channels = resolveParentChannels(params.parentEmail, params.whatsappPhone, params.parentPhone)

  const candidateParentIds = new Set<string>()

  if (channels.hasEmail) {
    const parentByEmail = await prisma.user.findUnique({
      where: { email: channels.normalizedEmail },
      select: { id: true, role: true },
    })
    if (parentByEmail && parentByEmail.id !== studentId) {
      candidateParentIds.add(parentByEmail.id)
    }
  }

  if (channels.hasWhatsapp) {
    const phoneCandidates = toE164Candidates(channels.resolvedWhatsappDigits)
    const parentByPhone = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: { in: phoneCandidates } },
          { whatsappPhone: { in: phoneCandidates } },
        ],
      },
      select: { id: true, role: true },
    })
    if (parentByPhone && parentByPhone.id !== studentId) {
      candidateParentIds.add(parentByPhone.id)
    }
  }

  for (const parentId of candidateParentIds) {
    try {
      const parent = await prisma.user.findUnique({ where: { id: parentId }, select: { role: true, email: true } })
        if (parent && parent.role !== UserRole.parent) {
          await prisma.user.update({ where: { id: parentId }, data: { role: UserRole.parent } })
          try {
            if (parent.email) await invalidateUserSessionCache(parent.email)
          } catch (e) {
            logger.warn('ensureParentRole: cache invalidation failed', { parentId, error: String(e) })
          }
        }

      const existing = await prisma.parentStudent.findUnique({
        where: { parentId_studentId: { parentId, studentId } },
        select: { id: true, status: true },
      })

      if (!existing) {
        await prisma.parentStudent.create({
          data: {
            parentId,
            studentId,
            status: 'active',
            relationship: 'guardian',
          },
        })
      } else if (existing.status !== 'active') {
        await prisma.parentStudent.update({ where: { id: existing.id }, data: { status: 'active' } })
      }
    } catch (error) {
      logger.warn('Auto-link parent by contact failed', {
        className: CLASS_NAME,
        studentId,
        parentId,
        error: String(error),
      })
    }
  }
}

export async function getParentChannelVerificationStatus(params: {
  prisma: PrismaClient
  studentId: string
  parentEmail?: string | null
  whatsappPhone?: string | null
  parentPhone?: string | null
}): Promise<ParentChannelVerificationStatus> {
  const channels = resolveParentChannels(params.parentEmail, params.whatsappPhone, params.parentPhone)

  const emailKeys = channels.hasEmail ? [toEmailOtpKey(channels.normalizedEmail)] : []
  const whatsappKeys = channels.hasWhatsapp ? toWhatsappOtpKeys(channels.resolvedWhatsappDigits) : []
  const allKeys = [...emailKeys, ...whatsappKeys]

  if (allKeys.length === 0) {
    return {
      accountVerified: false,
      email: { configured: false, verified: false, masked: null },
      whatsapp: { configured: false, verified: false, masked: null },
    }
  }

  const consumedRecords = await params.prisma.phoneOtp.findMany({
    where: {
      userId: params.studentId,
      consumed: true,
      phone: { in: allKeys },
    },
    select: { phone: true },
  })

  const consumedKeySet = new Set(consumedRecords.map((row: { phone: string }) => row.phone))
  const emailVerified = emailKeys.some((key) => consumedKeySet.has(key))
  const whatsappVerified = whatsappKeys.some((key) => consumedKeySet.has(key))

  return {
    accountVerified: emailVerified || whatsappVerified,
    email: {
      configured: channels.hasEmail,
      verified: emailVerified,
      masked: channels.hasEmail ? maskEmail(channels.normalizedEmail) : null,
    },
    whatsapp: {
      configured: channels.hasWhatsapp,
      verified: whatsappVerified,
      masked: channels.hasWhatsapp ? maskPhone(channels.resolvedWhatsappDigits) : null,
    },
  }
}

export function channelOtpKeyByType(channel: 'email' | 'whatsapp', email: string, whatsappDigits: string): string {
  if (channel === 'email') {
    return toEmailOtpKey(email)
  }
  return `${WHATSAPP_KEY_PREFIX}${whatsappDigits}`
}

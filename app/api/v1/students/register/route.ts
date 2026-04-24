/**
 * FILE OBJECTIVE:
 * - Public endpoint to register a student. Creates User record and issues parent consent requests for minors.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/v1/students/register.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendConsentRequest } from '@/lib/whatsapp/cloud.service'
import { sendMailSafe } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

function maskPhone(p: string | null | undefined) {
  if (!p) return null
  const s = p.replace(/[^0-9+]/g, '')
  // show country + last 2 digits
  return s.replace(/(\d)(?=\d{4})/g, '*')
}

function calcAgeFromDob(dob: string) {
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return age
}

export async function POST(req: Request) {
  const start = Date.now()
  let body: any
  try {
    body = await req.json()
  } catch {
    const res = NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start)
    return res
  }

  const name = typeof body.name === 'string' ? body.name.trim() : undefined
  const dob = typeof body.dateOfBirth === 'string' ? body.dateOfBirth : undefined
  const grade = typeof body.grade === 'string' || typeof body.grade === 'number' ? String(body.grade) : undefined
  const board = typeof body.board === 'string' ? body.board : undefined
  const channel = body.channel === 'whatsapp' ? 'whatsapp' : body.channel === 'email' ? 'email' : undefined
  const parentContact = typeof body.parent_contact === 'string' ? body.parent_contact.trim() : undefined

  if (!name || !dob || !grade || !board) {
    const res = NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start)
    return res
  }

  const age = calcAgeFromDob(dob)
  if (age == null || age < 0 || age > 120) {
    const res = NextResponse.json({ error: 'invalid_dob' }, { status: 400 })
    logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start)
    return res
  }

  try {
    // Create student user record (minimal). Use accountStatus depending on age.
    const isAdult = age >= 18
    const accountStatus = isAdult ? 'active' : 'pending_parent_verification'

    const user = await prisma.user.create({
      data: {
        name,
        dateOfBirth: new Date(dob),
        age,
        isAdult,
        grade,
        board,
        language: 'en',
        accountStatus: accountStatus as any,
      },
      select: { id: true, name: true, age: true, isAdult: true },
    })

    // Adult: return success with full access scope placeholder
    if (isAdult) {
      const res = NextResponse.json({ ok: true, user: { id: user.id, isAdult: true }, scope: 'full' })
      logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start)
      return res
    }

    // Minor: require parent contact and create ConsentRequest
    if (!parentContact || !channel) {
      const res = NextResponse.json({ error: 'parent_contact_required' }, { status: 400 })
      logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start)
      return res
    }

    // create consent token and consent request
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

    const consentReq = await prisma.consentRequest.create({
      data: {
        studentId: user.id,
        parentPhone: channel === 'whatsapp' ? parentContact : null,
        parentEmail: channel === 'email' ? parentContact : null,
        channel: channel === 'whatsapp' ? 'WHATSAPP' : 'EMAIL',
        token,
        expiresAt,
      },
    })

    // send message (best-effort)
    try {
      if (channel === 'whatsapp') {
        // sendConsentRequest(phone, childName, grade, board, consentToken)
        await sendConsentRequest(parentContact, name, grade ?? '', board ?? '', token)
        await prisma.consentMessageLog.create({ data: { consentRequestId: consentReq.id, channel: 'WHATSAPP', status: 'SENT' } })
      } else {
        const consentUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/consent/${token}`
        await sendMailSafe({ to: parentContact, subject: `Approve ${name}'s Spinzy account`, html: `Please approve: ${consentUrl}` })
        await prisma.consentMessageLog.create({ data: { consentRequestId: consentReq.id, channel: 'EMAIL', status: 'SENT' } })
      }
    } catch (e) {
      logger.warn('student.register: sending consent message failed', { error: String(e), studentId: user.id })
    }

    const exploreToken = `explore:${token}`
    const res = NextResponse.json({ ok: true, user: { id: user.id, isAdult: false }, explore_token: exploreToken, contactMask: maskPhone(parentContact) })
    logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('student.register failed', { error: String(err) })
    const res = NextResponse.json({ error: 'server_error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start)
    return res
  }
}

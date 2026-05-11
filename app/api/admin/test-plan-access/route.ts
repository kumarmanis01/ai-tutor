/**
 * FILE OBJECTIVE:
 * - Dev-only endpoint: reports that test plan access is controlled by NODE_ENV=development.
 * - The DB whitelist (TestPlanAccess model) was removed; access is now environment-gated.
 * - All methods return 404 outside of development so the route is invisible in production.
 *
 * EDIT LOG:
 * - 2026-04-19T00:00:00Z | copilot | fix(lint): prefix unused req param in requireAdmin
 * - 2026-04-18T00:00:00Z | copilot | add required header sections for CI documentation enforcement
 * - 2026-04-15T00:00:00Z | staff-engineer | created for Sprint A C1 test plan gating
 * - 2026-05-11T00:00:00Z | staff-engineer | replace DB whitelist with NODE_ENV gate; route is dev-only stub
 */

import { NextResponse } from 'next/server'

const IS_DEV = process.env.NODE_ENV === 'development'

function notFound() {
  return NextResponse.json({ code: 'NOT_FOUND', message: 'Not found' }, { status: 404 })
}

export async function GET() {
  if (!IS_DEV) return notFound()
  return NextResponse.json({
    info: 'test_weekly plan is available to all signed-in users in NODE_ENV=development. No DB whitelist.',
  })
}

export async function POST() {
  if (!IS_DEV) return notFound()
  return NextResponse.json({
    info: 'No-op: test plan access is controlled by NODE_ENV, not a DB whitelist.',
  })
}

export async function DELETE() {
  if (!IS_DEV) return notFound()
  return NextResponse.json({
    info: 'No-op: test plan access is controlled by NODE_ENV, not a DB whitelist.',
  })
}

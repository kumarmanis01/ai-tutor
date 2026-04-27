/**
 * FILE OBJECTIVE:
 * - Expose a temporary debug endpoint to inspect critical env vars on the running server.
 *
 * LINKED UNIT TEST:
 * - tests/unit/debug/env.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md

 * EDIT LOG:
 * - 2026-01-20T00:00:00Z | automated-agent | added temporary debug route
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const payload = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
    NEXTAUTH_URL_INTERNAL: process.env.NEXTAUTH_URL_INTERNAL ?? null,
    VERCEL: process.env.VERCEL ?? null,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? null,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET
  }
  return NextResponse.json(payload)
}

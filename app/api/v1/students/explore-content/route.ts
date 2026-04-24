/**
 * FILE OBJECTIVE:
 * - Return 3 curated sample topics for a given grade and board to power Explore Mode.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/v1/students/explore-content.spec.ts
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

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const start = Date.now()
  try {
    const url = new URL(req.url)
    const grade = url.searchParams.get('grade')
    const board = url.searchParams.get('board')

    if (!grade || !board) return NextResponse.json({ error: 'missing_params' }, { status: 400 })

    const topics = await prisma.topicDef.findMany({
      where: {
        lifecycle: 'active',
        chapter: {
          subject: {
            class: {
              grade: Number(grade),
              board: { slug: board },
            },
          },
        },
      },
      take: 3,
      select: {
        id: true,
        name: true,
        notes: { take: 1, select: { content: true } },
      },
    })

    const payload = topics.map((t) => ({ id: t.id, name: t.name, sampleNote: t.notes?.[0]?.content ?? null }))
    const res = NextResponse.json({ ok: true, topics: payload })
    logger.logAPI(req, res, { className: 'ExploreContentAPI', methodName: 'GET' }, start)
    return res
  } catch (err) {
    logger.error('explore-content failed', { error: String(err) })
    const res = NextResponse.json({ error: 'server_error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'ExploreContentAPI', methodName: 'GET' }, start)
    return res
  }
}

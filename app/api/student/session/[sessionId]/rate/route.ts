import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { sessionId: string } }) {
  // TODO: implement real session rating persistence
  const { sessionId } = params
  const body = await req.json().catch(() => null)
  const rating = typeof body?.rating === 'number' ? body.rating : null

  return NextResponse.json({ ok: true, sessionId, rating })
}


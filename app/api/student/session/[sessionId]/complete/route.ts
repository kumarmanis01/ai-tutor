import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { sessionId: string } }) {
  // TODO: implement real session completion summary using actual session metrics
  const { sessionId } = params
  const _body = await req.json().catch(() => null)

  const response = {
    xpEarned: 120,
    totalXp: 1340,
    leveledUp: true,
    newLevel: 5,
    masteryDelta: 0.12,
    masteryAfter: 0.78,
    badgesEarned: [
      { name: 'Focused Learner', description: 'Completed a full concept session without skipping.' },
      { name: 'Practice Pro', description: 'Answered most practice questions correctly.' },
    ],
    aiInsight:
      'You made strong progress on this concept — especially in understanding why the steps work, not just how.',
    sessionDurationMinutes: 32,
    correctAnswers: 14,
    totalQuestions: 18,
  }

  return NextResponse.json(response)
}


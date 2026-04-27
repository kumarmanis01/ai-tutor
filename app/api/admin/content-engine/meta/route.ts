import { NextResponse } from 'next/server'
import { requireAdminOrModerator } from '@/lib/auth'

// Returns canonical metadata for the admin UI (job types, entity types, statuses)
export async function GET() {
  await requireAdminOrModerator()

  const jobTypes = ['syllabus', 'notes', 'questions', 'tests', 'assemble']
  const entityTypes = ['BOARD', 'CLASS', 'SUBJECT', 'CHAPTER', 'TOPIC']
  const statuses = ['pending', 'running', 'failed', 'completed', 'cancelled']

  return NextResponse.json({ jobTypes, entityTypes, statuses })
}

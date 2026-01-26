import { listJobs } from '@/lib/jobs/registry'
import { formatErrorForResponse } from '@/lib/errorResponse'

export async function GET() {
  try {
    const jobs = listJobs().map((j) => ({ name: j.name, schedule: j.schedule }))
    return new Response(JSON.stringify({ jobs }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: formatErrorForResponse(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

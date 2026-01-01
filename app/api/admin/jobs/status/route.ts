import { listJobs } from '@/lib/jobs/registry'

export async function GET() {
  try {
    const jobs = listJobs().map((j) => ({ name: j.name, schedule: j.schedule }))
    return new Response(JSON.stringify({ jobs }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

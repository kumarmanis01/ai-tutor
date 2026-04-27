'use client'

export async function patchSafetyEventResolved(id: string, resolved: boolean): Promise<void> {
  const r = await fetch(`/api/admin/safety-events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolved }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Request failed')
  }
}


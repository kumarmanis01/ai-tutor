const windows = new Map<string, number[]>()

export function allowExportRequest(userId: string | null, courseId: string, max = 3, windowMs = 10 * 60 * 1000) {
  const key = `${userId ?? 'anon'}:${courseId}`
  const now = Date.now()
  const arr = windows.get(key) ?? []
  // prune
  const valid = arr.filter((t) => now - t < windowMs)
  if (valid.length >= max) {
    const earliest = valid[0]
    const retryAfterMs = windowMs - (now - earliest)
    const retryAfter = Math.ceil(retryAfterMs / 1000)
    return { allowed: false, retryAfter }
  }
  valid.push(now)
  windows.set(key, valid)
  return { allowed: true, retryAfter: 0 }
}

// For tests / admin: clear limiter state
export function clearExportRateLimits() {
  windows.clear()
}

export default allowExportRequest

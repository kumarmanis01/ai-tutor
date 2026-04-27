const buckets: Map<string, { tokens: number; lastRefill: number }> = new Map()

export function allowRequest(key: string, maxRequests = 5, windowMs = 60_000) {
  const now = Date.now()
  const bucket = buckets.get(key) ?? { tokens: maxRequests, lastRefill: now }
  // refill
  const elapsed = now - bucket.lastRefill
  if (elapsed > 0) {
    const refill = Math.floor(elapsed / windowMs) * maxRequests
    if (refill > 0) {
      bucket.tokens = Math.min(maxRequests, bucket.tokens + refill)
      bucket.lastRefill = now
    }
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1
    buckets.set(key, bucket)
    return true
  }
  buckets.set(key, bucket)
  return false
}

export function clearRateLimit() {
  buckets.clear()
}

const rateLimit = { allowRequest, clearRateLimit }

export default rateLimit

// Small in-memory rate limiter for public endpoints. State is per server
// instance, so it blunts casual abuse rather than stopping a determined one.

const buckets = new Map()
const MAX_KEYS = 5000

export function clientIp(req) {
  const fwd = req.headers && req.headers['x-forwarded-for']
  const first = String(Array.isArray(fwd) ? fwd[0] : fwd || '').split(',')[0].trim()
  return first || (req.socket && req.socket.remoteAddress) || 'unknown'
}

// Returns true when `key` has used up `max` hits inside the last `windowMs`.
export function isRateLimited(key, { max, windowMs }) {
  const now = Date.now()
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
    if (buckets.size > MAX_KEYS) buckets.clear()
  }
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  if (b.count >= max) return true
  b.count++
  return false
}

export function resetRateLimits() {
  buckets.clear()
}

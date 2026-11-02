/**
 * Milliseconds since the epoch from any timestamp shape Bublr has stored:
 * Firestore Timestamps (web SDK), plain { seconds } / { _seconds } maps (the
 * public API used to write those), Dates, numbers and ISO strings.
 * Returns null when there's nothing usable.
 */
export function toMillis(value) {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof Date) return isNaN(value) ? null : value.getTime()
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (typeof value === 'object') {
    const seconds = typeof value.seconds === 'number' ? value.seconds : value._seconds
    const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : value._nanoseconds || 0
    if (typeof seconds === 'number') return seconds * 1000 + Math.floor(nanos / 1e6)
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return isNaN(parsed) ? null : parsed
  }
  return null
}

/** Like toMillis, but returns a Date (or the fallback). */
export function toDateOr(value, fallback = null) {
  const ms = toMillis(value)
  return ms == null ? fallback : new Date(ms)
}

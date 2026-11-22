export const MIN_HEIGHT = 40
export const MAX_HEIGHT = 20000

/**
 * Follows the heights a section's frame reports. A page sized to "100% of
 * the frame plus a bit" (100vh and a margin, say) grows every time the frame
 * does, so after a burst of growth this stops following until the page
 * shrinks again. Returns a function: height in, height to use (or null) out.
 */
export function heightFollower({ start = 0, burst = 25, windowMs = 2000, now = () => Date.now() } = {}) {
  let current = start
  let count = 0
  let since = 0
  let frozen = false
  return function next(value) {
    let h = Math.round(Number(value) || 0)
    if (!Number.isFinite(h)) return null
    h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h))
    if (h > current) {
      const t = now()
      if (t - since > windowMs) {
        since = t
        count = 0
      }
      count += 1
      if (count > burst) frozen = true
      if (frozen) return null
    } else {
      frozen = false
      count = 0
    }
    current = h
    return h
  }
}

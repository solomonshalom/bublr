/**
 * Who has Pro right now, and why.
 *
 * Pure functions (no Firestore) so the dashboard, the API routes and the
 * public pages all agree. The user document carries:
 *
 *   hasCustomDomainAccess  boolean written whenever billing state changes.
 *                          It is rewritten on every billing update, so to
 *                          take Pro away, cancel the subscription in Dodo.
 *   subscription           the billing record (see lib/billing.js), or
 *                          absent for comped accounts.
 *
 * Time matters: a cancelled plan keeps working until the paid period ends and
 * a failed renewal gets a grace period, so access is re-derived from dates on
 * every read instead of trusting the stored boolean alone.
 */

// How long a writer keeps their domain after a renewal payment fails, while
// Dodo retries the card and we email them to update it.
export const PAYMENT_GRACE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

// Dodo statuses that can still change on their own. `cancelled`, `expired` and
// `failed` are final: a new checkout is needed.
export const OPEN_STATUSES = ['pending', 'active', 'on_hold', 'past_due', 'paused']

export function toMs(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof Date) return value.getTime()
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value === 'object' && typeof value._seconds === 'number') return value._seconds * 1000
  if (typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

export function graceEndsAt(fromMs) {
  return new Date(fromMs + PAYMENT_GRACE_DAYS * DAY_MS).toISOString()
}

/**
 * Where a writer's plan stands.
 *
 * state:
 *   'none'      never subscribed
 *   'pending'   checkout started, payment not confirmed yet
 *   'active'    paid and renewing
 *   'canceling' cancelled, still paid up until `accessUntil`
 *   'past_due'  renewal failed; works until `accessUntil`, then stops
 *   'paused'    paused from the billing side
 *   'ended'     cancelled, expired or failed; needs a new checkout
 *
 * @returns {{ hasAccess: boolean, state: string, accessUntil: string|null }}
 */
export function describeSubscription(userData, now = Date.now()) {
  const flag = !!userData?.hasCustomDomainAccess
  const sub = userData?.subscription

  // Comped accounts: the flag alone, no billing record
  if (!sub || typeof sub !== 'object') {
    return { hasAccess: flag, state: flag ? 'active' : 'none', accessUntil: null }
  }

  const periodEnd = toMs(sub.currentPeriodEnd)
  const until = ms => (ms ? new Date(ms).toISOString() : null)

  // Records written before the move to Dodo (Polar): keep the old rule
  if (sub.provider !== 'dodo') {
    if (!flag) return { hasAccess: false, state: 'ended', accessUntil: null }
    if (!sub.cancelAtPeriodEnd || !periodEnd) return { hasAccess: true, state: 'active', accessUntil: null }
    return periodEnd > now
      ? { hasAccess: true, state: 'canceling', accessUntil: until(periodEnd) }
      : { hasAccess: false, state: 'ended', accessUntil: null }
  }

  let result
  switch (sub.status) {
    case 'active':
      if (sub.cancelAtPeriodEnd) {
        result = periodEnd && periodEnd <= now
          ? { hasAccess: false, state: 'ended', accessUntil: null }
          : { hasAccess: true, state: 'canceling', accessUntil: until(periodEnd) }
      } else {
        result = { hasAccess: true, state: 'active', accessUntil: null }
      }
      break
    case 'on_hold':
    case 'past_due': {
      const graceUntil = toMs(sub.graceUntil)
      result = { hasAccess: !!graceUntil && graceUntil > now, state: 'past_due', accessUntil: until(graceUntil) }
      break
    }
    case 'cancelled':
      // Cancelled mid-period (by the writer or by us): they paid up to the
      // next billing date, so the domain keeps working until then.
      result = periodEnd && periodEnd > now
        ? { hasAccess: true, state: 'canceling', accessUntil: until(periodEnd) }
        : { hasAccess: false, state: 'ended', accessUntil: null }
      break
    case 'pending':
      result = { hasAccess: false, state: 'pending', accessUntil: null }
      break
    case 'paused':
      result = { hasAccess: false, state: 'paused', accessUntil: null }
      break
    default:
      // failed, expired, anything unknown
      result = { hasAccess: false, state: 'ended', accessUntil: null }
  }

  // The stored flag can only take access away (e.g. after reconcileAccess),
  // never grant it
  if (!flag && result.hasAccess) {
    return { ...result, hasAccess: false }
  }
  return result
}

/** Does this writer have Pro features right now? */
export function hasActiveAccess(userData, now = Date.now()) {
  return describeSubscription(userData, now).hasAccess
}

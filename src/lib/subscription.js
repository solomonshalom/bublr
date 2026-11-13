import { firestore } from './firebase'
import { toMillis } from './timestamps'
import { isPlanInterval } from './plans'

/**
 * When a cancelled subscription's paid-for time runs out, or null if it isn't
 * cancelled (or has no end date). Until then the writer keeps access.
 *
 * `currentPeriodEnd` comes back from Firestore as a Timestamp, which
 * `new Date()` can't read (it gives Invalid Date, so the period looked over the
 * moment someone cancelled). toMillis reads every shape we've stored.
 */
function gracePeriodEndMillis(userData) {
  if (!userData?.subscription?.cancelAtPeriodEnd) return null
  return toMillis(userData.subscription.currentPeriodEnd)
}

/**
 * Whether the writer has custom domain access right now, counting the time
 * they've already paid for after cancelling. No database access, so it's safe
 * in getServerSideProps and in the browser.
 *
 * @param {Object} userData - User document data from Firestore
 * @returns {boolean}
 */
export function hasActiveAccess(userData) {
  if (!userData?.hasCustomDomainAccess) return false
  const endsAt = gracePeriodEndMillis(userData)
  return endsAt == null || endsAt > Date.now()
}

/**
 * Like hasActiveAccess, and can also switch the access flag off in Firestore
 * once a cancelled subscription has run out.
 *
 * @param {Object} userData - User document data from Firestore
 * @param {string} [userId] - User ID (required for lazy update)
 * @param {boolean} [performLazyUpdate=false] - Whether to update DB if expired
 * @returns {Promise<boolean>} - Whether user currently has access
 */
export async function checkSubscriptionAccess(userData, userId = null, performLazyUpdate = false) {
  if (hasActiveAccess(userData)) return true

  // Had access, but the paid-for time after cancelling is over: revoke it.
  if (userData?.hasCustomDomainAccess && performLazyUpdate && userId) {
    await firestore.collection('users').doc(userId).update({
      hasCustomDomainAccess: false,
    })
  }

  return false
}

/**
 * True when a cancelled subscription's paid-for time has ended but the access
 * flag hasn't been switched off yet.
 */
export function gracePeriodExpired(userData) {
  if (!userData?.hasCustomDomainAccess) return false
  const endsAt = gracePeriodEndMillis(userData)
  return endsAt != null && endsAt <= Date.now()
}

/**
 * True while a subscription is live with Polar and the writer has access, so
 * starting another checkout would bill them twice. Changing plans goes through
 * the billing portal instead.
 */
export function hasLiveSubscription(userData) {
  const status = userData?.subscription?.status
  return ['active', 'trialing'].includes(status) && hasActiveAccess(userData)
}

/**
 * The subscription as the dashboard needs it: dates as milliseconds (a raw
 * Firestore Timestamp turns into `{ seconds, nanoseconds }` in JSON) and the
 * billing interval as 'month' | 'year' | null.
 */
export function serializeSubscription(subscription) {
  if (!subscription) return null
  return {
    ...subscription,
    interval: isPlanInterval(subscription.interval) ? subscription.interval : null,
    currentPeriodStart: toMillis(subscription.currentPeriodStart),
    currentPeriodEnd: toMillis(subscription.currentPeriodEnd),
    cancelAtPeriodEnd: !!subscription.cancelAtPeriodEnd,
  }
}

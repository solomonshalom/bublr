import { firestore } from './firebase'

/**
 * Check if user has active subscription access, accounting for grace periods.
 * Optionally performs lazy database update if grace period has expired.
 *
 * @param {Object} userData - User document data from Firestore
 * @param {string} [userId] - User ID (required for lazy update)
 * @param {boolean} [performLazyUpdate=false] - Whether to update DB if expired
 * @returns {Promise<boolean>} - Whether user currently has access
 */
export async function checkSubscriptionAccess(userData, userId = null, performLazyUpdate = false) {
  // No access if flag is false
  if (!userData.hasCustomDomainAccess) {
    return false
  }

  // If not in cancellation grace period, access is valid
  if (!userData.subscription?.cancelAtPeriodEnd) {
    return true
  }

  // Check if grace period has expired
  const periodEnd = userData.subscription.currentPeriodEnd
  if (!periodEnd) {
    return true // No end date means access continues
  }

  if (periodEndMillis(periodEnd) > Date.now()) {
    // Still within grace period
    return true
  }

  // Grace period expired - revoke access
  if (performLazyUpdate && userId) {
    await firestore.collection('users').doc(userId).update({
      hasCustomDomainAccess: false,
    })
  }

  return false
}

/**
 * Synchronous version for SSR (no lazy update, just checks dates)
 * Use this in getServerSideProps where async DB updates aren't ideal
 *
 * @param {Object} userData - User document data from Firestore
 * @returns {boolean} - Whether user currently has access
 */
export function hasActiveAccess(userData) {
  if (!userData.hasCustomDomainAccess) {
    return false
  }

  if (!userData.subscription?.cancelAtPeriodEnd) {
    return true
  }

  const periodEnd = userData.subscription?.currentPeriodEnd
  if (!periodEnd) {
    return true
  }

  return periodEndMillis(periodEnd) > Date.now()
}

// currentPeriodEnd can be a Date, an ISO string or a Firestore Timestamp.
function periodEndMillis(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis()
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : 0
}

/**
 * Whether the writer's shop is open: an active subscription (grace period
 * included) on the Pro + Shop plan. `hasShopAccess` is written by the
 * subscription webhook from the plan's product ID.
 *
 * @param {Object} userData - User document data from Firestore
 * @returns {boolean}
 */
export function hasActiveShopAccess(userData) {
  if (!userData || userData.hasShopAccess !== true) return false
  return hasActiveAccess(userData)
}

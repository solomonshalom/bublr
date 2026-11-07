import firebase, { firestore } from './firebase'
import { describeSubscription, graceEndsAt, toMs, OPEN_STATUSES } from './subscription'
import { dodoConfig, getSubscription, updateSubscription, isBillingConfigured } from './dodo'
import { sendSubscriptionEmail } from './resend'
import { PRO_PLAN } from './pricing'

/**
 * Bublr Pro billing state, kept on the writer's user document.
 *
 *   subscription: {
 *     provider: 'dodo', id, status, customerId, customerEmail, productId,
 *     currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, cancelledAt,
 *     graceUntil, environment, updatedAt, lastSyncedAt, duplicateIds?
 *   }
 *   hasCustomDomainAccess: boolean
 *   pendingCheckout: { sessionId, email, createdAt }   while a checkout is open
 *
 * Dodo webhooks can arrive late, twice or out of order, and the buyer usually
 * lands back on Bublr before the webhook does. So every path (webhook, the
 * post-checkout sync, the periodic refresh) funnels a Dodo subscription object
 * through applyDodoSubscription(), which writes the latest state in a
 * transaction and emails the writer only when the state actually changed.
 */

// How long a started checkout can be matched to its subscription by email,
// for the case where Dodo doesn't carry our metadata over.
const PENDING_CHECKOUT_TTL_MS = 3 * 24 * 60 * 60 * 1000
// The status endpoint re-reads open subscriptions from Dodo at most this often
export const REFRESH_AFTER_MS = 10 * 60 * 1000

const users = () => firestore.collection('users')
const lower = value => String(value || '').trim().toLowerCase()
const isoOrNull = value => {
  const ms = toMs(value)
  return ms === null ? null : new Date(ms).toISOString()
}

/** Product IDs that count as Bublr Pro. The first one is sold at checkout. */
export function proProductIds() {
  return dodoConfig()
    .productId.split(',')
    .map(id => id.trim())
    .filter(Boolean)
}

export function isProProduct(productId) {
  const ids = proProductIds()
  // Nothing configured: don't filter (tests, or a half-set-up environment)
  return ids.length === 0 || !productId || ids.includes(productId)
}

function pendingCheckoutMatches(sub, userData, now) {
  const pending = userData?.pendingCheckout
  if (!pending?.email || !sub?.customer?.email) return false
  if (lower(pending.email) !== lower(sub.customer.email)) return false
  const startedAt = toMs(pending.createdAt)
  if (!startedAt || now - startedAt > PENDING_CHECKOUT_TTL_MS) return false
  // The subscription can't predate the checkout we started (10 min of slack for clocks)
  const createdAt = toMs(sub.created_at)
  return !createdAt || createdAt >= startedAt - 10 * 60 * 1000
}

/**
 * Is this Dodo subscription this writer's? Used before linking one to an
 * account, so nobody can attach (or cancel) somebody else's subscription.
 */
export function subscriptionBelongsTo(sub, userId, userData, now = Date.now()) {
  if (!sub || !userId) return false
  if (sub.metadata?.userId) return sub.metadata.userId === userId
  const current = userData?.subscription
  if (current?.id && current.id === sub.subscription_id) return true
  if (!isProProduct(sub.product_id)) return false
  if (current?.customerId && current.customerId === sub.customer?.customer_id) return true
  return pendingCheckoutMatches(sub, userData, now)
}

/** Find the writer a subscription belongs to: metadata, then known IDs, then the open checkout. */
export async function findUserForSubscription(sub, now = Date.now()) {
  const metaUserId = sub?.metadata?.userId
  if (metaUserId) {
    const doc = await users().doc(String(metaUserId)).get()
    return doc.exists ? { id: doc.id, data: doc.data(), matchedBy: 'metadata' } : null
  }

  const byId = await users().where('subscription.id', '==', sub.subscription_id).limit(1).get()
  if (!byId.empty) return { id: byId.docs[0].id, data: byId.docs[0].data(), matchedBy: 'subscription' }

  if (!isProProduct(sub.product_id)) return null

  const customerId = sub.customer?.customer_id
  if (customerId) {
    const byCustomer = await users().where('subscription.customerId', '==', customerId).limit(1).get()
    if (!byCustomer.empty) return { id: byCustomer.docs[0].id, data: byCustomer.docs[0].data(), matchedBy: 'customer' }
  }

  const email = lower(sub.customer?.email)
  if (email) {
    const byEmail = await users().where('pendingCheckout.email', '==', email).limit(2).get()
    // Two writers with the same billing email: too ambiguous to guess
    if (byEmail.size === 1 && pendingCheckoutMatches(sub, byEmail.docs[0].data(), now)) {
      return { id: byEmail.docs[0].id, data: byEmail.docs[0].data(), matchedBy: 'checkout-email' }
    }
  }
  return null
}

/** The billing record we store for a Dodo subscription object. */
export function buildSubscriptionRecord(sub, previous, now = Date.now()) {
  const status = String(sub.status || 'pending')
  const sameSubscription = previous?.provider === 'dodo' && previous?.id === sub.subscription_id
  const wasInTrouble = sameSubscription && ['on_hold', 'past_due'].includes(previous?.status)

  let graceUntil = null
  if (status === 'past_due' && sub.past_due_ends_at) {
    graceUntil = isoOrNull(sub.past_due_ends_at)
  } else if (status === 'on_hold' || status === 'past_due') {
    // Start the clock the first time we see the failure, and keep it there
    graceUntil = wasInTrouble && previous.graceUntil ? previous.graceUntil : graceEndsAt(now)
  }

  const record = {
    provider: 'dodo',
    id: String(sub.subscription_id),
    status,
    customerId: sub.customer?.customer_id || (sameSubscription ? previous.customerId : null) || null,
    customerEmail: sub.customer?.email || null,
    productId: sub.product_id || null,
    currentPeriodStart: isoOrNull(sub.previous_billing_date),
    currentPeriodEnd: isoOrNull(sub.next_billing_date),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_next_billing_date),
    cancelledAt: isoOrNull(sub.cancelled_at),
    graceUntil,
    environment: dodoConfig().environment,
    updatedAt: new Date(now).toISOString(),
    lastSyncedAt: new Date(now).toISOString(),
  }
  if (sameSubscription && Array.isArray(previous.duplicateIds)) record.duplicateIds = previous.duplicateIds
  return record
}

/** Which email (if any) a change from `before` to `after` deserves. */
export function transitionEmail(before, after) {
  if (!before.hasAccess && after.hasAccess && after.state === 'active') return { type: 'activated' }
  if (before.state === 'active' && after.state === 'canceling') return { type: 'canceled', periodEndDate: after.accessUntil }
  if (before.state === 'canceling' && after.state === 'active') return { type: 'resumed' }
  if (['active', 'canceling'].includes(before.state) && after.state === 'past_due') {
    return { type: 'payment_failed', periodEndDate: after.accessUntil }
  }
  if (before.hasAccess && !after.hasAccess) return { type: 'expired' }
  return null
}

async function notify(userData, sub, email) {
  if (!email) return
  const to = userData?.email || sub?.customer?.email
  if (!to) return
  try {
    await sendSubscriptionEmail({
      userEmail: to,
      userName: userData?.displayName || userData?.name,
      ...email,
    })
  } catch (error) {
    console.error('Subscription email failed:', error)
  }
}

/**
 * Store the latest state of a Dodo subscription on its writer.
 *
 * @param {object} sub      Dodo subscription object (webhook `data` or GET /subscriptions/:id)
 * @param {object} options  { userId } when the caller already proved ownership
 * @returns {Promise<{ applied: boolean, reason?: string, userId?: string, before?: object, after?: object, email?: object }>}
 */
export async function applyDodoSubscription(sub, { userId = null, source = 'webhook', now = Date.now() } = {}) {
  if (!sub?.subscription_id) return { applied: false, reason: 'not-a-subscription' }

  let target = null
  if (userId) {
    const doc = await users().doc(userId).get()
    if (doc.exists) target = { id: doc.id, data: doc.data(), matchedBy: 'caller' }
  } else {
    target = await findUserForSubscription(sub, now)
  }
  if (!target) {
    console.warn(`Dodo subscription ${sub.subscription_id} (${source}) matched no writer`)
    return { applied: false, reason: 'no-user' }
  }

  const ref = users().doc(target.id)
  const outcome = await firestore.runTransaction(async tx => {
    const snap = await tx.get(ref)
    if (!snap.exists) return { applied: false, reason: 'no-user' }
    const userData = snap.data()
    const current = userData.subscription
    const before = describeSubscription(userData, now)

    // A different subscription than the one on file
    if (current?.provider === 'dodo' && current.id && current.id !== String(sub.subscription_id)) {
      if (sub.status !== 'active') {
        // An old, abandoned or failed one: nothing to change
        return { applied: false, reason: 'other-subscription', userId: target.id }
      }
      if (before.state === 'active') {
        // Two healthy subscriptions (double checkout). Keep the first and
        // note the extra one so it can be refunded from the Dodo dashboard.
        tx.update(ref, {
          'subscription.duplicateIds': firebase.firestore.FieldValue.arrayUnion(String(sub.subscription_id)),
        })
        console.warn(`Writer ${target.id} has a second active Pro subscription: ${sub.subscription_id}`)
        return { applied: false, reason: 'duplicate-subscription', userId: target.id }
      }
      // Otherwise it's a re-subscription replacing an ended/ending one
    }

    const record = buildSubscriptionRecord(sub, current, now)
    const after = describeSubscription({ ...userData, hasCustomDomainAccess: true, subscription: record }, now)
    const update = { subscription: record, hasCustomDomainAccess: after.hasAccess }
    if (record.status !== 'pending' && userData.pendingCheckout) {
      update.pendingCheckout = firebase.firestore.FieldValue.delete()
    }
    tx.update(ref, update)
    return { applied: true, userId: target.id, before, after, userData }
  })

  if (!outcome.applied) return outcome

  const email = transitionEmail(outcome.before, outcome.after)
  await notify(outcome.userData, sub, email)

  // Tag the subscription with the writer so later webhooks match directly
  if (target.matchedBy !== 'metadata' && sub.metadata?.userId !== target.id && isBillingConfigured()) {
    try {
      await updateSubscription(sub.subscription_id, { metadata: { ...(sub.metadata || {}), userId: target.id } })
    } catch (error) {
      console.warn('Could not tag Dodo subscription with its writer:', error.message)
    }
  }

  const { userData, ...result } = outcome
  return { ...result, email }
}

/**
 * Re-read an open subscription from Dodo when our copy may be stale (a missed
 * webhook, a renewal that should have happened). Never throws.
 */
export async function refreshSubscription(userId, userData, { force = false, now = Date.now() } = {}) {
  const sub = userData?.subscription
  if (!sub || sub.provider !== 'dodo' || !sub.id || !isBillingConfigured()) return null
  if (!force) {
    if (!OPEN_STATUSES.includes(sub.status)) return null
    const lastSynced = toMs(sub.lastSyncedAt)
    if (lastSynced && now - lastSynced < REFRESH_AFTER_MS) return null
  }
  try {
    const fresh = await getSubscription(sub.id)
    return await applyDodoSubscription(fresh, { userId, source: 'refresh', now })
  } catch (error) {
    console.warn(`Could not refresh subscription ${sub.id}:`, error.message)
    return null
  }
}

/**
 * When a paid period or grace period has run out without a webhook telling
 * us, turn the stored flag off and say goodbye once. Never throws.
 */
export async function reconcileAccess(userId, now = Date.now()) {
  const ref = users().doc(userId)
  try {
    const outcome = await firestore.runTransaction(async tx => {
      const snap = await tx.get(ref)
      if (!snap.exists) return null
      const data = snap.data()
      if (!data.hasCustomDomainAccess || describeSubscription(data, now).hasAccess) return null
      tx.update(ref, { hasCustomDomainAccess: false })
      return data
    })
    if (outcome) await notify(outcome, null, { type: 'expired' })
    return Boolean(outcome)
  } catch (error) {
    console.warn('Could not reconcile Pro access:', error.message)
    return false
  }
}

/** What the dashboard needs to draw the Pro / custom domain page. */
export function statusPayload(userData, { domainsConfigured = false, now = Date.now() } = {}) {
  const described = describeSubscription(userData, now)
  const sub = userData?.subscription
  const domain = userData?.customDomain
  const pending = userData?.pendingCheckout
  const pendingAt = toMs(pending?.createdAt)

  return {
    plan: {
      name: PRO_PLAN.name,
      price: PRO_PLAN.price,
      interval: PRO_PLAN.interval,
      priceLabel: PRO_PLAN.priceLabel,
    },
    billingConfigured: isBillingConfigured(),
    domainsConfigured,
    hasCustomDomainAccess: described.hasAccess,
    state: described.state,
    accessUntil: described.accessUntil,
    checkoutPending: Boolean(pendingAt && now - pendingAt < PENDING_CHECKOUT_TTL_MS),
    subscription: sub
      ? {
          provider: sub.provider || 'polar',
          status: sub.status || null,
          cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
          currentPeriodEnd: isoOrNull(sub.currentPeriodEnd),
          graceUntil: sub.graceUntil || null,
          canManageBilling: sub.provider === 'dodo' && Boolean(sub.customerId),
        }
      : null,
    customDomain: domain?.domain
      ? {
          domain: domain.domain,
          companion: domain.companion || null,
          status: domain.status || 'pending',
          records: Array.isArray(domain.records) ? domain.records : [],
          message: domain.message || null,
          addedAt: domain.addedAt || null,
          verifiedAt: domain.verifiedAt || null,
          lastCheckedAt: domain.lastCheckedAt || null,
        }
      : null,
    customBranding: userData?.customBranding || null,
    newsletterTemplate: userData?.newsletterTemplate || null,
  }
}

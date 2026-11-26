import { firestore } from './firebase'
import { hashId, open, seal, signValues, verifyValues } from './secret-box'
import { PROVIDERS, formatPrice } from './shop'
import { paymentKey } from './shop-server'
import { hasVerifiedShopAccess } from './shop-trust'
import { isPending, subscriberEmail } from './subscribers'
import { INTERVALS, cancelAtPeriodEnd, resumeSubscription, retrieveSubscription } from './newsletter-payments'

/**
 * Paid newsletters (Pro + Shop plan). A writer sets a monthly price (and,
 * if they like, a yearly one); readers subscribe through the writer's own
 * Stripe or Creem account and get the writer's paid posts. Bublr takes no cut.
 *
 * Everything here lives in the writer's user document, which anyone can
 * write to without signing in (see lib/shop-trust). So nothing is trusted
 * unless the server signed it:
 *
 *   paidNewsletter            { enabled, currency, monthly, yearly,
 *                               description, teaseFree, updatedAt, sig }
 *   subscribers[i].paid       { provider, mode, interval, amount, currency,
 *                               status, currentPeriodEnd, cancelAtPeriodEnd,
 *                               startedAt, checkedAt, checkoutHash, ref, sig }
 *
 * `ref` holds the provider's subscription and customer IDs, sealed. A paid
 * record is written only after the provider says the checkout was paid, and
 * its status is checked with the provider again whenever its period has run
 * out (renewals, failed payments and cancellations made elsewhere).
 */

export const MIN_PAID_PRICE = 100 // $1: Creem's lowest price, and above Stripe's
export const MAX_PAID_PRICE = 100000 // $1,000
export const MAX_DESCRIPTION = 280

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

// A renewal can take a little while to go through; keep access meanwhile.
const RENEWAL_GRACE_MS = 3 * DAY
// Stripe and Creem retry a failed renewal for about a week.
const PAST_DUE_GRACE_MS = 7 * DAY
// Don't ask the provider about the same subscription more often than this.
const REFRESH_EVERY_MS = 10 * MINUTE

export class PaidNewsletterError extends Error {
  constructor(message, status = 400, code = null) {
    super(message)
    this.name = 'PaidNewsletterError'
    this.status = status
    this.code = code
  }
}

// ------------------------------------------------------------ settings

function settingsValues(uid, s) {
  return [uid, s.enabled === true, s.currency, s.monthly, s.yearly ?? '', s.description || '', s.teaseFree !== false, s.updatedAt]
}

/** Check and clean what the writer typed. Throws PaidNewsletterError. */
export function normalizePaidSettings(raw, { provider } = {}) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const currency = String(input.currency || 'usd').toLowerCase()
  const allowed = PROVIDERS[provider]?.currencies || PROVIDERS.stripe.currencies
  if (!allowed.includes(currency)) {
    throw new PaidNewsletterError(
      provider === 'creem' ? 'Creem takes USD or EUR.' : 'Choose one of the listed currencies.'
    )
  }
  const price = (value, label, { optional = false } = {}) => {
    if ((value === null || value === undefined || value === '') && optional) return null
    const n = typeof value === 'string' ? Number(value) : value
    if (!Number.isInteger(n)) throw new PaidNewsletterError(`Enter a ${label} price.`)
    if (n < MIN_PAID_PRICE) throw new PaidNewsletterError(`The ${label} price must be at least ${formatPrice(MIN_PAID_PRICE, currency)}.`)
    if (n > MAX_PAID_PRICE) throw new PaidNewsletterError(`The ${label} price can be at most ${formatPrice(MAX_PAID_PRICE, currency)}.`)
    return n
  }
  const monthly = price(input.monthly, 'monthly')
  const yearly = price(input.yearly, 'yearly', { optional: true })
  const description = typeof input.description === 'string'
    ? input.description.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, MAX_DESCRIPTION)
    : ''
  return {
    enabled: input.enabled !== false,
    currency,
    monthly,
    yearly,
    description,
    teaseFree: input.teaseFree !== false,
  }
}

/** The settings with the server's signature, ready to store as `paidNewsletter`. */
export function signedPaidSettings(uid, settings, { now = Date.now() } = {}) {
  const s = { ...settings, updatedAt: now }
  return { ...s, sig: signValues('paid-newsletter', settingsValues(uid, s)) }
}

/** The writer's paid newsletter settings, if the server saved them; otherwise null. */
export function trustedPaidSettings(user) {
  const s = user?.paidNewsletter
  if (!s || typeof s !== 'object' || !user.id) return null
  if (!verifyValues('paid-newsletter', settingsValues(user.id, s), s.sig)) return null
  return {
    enabled: s.enabled === true,
    currency: s.currency,
    monthly: s.monthly,
    yearly: Number.isInteger(s.yearly) ? s.yearly : null,
    description: s.description || '',
    teaseFree: s.teaseFree !== false,
  }
}

/** Whether this writer can publish paid posts. */
export function canPublishPaid(user) {
  if (!hasVerifiedShopAccess(user)) return false
  return trustedPaidSettings(user)?.enabled === true
}

/**
 * Whether readers can start a paid subscription right now: the plan is on,
 * paid subscriptions are turned on and a payment account that takes the
 * currency is connected. Returns the settings and provider, or null.
 */
export function openForSubscriptions(user) {
  if (!canPublishPaid(user)) return null
  const settings = trustedPaidSettings(user)
  const payments = user.integrations?.payments
  if (!payments?.keySealed || !PROVIDERS[payments.provider]) return null
  if (!PROVIDERS[payments.provider].currencies.includes(settings.currency)) return null
  return { settings, provider: payments.provider, mode: payments.mode || 'live' }
}

export const priceFor = (settings, interval) => (interval === 'year' ? settings?.yearly : settings?.monthly) || null

/** What readers see about the paid plan (page props, paywall card). */
export function publicPaidPlan(user) {
  const open = openForSubscriptions(user)
  const settings = trustedPaidSettings(user)
  if (!settings) return null
  return {
    open: Boolean(open),
    testMode: open?.mode === 'test',
    currency: settings.currency,
    monthly: settings.monthly,
    yearly: settings.yearly,
    description: settings.description,
  }
}

// ------------------------------------------------------------ subscriber records

const norm = email => String(email || '').trim().toLowerCase()
const refContext = (uid, email) => `${uid}:paid-subscriber:${norm(email)}`

function recordValues(uid, email, p) {
  return [
    uid,
    norm(email),
    p.provider,
    p.mode,
    p.interval,
    p.amount,
    p.currency,
    p.status,
    p.currentPeriodEnd ?? '',
    p.cancelAtPeriodEnd === true,
    p.startedAt,
    p.checkedAt ?? '',
    p.checkoutHash || '',
    p.ref || '',
  ]
}

export function signPaidRecord(uid, email, fields) {
  const record = {
    provider: fields.provider,
    mode: fields.mode === 'test' ? 'test' : 'live',
    interval: INTERVALS.includes(fields.interval) ? fields.interval : 'month',
    amount: Number.isFinite(fields.amount) ? fields.amount : null,
    currency: fields.currency ? String(fields.currency).toLowerCase() : null,
    status: fields.status,
    currentPeriodEnd: Number.isFinite(fields.currentPeriodEnd) ? fields.currentPeriodEnd : null,
    cancelAtPeriodEnd: fields.cancelAtPeriodEnd === true,
    startedAt: fields.startedAt,
    checkedAt: Number.isFinite(fields.checkedAt) ? fields.checkedAt : null,
    checkoutHash: fields.checkoutHash || null,
    ref: fields.ref || null,
  }
  return { ...record, sig: signValues('paid-subscriber', recordValues(uid, email, record)) }
}

/** A subscriber entry's paid record, if the server wrote it; otherwise null. */
export function verifiedPaid(uid, entry) {
  const paid = entry && typeof entry === 'object' ? entry.paid : null
  if (!paid || typeof paid !== 'object' || !uid) return null
  return verifyValues('paid-subscriber', recordValues(uid, subscriberEmail(entry), paid), paid.sig) ? paid : null
}

export function sealSubscriptionRef(uid, email, { subscriptionId, customerId }) {
  return seal(JSON.stringify({ s: subscriptionId || null, c: customerId || null }), refContext(uid, email))
}

export function openSubscriptionRef(uid, email, paid) {
  const text = paid?.ref ? open(paid.ref, refContext(uid, email)) : null
  if (!text) return null
  try {
    const { s, c } = JSON.parse(text)
    return { subscriptionId: s || null, customerId: c || null }
  } catch (_) {
    return null
  }
}

/**
 * Whether a paid record lets its reader in at `now`. A record made with a
 * test key counts only while a test key is connected, so a test card never
 * unlocks anything once the writer goes live.
 */
export function paidAccess(paid, { now = Date.now(), currentMode = 'live' } = {}) {
  if (!paid) return false
  if (paid.mode === 'test' && currentMode !== 'test') return false
  const end = Number.isFinite(paid.currentPeriodEnd) ? paid.currentPeriodEnd : 0
  if (paid.cancelAtPeriodEnd || paid.status === 'canceled') return now < end
  switch (paid.status) {
    case 'active':
    case 'trialing':
      return now < end + RENEWAL_GRACE_MS
    case 'past_due':
      return now < end + PAST_DUE_GRACE_MS
    default:
      return false
  }
}

/** For screens: 'active', 'ending' (cancelled, paid up until the end), 'past_due' or 'ended'. */
export function paidState(paid, { now = Date.now(), currentMode = 'live' } = {}) {
  if (!paidAccess(paid, { now, currentMode })) return 'ended'
  if (paid.cancelAtPeriodEnd || paid.status === 'canceled') return 'ending'
  if (paid.status === 'past_due') return 'past_due'
  return 'active'
}

/** Whether the subscription will charge the reader again. */
export function isRenewing(paid, { now = Date.now() } = {}) {
  if (!paid || paid.cancelAtPeriodEnd) return false
  if (!['active', 'trialing', 'past_due'].includes(paid.status)) return false
  // A renewal long overdue and never confirmed has most likely stopped.
  return now < (paid.currentPeriodEnd || 0) + PAST_DUE_GRACE_MS * 2
}

/** Whether to ask the provider: the period the record knows about has run out. */
export function needsRefresh(paid, { now = Date.now() } = {}) {
  if (!paid) return false
  if (!['active', 'trialing', 'past_due'].includes(paid.status)) return false
  if (now < (paid.currentPeriodEnd || 0)) return false
  return now - (paid.checkedAt || 0) > REFRESH_EVERY_MS
}

export const findSubscriber = (user, email) => {
  const target = norm(email)
  return (Array.isArray(user?.subscribers) ? user.subscribers : []).find(sub => subscriberEmail(sub) === target) || null
}

/** Every subscriber with a verified paid record: [{ entry, email, paid }]. */
export function paidSubscribers(user) {
  const list = Array.isArray(user?.subscribers) ? user.subscribers : []
  const out = []
  for (const entry of list) {
    const paid = verifiedPaid(user.id, entry)
    if (paid) out.push({ entry, email: subscriberEmail(entry), paid })
  }
  return out
}

/** Paid subscribers whose subscription will charge them again (live mode). */
export function renewingPaidSubscribers(user, { now = Date.now() } = {}) {
  return paidSubscribers(user).filter(({ paid }) => paid.mode === 'live' && isRenewing(paid, { now }))
}

export const describePrice = (amount, currency, interval) =>
  amount ? `${formatPrice(amount, currency)}/${interval === 'year' ? 'year' : 'month'}` : ''

// ------------------------------------------------------------ writing records

/**
 * Write one subscriber's paid record in a transaction: `build(entry)` gets the
 * subscriber's current entry (or null) and returns the new paid record, or
 * null to leave things as they are. A reader who isn't on the list yet is
 * added (already confirmed: they paid with this address).
 */
export async function writePaidRecord(uid, email, build, { now = Date.now() } = {}) {
  const target = norm(email)
  const userRef = firestore.collection('users').doc(uid)
  return firestore.runTransaction(async transaction => {
    const snapshot = await transaction.get(userRef)
    if (!snapshot.exists) return null
    const subscribers = Array.isArray(snapshot.data().subscribers) ? snapshot.data().subscribers : []
    const index = subscribers.findIndex(sub => subscriberEmail(sub) === target)
    const entry = index >= 0 ? subscribers[index] : null
    const previous = entry ? verifiedPaid(uid, entry) : null
    const paid = build(entry)
    if (!paid) return { paid: previous, previous, entry, written: false }
    const base = entry && typeof entry === 'object' ? entry : { email: target, subscribedAt: new Date(now).toISOString() }
    const { pending, lastRequestedAt, ...rest } = base
    const next = {
      ...rest,
      email: target,
      ...(isPending(base) || !entry ? { confirmedAt: new Date(now).toISOString() } : {}),
      paid,
    }
    const updated = index >= 0 ? subscribers.map((sub, i) => (i === index ? next : sub)) : [...subscribers, next]
    transaction.update(userRef, { subscribers: updated })
    return { paid, previous, entry: next, written: true }
  })
}

/** A new record from what the provider says about a subscription. */
export function recordFromSubscription(uid, email, { previous = null, provider, mode, subscription, interval, amount, currency, checkoutHash, startedAt, ref, now = Date.now() }) {
  return signPaidRecord(uid, email, {
    provider,
    mode,
    interval: subscription?.interval || interval || previous?.interval,
    amount: Number.isFinite(subscription?.amount) ? subscription.amount : amount ?? previous?.amount,
    currency: subscription?.currency || currency || previous?.currency,
    status: subscription?.status || 'incomplete',
    currentPeriodEnd: subscription?.currentPeriodEnd ?? previous?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd === true,
    startedAt: startedAt ?? previous?.startedAt ?? now,
    checkedAt: now,
    checkoutHash: checkoutHash ?? previous?.checkoutHash ?? null,
    ref: ref ?? previous?.ref ?? null,
  })
}

/**
 * Ask the provider about a subscriber's subscription and store the answer.
 * Returns the current record (unchanged when the provider can't be asked:
 * no key connected, another account connected now, or it didn't answer).
 */
export async function refreshPaidSubscriber(user, email, { now = Date.now() } = {}) {
  const entry = findSubscriber(user, email)
  const paid = verifiedPaid(user.id, entry)
  if (!paid) return null
  const apiKey = paymentKey(user)
  const payments = user.integrations?.payments
  if (!apiKey || payments?.provider !== paid.provider || (payments.mode || 'live') !== paid.mode) return paid
  const ref = openSubscriptionRef(user.id, email, paid)
  if (!ref?.subscriptionId) return paid

  let subscription
  try {
    subscription = await retrieveSubscription(paid.provider, { apiKey, subscriptionId: ref.subscriptionId })
  } catch (error) {
    // Gone from this account (deleted, or the writer connected another one).
    if (error?.status === 404) subscription = { status: 'ended', currentPeriodEnd: paid.currentPeriodEnd, cancelAtPeriodEnd: false }
    else {
      console.error('Paid newsletter: could not check a subscription:', error?.status, error?.message)
      return paid
    }
  }
  const result = await writePaidRecord(user.id, email, current => {
    const before = verifiedPaid(user.id, current)
    if (!before || before.sig !== paid.sig) return null // changed meanwhile
    return recordFromSubscription(user.id, email, { previous: before, provider: before.provider, mode: before.mode, subscription, now })
  }, { now })
  return result?.paid || paid
}

/**
 * Whether `email` may read this writer's paid posts now, asking the provider
 * first if the record's period has run out.
 */
export async function readerHasPaidAccess(user, email, { now = Date.now() } = {}) {
  if (!user || !email) return false
  const currentMode = user.integrations?.payments?.mode || 'live'
  let paid = verifiedPaid(user.id, findSubscriber(user, email))
  if (!paid) return false
  if (needsRefresh(paid, { now })) paid = await refreshPaidSubscriber(user, email, { now })
  return paidAccess(paid, { now, currentMode })
}

/** Stop a subscriber's renewals (at the end of the paid period). Throws PaidNewsletterError. */
export async function setPaidRenewal(user, email, { renew, now = Date.now() }) {
  const entry = findSubscriber(user, email)
  const paid = verifiedPaid(user.id, entry)
  if (!paid) throw new PaidNewsletterError('There’s no paid subscription for this address.', 404)
  const apiKey = paymentKey(user)
  const payments = user.integrations?.payments
  if (!apiKey || payments?.provider !== paid.provider || (payments.mode || 'live') !== paid.mode) {
    throw new PaidNewsletterError(
      'The writer’s payment account isn’t connected to Bublr right now, so this can’t be changed here.',
      409,
      'PAYMENTS_DISCONNECTED'
    )
  }
  const ref = openSubscriptionRef(user.id, email, paid)
  if (!ref?.subscriptionId) throw new PaidNewsletterError('This subscription can’t be found.', 404)
  const change = renew ? resumeSubscription : cancelAtPeriodEnd
  const subscription = await change(paid.provider, { apiKey, subscriptionId: ref.subscriptionId })
  const result = await writePaidRecord(user.id, email, current => {
    const before = verifiedPaid(user.id, current)
    if (!before) return null
    return recordFromSubscription(user.id, email, { previous: before, provider: before.provider, mode: before.mode, subscription, now })
  }, { now })
  return result?.paid || paid
}

export const emailHash = email => hashId(norm(email)).slice(0, 16)

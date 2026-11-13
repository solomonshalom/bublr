// The custom domain subscription: monthly and yearly plans, the checkout that
// starts one, the Polar webhook that records it, and how long access lasts.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { installTestCerts, authHeader, call, mockRes } from './helpers.mjs'
import { resetStore, seed, read, Timestamp } from './mocks/firebase.mjs'
import { sent, resetSent } from './mocks/resend.mjs'
import { checkouts, portalSessions, resetPolar, VALID_SIGNATURE } from './mocks/polar.mjs'
import { PLANS, yearlySavings, planPriceLabel, formatUsd, isPlanInterval } from '../../src/lib/plans.js'
import {
  hasActiveAccess,
  checkSubscriptionAccess,
  hasLiveSubscription,
  serializeSubscription,
} from '../../src/lib/subscription.js'

const MONTHLY_PRODUCT = 'prod_monthly'
const YEARLY_PRODUCT = 'prod_yearly'
process.env.POLAR_WEBHOOK_SECRET = 'test-webhook-secret' // read once, when the webhook route loads

const api = async route => (await import(`../../src/pages/api/${route}.js`)).default
const createCheckout = await api('subscription/create-checkout')
const status = await api('subscription/status')
const portal = await api('subscription/portal')
const webhook = await api('subscription/webhook')

const DAY = 24 * 60 * 60 * 1000
const inDays = days => new Date(Date.now() + days * DAY)

beforeEach(() => {
  installTestCerts()
  resetStore()
  resetSent()
  resetPolar()
  process.env.POLAR_CUSTOM_DOMAIN_PRODUCT_ID = MONTHLY_PRODUCT
  process.env.POLAR_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID = YEARLY_PRODUCT
  seed('users', 'alice', { name: 'alice', displayName: 'Alice', email: 'alice@example.com', posts: [] })
  seed('users', 'bob', { name: 'bob', displayName: 'Bob', email: 'bob@example.com', posts: [] })
})

const POST = (headers, body) => ({ method: 'POST', headers, body })
const checkoutBody = extra => ({ userId: 'alice', userEmail: 'alice@example.com', userName: 'alice', ...extra })

// The webhook route reads the raw request stream to check the signature.
async function deliver(event, { signature = VALID_SIGNATURE } = {}) {
  const body = JSON.stringify(event)
  const req = {
    method: 'POST',
    headers: { 'webhook-signature': signature },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body)
    },
  }
  const res = mockRes()
  await webhook(req, res)
  return res
}

const subscriptionEvent = (type, data) => ({
  type,
  data: {
    id: 'sub_1',
    status: 'active',
    customerId: 'cus_1',
    productId: MONTHLY_PRODUCT,
    recurringInterval: 'month',
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: inDays(30).toISOString(),
    cancelAtPeriodEnd: false,
    metadata: { userId: 'alice' },
    ...data,
  },
})

// ---- prices ----

test('plans: $2 a month or $18 a year, and the saving is worked out from them', () => {
  assert.equal(PLANS.month.price, 2)
  assert.equal(PLANS.year.price, 18)
  assert.equal(planPriceLabel('month'), '$2/month')
  assert.equal(planPriceLabel('year'), '$18/year')
  assert.deepEqual(yearlySavings(), { twelveMonths: 24, amount: 6, percent: 25, perMonth: 1.5 })
  assert.equal(formatUsd(yearlySavings().perMonth), '$1.50')
  assert.equal(isPlanInterval('year'), true)
  assert.equal(isPlanInterval('week'), false)
  assert.equal(isPlanInterval(undefined), false)
})

// ---- checkout ----

test('checkout: needs a sign-in, and only for your own account', async () => {
  const anonymous = await call(createCheckout, POST({}, checkoutBody()))
  assert.equal(anonymous.statusCode, 401)

  const someoneElse = await call(createCheckout, POST(authHeader('bob'), checkoutBody()))
  assert.equal(someoneElse.statusCode, 403)
  assert.equal(checkouts.length, 0)
})

test('checkout: yearly starts on the $18/year product', async () => {
  const res = await call(createCheckout, POST(authHeader('alice'), checkoutBody({ interval: 'year' })))
  assert.equal(res.statusCode, 200)
  assert.match(res.body.checkoutUrl, /^https:\/\/polar\.test\/checkout\//)
  assert.equal(checkouts.length, 1)
  // First product is the one selected on Polar's page; the other stays on offer
  assert.deepEqual(checkouts[0].products, [YEARLY_PRODUCT, MONTHLY_PRODUCT])
  assert.equal(checkouts[0].customerEmail, 'alice@example.com')
  assert.deepEqual(checkouts[0].metadata, { userId: 'alice', userName: 'alice', interval: 'year' })
})

test('checkout: monthly starts on the $2/month product, and is the default', async () => {
  const chosen = await call(createCheckout, POST(authHeader('alice'), checkoutBody({ interval: 'month' })))
  assert.equal(chosen.statusCode, 200)
  assert.deepEqual(checkouts[0].products, [MONTHLY_PRODUCT, YEARLY_PRODUCT])

  const unspecified = await call(createCheckout, POST(authHeader('alice'), checkoutBody()))
  assert.equal(unspecified.statusCode, 200)
  assert.deepEqual(checkouts[1].products, [MONTHLY_PRODUCT, YEARLY_PRODUCT])
  assert.equal(checkouts[1].metadata.interval, 'month')
})

test('checkout: the user id in the metadata is the signed-in one', async () => {
  // No userId in the body at all: the token decides
  await call(createCheckout, POST(authHeader('alice'), { userEmail: 'alice@example.com', interval: 'year' }))
  assert.equal(checkouts[0].metadata.userId, 'alice')
})

test('checkout: refuses an interval that is not a plan', async () => {
  for (const interval of ['week', 'lifetime', '', null, 12, ['year']]) {
    const res = await call(createCheckout, POST(authHeader('alice'), checkoutBody({ interval })))
    assert.equal(res.statusCode, 400, `interval ${JSON.stringify(interval)}`)
    assert.equal(res.body.code, 'INVALID_INTERVAL')
  }
  assert.equal(checkouts.length, 0)
})

test('checkout: needs an email to bill', async () => {
  const res = await call(createCheckout, POST(authHeader('alice'), { userId: 'alice', interval: 'year' }))
  assert.equal(res.statusCode, 400)
  assert.equal(checkouts.length, 0)
})

test('checkout: without a yearly product only monthly can be bought', async () => {
  delete process.env.POLAR_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID

  const yearly = await call(createCheckout, POST(authHeader('alice'), checkoutBody({ interval: 'year' })))
  assert.equal(yearly.statusCode, 500)
  assert.equal(yearly.body.code, 'PLAN_UNAVAILABLE')
  assert.equal(checkouts.length, 0)

  const monthly = await call(createCheckout, POST(authHeader('alice'), checkoutBody({ interval: 'month' })))
  assert.equal(monthly.statusCode, 200)
  assert.deepEqual(checkouts[0].products, [MONTHLY_PRODUCT])
})

test('checkout: a live subscription cannot be bought twice', async () => {
  seed('users', 'alice', {
    ...read('users', 'alice'),
    hasCustomDomainAccess: true,
    subscription: { id: 'sub_1', status: 'active', interval: 'month' },
  })
  const res = await call(createCheckout, POST(authHeader('alice'), checkoutBody({ interval: 'year' })))
  assert.equal(res.statusCode, 409)
  assert.equal(res.body.code, 'ALREADY_SUBSCRIBED')
  assert.equal(checkouts.length, 0)
})

test('checkout: a lapsed subscriber can come back', async () => {
  seed('users', 'alice', {
    ...read('users', 'alice'),
    hasCustomDomainAccess: false,
    subscription: { id: 'sub_1', status: 'revoked', interval: 'month' },
  })
  const revoked = await call(createCheckout, POST(authHeader('alice'), checkoutBody({ interval: 'year' })))
  assert.equal(revoked.statusCode, 200)

  // Cancelled, paid-for time over, but the "revoked" webhook never arrived
  seed('users', 'alice', {
    ...read('users', 'alice'),
    hasCustomDomainAccess: true,
    subscription: { id: 'sub_1', status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: Timestamp.fromDate(inDays(-2)) },
  })
  const expired = await call(createCheckout, POST(authHeader('alice'), checkoutBody({ interval: 'year' })))
  assert.equal(expired.statusCode, 200)
  assert.equal(checkouts.length, 2)
})

// ---- how long access lasts ----

test('access: cancelling keeps what was paid for until the period ends', () => {
  const cancelled = endsAt => ({
    hasCustomDomainAccess: true,
    subscription: { status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: endsAt },
  })

  // Firestore hands dates back as Timestamps; a yearly plan can have months left
  assert.equal(hasActiveAccess(cancelled(Timestamp.fromDate(inDays(300)))), true)
  assert.equal(hasActiveAccess(cancelled(Timestamp.fromDate(inDays(-1)))), false)
  // ...and public pages pass them as milliseconds or ISO strings
  assert.equal(hasActiveAccess(cancelled(inDays(300).getTime())), true)
  assert.equal(hasActiveAccess(cancelled(inDays(300).toISOString())), true)
  assert.equal(hasActiveAccess(cancelled(inDays(-1).getTime())), false)
  assert.equal(hasActiveAccess(cancelled(inDays(300))), true)

  assert.equal(hasActiveAccess({ hasCustomDomainAccess: true, subscription: { status: 'active' } }), true)
  assert.equal(hasActiveAccess({ hasCustomDomainAccess: true }), true)
  assert.equal(hasActiveAccess({ hasCustomDomainAccess: false, subscription: { status: 'active' } }), false)
  assert.equal(hasActiveAccess({}), false)
  assert.equal(hasActiveAccess(null), false)
})

test('access: the flag is switched off only once the paid-for time is over', async () => {
  const withEnd = endsAt => ({
    name: 'alice',
    hasCustomDomainAccess: true,
    subscription: { status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: Timestamp.fromDate(endsAt) },
  })

  seed('users', 'alice', withEnd(inDays(200)))
  assert.equal(await checkSubscriptionAccess(read('users', 'alice'), 'alice', true), true)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, true)

  seed('users', 'alice', withEnd(inDays(-1)))
  assert.equal(await checkSubscriptionAccess(read('users', 'alice'), 'alice', false), false)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, true) // no lazy update asked for
  assert.equal(await checkSubscriptionAccess(read('users', 'alice'), 'alice', true), false)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, false)
})

test('access: hasLiveSubscription is what blocks a second checkout', () => {
  assert.equal(hasLiveSubscription({ hasCustomDomainAccess: true, subscription: { status: 'active' } }), true)
  assert.equal(hasLiveSubscription({ hasCustomDomainAccess: true, subscription: { status: 'trialing' } }), true)
  assert.equal(hasLiveSubscription({ hasCustomDomainAccess: false, subscription: { status: 'active' } }), false)
  assert.equal(hasLiveSubscription({ hasCustomDomainAccess: true, subscription: { status: 'canceled' } }), false)
  assert.equal(hasLiveSubscription({ hasCustomDomainAccess: true }), false)
  assert.equal(hasLiveSubscription(null), false)
})

test('serializeSubscription: dates become milliseconds, unknown intervals become null', () => {
  const end = inDays(365)
  const out = serializeSubscription({
    id: 'sub_1',
    status: 'active',
    interval: 'year',
    currentPeriodStart: Timestamp.fromDate(new Date(0)),
    currentPeriodEnd: Timestamp.fromDate(end),
  })
  assert.equal(out.interval, 'year')
  assert.equal(out.currentPeriodStart, 0)
  assert.equal(out.currentPeriodEnd, end.getTime())
  assert.equal(out.cancelAtPeriodEnd, false)
  assert.equal(JSON.parse(JSON.stringify(out)).currentPeriodEnd, end.getTime())

  assert.equal(serializeSubscription({ id: 'old', status: 'active' }).interval, null)
  assert.equal(serializeSubscription({ id: 'odd', interval: 'week' }).interval, null)
  assert.equal(serializeSubscription(undefined), null)
})

// ---- status ----

test('status: only your own, with the plans on offer', async () => {
  const sneaky = await call(status, { method: 'GET', headers: authHeader('bob'), query: { userId: 'alice' } })
  assert.equal(sneaky.statusCode, 403)

  const res = await call(status, { method: 'GET', headers: authHeader('alice'), query: { userId: 'alice' } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.hasSubscription, false)
  assert.equal(res.body.hasCustomDomainAccess, false)
  assert.equal(res.body.subscription, null)
  assert.deepEqual(res.body.availablePlans, ['month', 'year'])

  delete process.env.POLAR_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID
  const monthlyOnly = await call(status, { method: 'GET', headers: authHeader('alice'), query: { userId: 'alice' } })
  assert.deepEqual(monthlyOnly.body.availablePlans, ['month'])
})

test('status: a cancelled yearly plan keeps its access and says when it ends', async () => {
  const end = inDays(250)
  seed('users', 'alice', {
    ...read('users', 'alice'),
    hasCustomDomainAccess: true,
    subscription: {
      id: 'sub_1',
      status: 'active',
      interval: 'year',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: Timestamp.fromDate(end),
    },
  })
  const res = await call(status, { method: 'GET', headers: authHeader('alice'), query: { userId: 'alice' } })
  assert.equal(res.body.hasCustomDomainAccess, true)
  assert.equal(res.body.subscription.interval, 'year')
  assert.equal(res.body.subscription.cancelAtPeriodEnd, true)
  assert.equal(res.body.subscription.currentPeriodEnd, end.getTime())
  assert.equal(read('users', 'alice').hasCustomDomainAccess, true)
  assert.equal(sent.length, 0)
})

test('status: once the paid-for time is over, access ends and one email says so', async () => {
  seed('users', 'alice', {
    ...read('users', 'alice'),
    hasCustomDomainAccess: true,
    subscription: { id: 'sub_1', status: 'active', interval: 'year', cancelAtPeriodEnd: true, currentPeriodEnd: Timestamp.fromDate(inDays(-1)) },
  })
  const first = await call(status, { method: 'GET', headers: authHeader('alice'), query: { userId: 'alice' } })
  assert.equal(first.body.hasCustomDomainAccess, false)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, false)
  assert.deepEqual(sent.map(m => [m.kind, m.type, m.userEmail]), [['subscription', 'expired', 'alice@example.com']])

  await call(status, { method: 'GET', headers: authHeader('alice'), query: { userId: 'alice' } })
  assert.equal(sent.length, 1)
})

// ---- billing portal ----

test('portal: opens for the subscriber only', async () => {
  const none = await call(portal, POST(authHeader('alice'), { userId: 'alice' }))
  assert.equal(none.statusCode, 400)

  seed('users', 'alice', { ...read('users', 'alice'), subscription: { id: 'sub_1', customerId: 'cus_1', status: 'active' } })
  const sneaky = await call(portal, POST(authHeader('bob'), { userId: 'alice' }))
  assert.equal(sneaky.statusCode, 403)

  const res = await call(portal, POST(authHeader('alice'), { userId: 'alice' }))
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.portalUrl, 'https://polar.test/portal/cus_1')
  assert.deepEqual(portalSessions, [{ customerId: 'cus_1' }])
})

// ---- webhook ----

test('webhook: an unsigned event changes nothing', async () => {
  const res = await deliver(subscriptionEvent('subscription.active'), { signature: 'forged' })
  assert.equal(res.statusCode, 403)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, undefined)
  assert.equal(sent.length, 0)
})

test('webhook: a paid yearly subscription gives access and is recorded as yearly', async () => {
  const end = inDays(365)
  const res = await deliver(
    subscriptionEvent('subscription.active', {
      productId: YEARLY_PRODUCT,
      recurringInterval: 'year',
      currentPeriodEnd: end.toISOString(),
    })
  )
  assert.equal(res.statusCode, 202)

  const alice = read('users', 'alice')
  assert.equal(alice.hasCustomDomainAccess, true)
  assert.equal(alice.subscription.id, 'sub_1')
  assert.equal(alice.subscription.status, 'active')
  assert.equal(alice.subscription.interval, 'year')
  assert.equal(alice.subscription.productId, YEARLY_PRODUCT)
  assert.equal(alice.subscription.customerId, 'cus_1')
  assert.equal(new Date(alice.subscription.currentPeriodEnd).getTime(), end.getTime())
  assert.deepEqual(sent.map(m => [m.kind, m.type]), [['subscription', 'activated']])
  assert.equal(read('users', 'bob').hasCustomDomainAccess, undefined)
})

test('webhook: a monthly subscription is recorded as monthly', async () => {
  await deliver(subscriptionEvent('subscription.active'))
  assert.equal(read('users', 'alice').subscription.interval, 'month')
  assert.equal(read('users', 'alice').hasCustomDomainAccess, true)
})

test('webhook: a subscription that is created but not paid for gives no access', async () => {
  const res = await deliver(subscriptionEvent('subscription.created', { status: 'incomplete' }))
  assert.equal(res.statusCode, 202)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, undefined)
  assert.equal(read('users', 'alice').subscription, undefined)
  assert.equal(sent.length, 0)

  // The payment goes through
  await deliver(subscriptionEvent('subscription.active'))
  assert.equal(read('users', 'alice').hasCustomDomainAccess, true)
})

test('webhook: a late "created" event cannot take access away again', async () => {
  await deliver(subscriptionEvent('subscription.active'))
  await deliver(subscriptionEvent('subscription.created', { status: 'incomplete' }))
  assert.equal(read('users', 'alice').hasCustomDomainAccess, true)
  assert.equal(read('users', 'alice').subscription.status, 'active')
})

test('webhook: switching to yearly in the billing portal updates the plan', async () => {
  await deliver(subscriptionEvent('subscription.active'))
  await deliver(
    subscriptionEvent('subscription.updated', {
      productId: YEARLY_PRODUCT,
      recurringInterval: 'year',
      metadata: {}, // found by subscription id instead
    })
  )
  const alice = read('users', 'alice')
  assert.equal(alice.subscription.interval, 'year')
  assert.equal(alice.subscription.productId, YEARLY_PRODUCT)
  assert.equal(alice.hasCustomDomainAccess, true)
})

test('webhook: cancelling keeps access until the period ends, then it goes', async () => {
  const end = inDays(200)
  await deliver(subscriptionEvent('subscription.active', { recurringInterval: 'year', currentPeriodEnd: end.toISOString() }))
  resetSent()

  await deliver(
    subscriptionEvent('subscription.canceled', {
      recurringInterval: 'year',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: end.toISOString(),
    })
  )
  let alice = read('users', 'alice')
  assert.equal(alice.hasCustomDomainAccess, true)
  assert.equal(alice.subscription.cancelAtPeriodEnd, true)
  assert.equal(alice.subscription.interval, 'year') // a partial update keeps the plan
  assert.equal(hasActiveAccess(alice), true)
  assert.equal(sent[0].type, 'canceled')
  assert.ok(sent[0].periodEndDate)

  await deliver(subscriptionEvent('subscription.revoked', { status: 'canceled' }))
  alice = read('users', 'alice')
  assert.equal(alice.hasCustomDomainAccess, false)
  assert.equal(alice.subscription.status, 'revoked')
})

test('webhook: an unknown billing interval is stored as null, not trusted', async () => {
  await deliver(subscriptionEvent('subscription.active', { recurringInterval: 'week' }))
  assert.equal(read('users', 'alice').subscription.interval, null)
})

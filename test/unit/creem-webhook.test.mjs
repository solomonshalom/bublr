// Creem webhook deliveries: the signature check, and what the real
// /api/subscription/webhook route does with each event.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import { mockRes } from './helpers.mjs'
import { resetStore, seed, read } from './mocks/firebase.mjs'
import { sent, resetSent } from './mocks/resend.mjs'

const SECRET = `whsec_${crypto.randomBytes(16).toString('hex')}`
const PRODUCT = 'prod_custom_domain_monthly'
process.env.CREEM_WEBHOOK_SECRET = SECRET
process.env.CREEM_CUSTOM_DOMAIN_PRODUCT_ID = PRODUCT
delete process.env.CREEM_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID

const { validateEvent, verifySignature, WebhookVerificationError } = await import('../../src/lib/creem-webhook.js')
const webhook = (await import('../../src/pages/api/subscription/webhook.js')).default

// Creem's signature: hex HMAC-SHA256 of the raw body, keyed with the secret.
function sign(body, secret = SECRET) {
  return { 'creem-signature': crypto.createHmac('sha256', secret).update(body).digest('hex') }
}

const DAY = 24 * 60 * 60 * 1000
const inDays = days => new Date(Date.now() + days * DAY).toISOString()

// A subscription the way Creem sends it in subscription.* events: snake_case,
// ISO dates, and the product and customer as whole objects.
function subscription(overrides = {}) {
  return {
    id: 'sub_1',
    object: 'subscription',
    product: { id: PRODUCT, object: 'product', name: 'Bublr Pro', billing_period: 'every-month' },
    customer: { id: 'cust_1', object: 'customer', email: 'billing@example.com', name: 'Alice' },
    collection_method: 'charge_automatically',
    status: 'active',
    current_period_start_date: inDays(-1),
    current_period_end_date: inDays(29),
    canceled_at: null,
    metadata: { userId: 'alice', userName: 'alice' },
    mode: 'live',
    ...overrides,
  }
}

// Each delivery gets a later created_at than the one before, like real events.
let clock = Date.now()

// POST a delivery to the route. It reads the raw body off the request stream.
async function deliver(eventType, object, { headers, secret, createdAt } = {}) {
  const body = JSON.stringify({ id: `evt_${++clock}`, eventType, created_at: createdAt ?? ++clock, object })
  const req = {
    method: 'POST',
    headers: headers || sign(body, secret),
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body)
    },
  }
  const res = mockRes()
  await webhook(req, res)
  return res
}

beforeEach(() => {
  resetStore()
  resetSent()
  seed('users', 'alice', { name: 'alice', displayName: 'Alice', email: 'alice@example.com' })
})

// ---- signature ----

test('creem webhook: accepts a delivery signed with the endpoint secret', () => {
  const body = JSON.stringify({ id: 'evt_1', eventType: 'refund.created', created_at: 1728734351631, object: { id: 'ref_1' } })
  const event = validateEvent(body, sign(body), SECRET)
  assert.equal(event.id, 'evt_1')
  assert.equal(event.type, 'refund.created')
  assert.equal(event.createdAt, 1728734351631)
  assert.equal(event.subscription, null)
  assert.equal(event.object.id, 'ref_1')

  // Hex is hex in either case.
  const upper = { 'creem-signature': sign(body)['creem-signature'].toUpperCase() }
  assert.doesNotThrow(() => verifySignature(body, upper, SECRET))
})

test('creem webhook: refuses forged, altered and unsigned deliveries', () => {
  const body = JSON.stringify({ eventType: 'subscription.active', object: subscription() })
  const refused = (headers, sentBody = body, secret = SECRET) =>
    assert.throws(() => verifySignature(sentBody, headers, secret), WebhookVerificationError)

  refused(sign(body, 'whsec_someone_elses_secret')) // someone else's secret
  refused(sign(body), body.replace('alice', 'mallory')) // body changed after signing
  refused({}) // no signature at all
  refused({ 'creem-signature': '' }) // empty signature
  refused({ 'creem-signature': 'not-hex-at-all' })
  refused({ 'creem-signature': sign(body)['creem-signature'].slice(0, 32) }) // cut short

  // A missing secret must not turn into an empty key anyone can sign with.
  const emptyKey = crypto.createHmac('sha256', '').update(body).digest('hex')
  refused({ 'creem-signature': emptyKey }, body, '')
  refused({ 'creem-signature': emptyKey }, body, undefined)
})

test('creem webhook: reads a subscription from its own events and from a completed checkout', () => {
  const direct = JSON.stringify({ id: 'evt_a', eventType: 'subscription.scheduled_cancel', created_at: 5, object: subscription({ status: 'scheduled_cancel' }) })
  const fromEvent = validateEvent(direct, sign(direct), SECRET).subscription
  assert.equal(fromEvent.id, 'sub_1')
  assert.equal(fromEvent.customerId, 'cust_1')
  assert.equal(fromEvent.customerEmail, 'billing@example.com')
  assert.equal(fromEvent.productId, PRODUCT)
  assert.equal(fromEvent.cancelAtPeriodEnd, true)
  assert.ok(fromEvent.currentPeriodEnd instanceof Date)
  assert.deepEqual(fromEvent.metadata, { userId: 'alice', userName: 'alice' })

  // Inside a checkout the subscription names its product and customer by ID
  // only; the checkout around it has the email and the metadata.
  const checkout = JSON.stringify({
    id: 'evt_b',
    eventType: 'checkout.completed',
    created_at: 6,
    object: {
      id: 'ch_1',
      object: 'checkout',
      product: { id: PRODUCT, object: 'product' },
      customer: { id: 'cust_1', object: 'customer', email: 'billing@example.com' },
      subscription: subscription({ product: PRODUCT, customer: 'cust_1', metadata: undefined }),
      status: 'completed',
      metadata: { userId: 'alice' },
    },
  })
  const fromCheckout = validateEvent(checkout, sign(checkout), SECRET).subscription
  assert.equal(fromCheckout.id, 'sub_1')
  assert.equal(fromCheckout.customerId, 'cust_1')
  assert.equal(fromCheckout.customerEmail, 'billing@example.com')
  assert.equal(fromCheckout.productId, PRODUCT)
  assert.equal(fromCheckout.status, 'active')
  assert.deepEqual(fromCheckout.metadata, { userId: 'alice' })

  // A one-time purchase has no subscription to read.
  const oneTime = JSON.stringify({ eventType: 'checkout.completed', object: { id: 'ch_2', product: { id: 'prod_ebook' }, order: { type: 'onetime' } } })
  assert.equal(validateEvent(oneTime, sign(oneTime), SECRET).subscription, null)
})

test('creem webhook: the route answers 403 to a bad signature and writes nothing', async () => {
  const res = await deliver('subscription.active', subscription(), { secret: 'whsec_not_the_secret' })
  assert.equal(res.statusCode, 403)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, undefined)

  const unsigned = await deliver('subscription.active', subscription(), { headers: {} })
  assert.equal(unsigned.statusCode, 403)
})

// ---- what the route does ----

test('creem webhook: a new subscription gives access and one welcome email', async () => {
  // Creem sends all three for one purchase.
  const checkout = await deliver('checkout.completed', {
    id: 'ch_1',
    object: 'checkout',
    product: { id: PRODUCT },
    customer: { id: 'cust_1', email: 'billing@example.com' },
    subscription: subscription({ product: PRODUCT, customer: 'cust_1' }),
    metadata: { userId: 'alice', userName: 'alice' },
    status: 'completed',
  })
  const active = await deliver('subscription.active', subscription())
  const paid = await deliver('subscription.paid', subscription())
  for (const res of [checkout, active, paid]) assert.equal(res.statusCode, 200)

  const alice = read('users', 'alice')
  assert.equal(alice.hasCustomDomainAccess, true)
  assert.equal(alice.subscription.id, 'sub_1')
  assert.equal(alice.subscription.status, 'active')
  assert.equal(alice.subscription.customerId, 'cust_1')
  assert.equal(alice.subscription.productId, PRODUCT)
  assert.equal(alice.subscription.cancelAtPeriodEnd, false)
  assert.ok(alice.subscription.currentPeriodEnd.getTime() > Date.now())

  const welcomes = sent.filter(email => email.kind === 'subscription' && email.type === 'activated')
  assert.equal(welcomes.length, 1)
  assert.equal(welcomes[0].userEmail, 'alice@example.com')
  assert.equal(sent.length, 1)
})

test('creem webhook: deliveries that arrive together still send one welcome', async () => {
  const results = await Promise.all([
    deliver('subscription.active', subscription()),
    deliver('subscription.paid', subscription()),
    deliver('subscription.update', subscription()),
  ])
  for (const res of results) assert.equal(res.statusCode, 200)

  assert.equal(read('users', 'alice').hasCustomDomainAccess, true)
  assert.equal(sent.filter(email => email.type === 'activated').length, 1)
})

test('creem webhook: the email given at checkout is used when the profile has none', async () => {
  seed('users', 'alice', { name: 'alice' })
  await deliver('subscription.active', subscription())
  assert.equal(sent.length, 1)
  assert.equal(sent[0].userEmail, 'billing@example.com')
})

test('creem webhook: the writer is found without metadata, by subscription or by customer', async () => {
  await deliver('subscription.active', subscription())
  resetSent()

  // The same subscription, sent without its metadata.
  await deliver('subscription.past_due', subscription({ status: 'past_due', metadata: undefined }))
  assert.equal(read('users', 'alice').hasCustomDomainAccess, false)

  // A later purchase by the same Creem customer, made from a bare payment link.
  await deliver('subscription.active', subscription({ id: 'sub_2', metadata: {} }))
  assert.equal(read('users', 'alice').hasCustomDomainAccess, true)
  assert.equal(read('users', 'alice').subscription.id, 'sub_2')
})

test('creem webhook: events with nothing for us are acknowledged, not failed', async () => {
  // Creem retries anything that isn't a 2xx.
  for (const [type, object] of [
    ['refund.created', { id: 'ref_1', subscription: { id: 'sub_1', product: PRODUCT } }],
    ['dispute.created', { id: 'disp_1' }],
    ['credits.granted', { id: 'cct_1', customer_id: 'cust_1' }],
    ['checkout.completed', { id: 'ch_9', product: { id: PRODUCT }, metadata: { userId: 'alice' } }],
    ['something.new', { id: 'x_1' }],
    ['subscription.active', subscription({ metadata: { userId: 'nobody-we-know' }, customer: { id: 'cust_unknown' } })],
    ['subscription.active', subscription({ metadata: { userId: 'users/alice' }, customer: { id: 'cust_unknown' } })],
  ]) {
    const res = await deliver(type, object)
    assert.equal(res.statusCode, 200, type)
  }
  assert.equal(read('users', 'alice').hasCustomDomainAccess, undefined)
  assert.equal(read('users', 'nobody-we-know'), undefined)
  assert.equal(sent.length, 0)
})

test('creem webhook: subscriptions to another product in the same Creem store are left alone', async () => {
  const other = { id: 'sub_other', product: { id: 'prod_some_other_app' } }

  // Carrying a userId that happens to be a Bublr writer: no access, no email.
  for (const type of ['subscription.active', 'subscription.paid', 'subscription.canceled', 'subscription.expired']) {
    const res = await deliver(type, subscription(other))
    assert.equal(res.statusCode, 200, type)
  }
  assert.equal(read('users', 'alice').hasCustomDomainAccess, undefined)
  assert.equal(read('users', 'alice').subscription, undefined)
  assert.equal(sent.length, 0)
})

test('creem webhook: a subscription already on record is still ours after the product ID changes', async () => {
  seed('users', 'alice', {
    name: 'alice',
    email: 'alice@example.com',
    hasCustomDomainAccess: true,
    subscription: { id: 'sub_old', status: 'active', customerId: 'cust_1', productId: 'prod_retired' },
  })

  const res = await deliver(
    'subscription.paused',
    subscription({ id: 'sub_old', product: { id: 'prod_retired' }, status: 'paused' })
  )
  assert.equal(res.statusCode, 200)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, false)
  assert.equal(read('users', 'alice').subscription.status, 'paused')
})

test('creem webhook: a scheduled cancellation keeps access until the paid period ends', async () => {
  await deliver('subscription.active', subscription())
  resetSent()

  const periodEnd = inDays(20)
  const scheduled = await deliver(
    'subscription.scheduled_cancel',
    subscription({ status: 'scheduled_cancel', current_period_end_date: periodEnd })
  )
  assert.equal(scheduled.statusCode, 200)
  let alice = read('users', 'alice')
  assert.equal(alice.hasCustomDomainAccess, true)
  assert.equal(alice.subscription.status, 'scheduled_cancel')
  assert.equal(alice.subscription.cancelAtPeriodEnd, true)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].type, 'canceled')
  assert.equal(new Date(sent[0].periodEndDate).toISOString(), periodEnd)

  // When the period is over Creem sends the cancellation itself.
  await deliver('subscription.canceled', subscription({ status: 'canceled', current_period_end_date: inDays(-0.01) }))
  alice = read('users', 'alice')
  assert.equal(alice.hasCustomDomainAccess, false)
  assert.equal(alice.subscription.status, 'canceled')
  assert.equal(sent.length, 2)
  assert.equal(sent[1].type, 'expired')
})

test('creem webhook: changing their mind before the period ends keeps the subscription', async () => {
  await deliver('subscription.active', subscription())
  await deliver('subscription.scheduled_cancel', subscription({ status: 'scheduled_cancel' }))
  resetSent()

  await deliver('subscription.active', subscription())
  const alice = read('users', 'alice')
  assert.equal(alice.hasCustomDomainAccess, true)
  assert.equal(alice.subscription.cancelAtPeriodEnd, false)
  assert.equal(sent.length, 0)
})

test('creem webhook: cancelling outright still keeps what was paid for', async () => {
  await deliver('subscription.active', subscription())
  resetSent()

  const periodEnd = inDays(12)
  await deliver('subscription.canceled', subscription({ status: 'canceled', current_period_end_date: periodEnd, canceled_at: new Date().toISOString() }))
  const alice = read('users', 'alice')
  assert.equal(alice.hasCustomDomainAccess, true)
  // The flag checkSubscriptionAccess goes by to end access on the date.
  assert.equal(alice.subscription.cancelAtPeriodEnd, true)
  assert.equal(alice.subscription.currentPeriodEnd.toISOString(), periodEnd)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].type, 'canceled')
  assert.equal(new Date(sent[0].periodEndDate).toISOString(), periodEnd)
})

test('creem webhook: a failed renewal takes access away and a recovered one brings it back', async () => {
  await deliver('subscription.active', subscription())
  resetSent()

  await deliver('subscription.past_due', subscription({ status: 'past_due', current_period_end_date: inDays(-0.01) }))
  assert.equal(read('users', 'alice').hasCustomDomainAccess, false)
  assert.equal(read('users', 'alice').subscription.status, 'past_due')
  assert.deepEqual(sent.map(email => email.type), ['expired'])

  // Retries used up: nothing more to take away, nothing more to say.
  await deliver('subscription.canceled', subscription({ status: 'canceled', current_period_end_date: inDays(-3) }))
  assert.equal(read('users', 'alice').hasCustomDomainAccess, false)
  assert.equal(sent.length, 1)

  await deliver('subscription.paid', subscription({ id: 'sub_2' }))
  assert.equal(read('users', 'alice').hasCustomDomainAccess, true)
  assert.equal(read('users', 'alice').subscription.id, 'sub_2')
  assert.deepEqual(sent.map(email => email.type), ['expired', 'activated'])
})

test('creem webhook: "expired" goes by the dates, because its status can still say active', async () => {
  await deliver('subscription.active', subscription())

  // Already renewed by the time the daily check reports the old period.
  await deliver('subscription.expired', subscription())
  assert.equal(read('users', 'alice').hasCustomDomainAccess, true)

  await deliver('subscription.expired', subscription({ current_period_end_date: inDays(-1) }))
  assert.equal(read('users', 'alice').hasCustomDomainAccess, false)
})

test('creem webhook: an old subscription winding down does not touch a newer one', async () => {
  await deliver('subscription.active', subscription({ id: 'sub_new' }))
  resetSent()

  for (const [type, status] of [
    ['subscription.canceled', 'canceled'],
    ['subscription.expired', 'canceled'],
    ['subscription.past_due', 'past_due'],
  ]) {
    const res = await deliver(type, subscription({ id: 'sub_old', status, current_period_end_date: inDays(-2) }))
    assert.equal(res.statusCode, 200, type)
  }
  const alice = read('users', 'alice')
  assert.equal(alice.hasCustomDomainAccess, true)
  assert.equal(alice.subscription.id, 'sub_new')
  assert.equal(sent.length, 0)
})

test('creem webhook: a retried delivery that arrives late does not undo newer state', async () => {
  const earlier = Date.now() + 1000
  const later = earlier + 5000

  // The failed renewal's delivery is retried and lands after the payment that fixed it.
  await deliver('subscription.active', subscription(), { createdAt: earlier - 5000 })
  await deliver('subscription.paid', subscription(), { createdAt: later })
  resetSent()
  const res = await deliver('subscription.past_due', subscription({ status: 'past_due' }), { createdAt: earlier })

  assert.equal(res.statusCode, 200)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, true)
  assert.equal(read('users', 'alice').subscription.status, 'active')
  assert.equal(sent.length, 0)
})

// ---------------------------------------------------------------- Pro + Shop

test('creem webhook: the Pro + Shop plan opens the shop; moving back to Pro closes it', async () => {
  process.env.CREEM_SHOP_PRODUCT_ID = 'prod_shop'
  process.env.INTEGRATIONS_SECRET = 'test-integrations-secret-that-is-long-enough-123'
  const { hasVerifiedShopAccess } = await import('../../src/lib/shop-trust.js')
  try {
    const shopPlan = { id: 'prod_shop', object: 'product', name: 'Bublr Pro + Shop' }
    await deliver('subscription.active', subscription({ product: shopPlan }))
    let user = read('users', 'alice')
    assert.equal(user.hasCustomDomainAccess, true, 'Pro + Shop includes the custom domain')
    assert.equal(user.hasShopAccess, true)
    assert.equal(user.subscription.productId, 'prod_shop')
    assert.equal(hasVerifiedShopAccess({ id: 'alice', ...user }), true, 'the webhook signs the grant')
    assert.equal(hasVerifiedShopAccess({ id: 'mallory', ...user }), false, 'a grant copied to another writer opens nothing')

    await deliver('subscription.update', subscription())
    user = read('users', 'alice')
    assert.equal(user.hasCustomDomainAccess, true)
    assert.equal(user.hasShopAccess, false)
    assert.equal(user.shopGrant, undefined)

    await deliver('subscription.update', subscription({ product: shopPlan }))
    await deliver('subscription.past_due', subscription({ product: shopPlan, status: 'past_due' }))
    user = read('users', 'alice')
    assert.equal(user.hasShopAccess, false, 'an unpaid renewal closes the shop too')
  } finally {
    delete process.env.CREEM_SHOP_PRODUCT_ID
    delete process.env.INTEGRATIONS_SECRET
  }
})

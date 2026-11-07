// Bublr Pro billing with Dodo Payments: webhook signatures, the subscription
// state machine, and the checkout / sync / status / portal / manage routes.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { installTestCerts, authHeader, call, mockRes } from './helpers.mjs'
import { installFetch } from './fetch-mock.mjs'
import { resetStore, seed, read } from './mocks/firebase.mjs'
import { sent, resetSent } from './mocks/resend.mjs'

const SECRET = `whsec_${Buffer.from('a-very-secret-signing-key-for-tests').toString('base64')}`
process.env.DODO_PAYMENTS_API_KEY = 'dodo_test_key'
process.env.DODO_PAYMENTS_PRODUCT_ID = 'pdt_pro'
process.env.DODO_PAYMENTS_WEBHOOK_KEY = SECRET
delete process.env.DODO_PAYMENTS_ENVIRONMENT
delete process.env.VERCEL_TOKEN

const { verifyWebhook, signWebhook, WebhookVerificationError, dodoEnvironment } = await import('../../src/lib/dodo.js')
const { describeSubscription, hasActiveAccess, PAYMENT_GRACE_DAYS } = await import('../../src/lib/subscription.js')
const billing = await import('../../src/lib/billing.js')
const api = async route => (await import(`../../src/pages/api/${route}.js`)).default
const webhook = await api('subscription/webhook')
const checkout = await api('subscription/create-checkout')
const sync = await api('subscription/sync')
const status = await api('subscription/status')
const portal = await api('subscription/portal')
const manage = await api('subscription/manage')
const branding = await api('domain/branding')
const template = await api('newsletter/template')

const DAY = 24 * 60 * 60 * 1000
const iso = ms => new Date(ms).toISOString()
const NOW = Date.now()

// ---- a fake Dodo ----
let dodo // subscription_id -> subscription object, as Dodo would return it
let calls
let dodoDown

function sub(overrides = {}) {
  return {
    subscription_id: 'sub_1',
    status: 'active',
    product_id: 'pdt_pro',
    customer: { customer_id: 'cus_1', email: 'alice@example.com', name: 'Alice' },
    metadata: { userId: 'alice' },
    previous_billing_date: iso(NOW - 5 * DAY),
    next_billing_date: iso(NOW + 25 * DAY),
    cancel_at_next_billing_date: false,
    created_at: iso(NOW - 5 * DAY),
    payload_type: 'Subscription',
    ...overrides,
  }
}

function installDodo() {
  calls = installFetch(req => {
    if (dodoDown) return { status: 503, body: { message: 'down' } }
    assert.equal(req.host, 'test.dodopayments.com', 'test keys talk to test mode')
    assert.equal(req.headers.Authorization, 'Bearer dodo_test_key')
    const subMatch = req.path.match(/^\/subscriptions\/([^/]+)$/)
    if (subMatch && req.method === 'GET') {
      const found = dodo[decodeURIComponent(subMatch[1])]
      return found ? { body: found } : { status: 404, body: { message: 'not found' } }
    }
    if (subMatch && req.method === 'PATCH') {
      const id = decodeURIComponent(subMatch[1])
      if (!dodo[id]) return { status: 404, body: { message: 'not found' } }
      dodo[id] = { ...dodo[id], ...req.body }
      return { body: dodo[id] }
    }
    if (req.path === '/checkouts' && req.method === 'POST') {
      return { body: { session_id: 'cks_1', checkout_url: 'https://test.checkout.dodopayments.com/cks_1' } }
    }
    const portalMatch = req.path.match(/^\/customers\/([^/]+)\/customer-portal\/session$/)
    if (portalMatch && req.method === 'POST') {
      return { body: { link: `https://portal.example/${portalMatch[1]}` } }
    }
    return { status: 404, body: { message: 'unmocked' } }
  })
}

beforeEach(() => {
  installTestCerts()
  resetStore()
  resetSent()
  dodo = {}
  dodoDown = false
  installDodo()
  seed('users', 'alice', { name: 'alice', displayName: 'Alice', email: 'alice@example.com', posts: [] })
  seed('users', 'bob', { name: 'bob', displayName: 'Bob', email: 'bob@example.com', posts: [] })
})

function webhookReq(event, { secret = SECRET, id = `msg_${Math.random()}`, timestamp = Math.floor(Date.now() / 1000), signature } = {}) {
  const raw = JSON.stringify(event)
  const sig = signature ?? signWebhook(secret, { id, timestamp, payload: raw })
  return {
    method: 'POST',
    headers: { 'webhook-id': id, 'webhook-timestamp': String(timestamp), 'webhook-signature': sig },
    query: {},
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(raw)
    },
  }
}

async function deliver(type, data, options = {}) {
  const res = mockRes()
  const { eventTime = Date.now(), ...rest } = options
  await webhook(webhookReq({ business_id: 'bus_1', type, timestamp: iso(eventTime), data }, rest), res)
  return res
}

const subscriptionEmails = () => sent.filter(m => m.kind === 'subscription').map(m => m.type)
const POST = (headers, body) => ({ method: 'POST', headers, body })

// ---- signatures ----

test('webhook signatures: valid, tampered, wrong key, stale and replayed-later deliveries', () => {
  const raw = JSON.stringify({ type: 'subscription.active', data: { subscription_id: 'sub_1' } })
  const ts = Math.floor(Date.now() / 1000)
  const headers = { 'webhook-id': 'msg_1', 'webhook-timestamp': String(ts), 'webhook-signature': signWebhook(SECRET, { id: 'msg_1', timestamp: ts, payload: raw }) }

  assert.equal(verifyWebhook(raw, headers, SECRET).type, 'subscription.active')
  assert.equal(verifyWebhook(Buffer.from(raw), headers, SECRET).type, 'subscription.active', 'accepts a Buffer body')

  // Several signatures (key rotation): any valid v1 one is enough
  const rotated = { ...headers, 'webhook-signature': `v1,AAAA ${headers['webhook-signature']}` }
  assert.equal(verifyWebhook(raw, rotated, SECRET).type, 'subscription.active')

  // Header names are case-insensitive
  const shouty = { 'Webhook-Id': 'msg_1', 'Webhook-Timestamp': String(ts), 'Webhook-Signature': headers['webhook-signature'] }
  assert.equal(verifyWebhook(raw, shouty, SECRET).type, 'subscription.active')

  assert.throws(() => verifyWebhook(raw.replace('active', 'expired'), headers, SECRET), WebhookVerificationError)
  assert.throws(() => verifyWebhook(raw, headers, `whsec_${Buffer.from('other').toString('base64')}`), WebhookVerificationError)
  assert.throws(() => verifyWebhook(raw, { ...headers, 'webhook-id': 'msg_2' }, SECRET), WebhookVerificationError)
  assert.throws(() => verifyWebhook(raw, { ...headers, 'webhook-signature': 'v2,abc' }, SECRET), WebhookVerificationError)
  assert.throws(() => verifyWebhook(raw, { 'webhook-id': 'msg_1' }, SECRET), WebhookVerificationError)
  assert.throws(() => verifyWebhook(raw, headers, SECRET, { now: Date.now() + 10 * 60 * 1000 }), /too old/)
  assert.throws(() => verifyWebhook(raw, headers, SECRET, { now: Date.now() - 10 * 60 * 1000 }), /too new/)
  assert.throws(() => verifyWebhook(raw, headers, ''), WebhookVerificationError)
})

test('webhook signature matches the Standard Webhooks reference implementation', () => {
  // Test vector from the standard-webhooks spec / libraries
  const secret = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'
  const id = 'msg_p5jXN8AQM9LWM0D4loKWxJek'
  const timestamp = 1614265330
  const payload = '{"test": 2432232314}'
  assert.equal(signWebhook(secret, { id, timestamp, payload }), 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=')
})

test('environment: explicit setting wins, then the key prefix', () => {
  assert.equal(dodoEnvironment(), 'test_mode')
  process.env.DODO_PAYMENTS_ENVIRONMENT = 'live_mode'
  assert.equal(dodoEnvironment(), 'live_mode')
  process.env.DODO_PAYMENTS_ENVIRONMENT = 'test'
  assert.equal(dodoEnvironment(), 'test_mode')
  delete process.env.DODO_PAYMENTS_ENVIRONMENT
})

// ---- access rules ----

test('access rules: active, cancelling, grace periods, ended, comped and legacy', () => {
  const at = (subscription, flag = true) => describeSubscription({ hasCustomDomainAccess: flag, subscription }, NOW)
  const dodoSub = extra => ({ provider: 'dodo', status: 'active', currentPeriodEnd: iso(NOW + DAY), ...extra })

  assert.deepEqual(describeSubscription({}, NOW), { hasAccess: false, state: 'none', accessUntil: null })
  assert.equal(describeSubscription({ hasCustomDomainAccess: true }, NOW).hasAccess, true, 'comped account')

  assert.equal(at(dodoSub()).state, 'active')
  assert.equal(at(dodoSub()).hasAccess, true)
  assert.equal(at(dodoSub(), false).hasAccess, false, 'a manual revoke wins')

  assert.deepEqual(at(dodoSub({ cancelAtPeriodEnd: true })), { hasAccess: true, state: 'canceling', accessUntil: iso(NOW + DAY) })
  assert.equal(at(dodoSub({ cancelAtPeriodEnd: true, currentPeriodEnd: iso(NOW - 1) })).hasAccess, false)

  assert.equal(at(dodoSub({ status: 'cancelled' })).state, 'canceling', 'paid-up period still counts')
  assert.equal(at(dodoSub({ status: 'cancelled', currentPeriodEnd: iso(NOW - 1) })).state, 'ended')

  assert.deepEqual(at(dodoSub({ status: 'on_hold', graceUntil: iso(NOW + DAY) })), { hasAccess: true, state: 'past_due', accessUntil: iso(NOW + DAY) })
  assert.equal(at(dodoSub({ status: 'past_due', graceUntil: iso(NOW - 1) })).hasAccess, false)

  for (const s of ['expired', 'failed', 'pending', 'paused', 'something_new']) {
    assert.equal(at(dodoSub({ status: s })).hasAccess, false, s)
  }

  // Polar-era records keep their old rule
  assert.equal(at({ status: 'active', cancelAtPeriodEnd: false }).hasAccess, true)
  assert.equal(at({ status: 'canceled', cancelAtPeriodEnd: true, currentPeriodEnd: iso(NOW + DAY) }).hasAccess, true)
  assert.equal(at({ status: 'canceled', cancelAtPeriodEnd: true, currentPeriodEnd: iso(NOW - DAY) }).hasAccess, false)

  // Firestore Timestamps work too
  assert.equal(at(dodoSub({ cancelAtPeriodEnd: true, currentPeriodEnd: { toMillis: () => NOW + DAY } })).hasAccess, true)
})

// ---- webhook route ----

test('webhook: bad signature is refused and nothing changes', async () => {
  const res = mockRes()
  await webhook(webhookReq({ type: 'subscription.active', data: sub() }, { signature: 'v1,bm9wZQ==' }), res)
  assert.equal(res.statusCode, 401)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, undefined)
})

test('webhook: refuses (so Dodo retries) when the signing key is missing', async () => {
  const saved = process.env.DODO_PAYMENTS_WEBHOOK_KEY
  delete process.env.DODO_PAYMENTS_WEBHOOK_KEY
  try {
    const res = await deliver('subscription.active', sub())
    assert.equal(res.statusCode, 500)
  } finally {
    process.env.DODO_PAYMENTS_WEBHOOK_KEY = saved
  }
})

test('webhook: non-subscription events are acknowledged and ignored', async () => {
  const res = await deliver('payment.succeeded', { payload_type: 'Payment', payment_id: 'pay_1' })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.ignored, true)
})

test('webhook: subscription.active turns Pro on, emails once, and replays are harmless', async () => {
  dodo.sub_1 = sub()
  const first = await deliver('subscription.active', sub())
  assert.equal(first.statusCode, 200)
  assert.equal(first.body.applied, true)

  const alice = read('users', 'alice')
  assert.equal(alice.hasCustomDomainAccess, true)
  assert.equal(alice.subscription.provider, 'dodo')
  assert.equal(alice.subscription.id, 'sub_1')
  assert.equal(alice.subscription.customerId, 'cus_1')
  assert.equal(alice.subscription.currentPeriodEnd, iso(NOW + 25 * DAY))
  assert.deepEqual(subscriptionEmails(), ['activated'])

  // Same event again, and a renewal: no more emails
  await deliver('subscription.active', sub())
  await deliver('subscription.renewed', sub())
  assert.deepEqual(subscriptionEmails(), ['activated'])
})

test('webhook: a late, out-of-order delivery can’t roll state back (Dodo is re-read)', async () => {
  // Dodo now says: cancelled at period end
  dodo.sub_1 = sub({ cancel_at_next_billing_date: true })
  // ...but an old "active" delivery arrives late
  await deliver('subscription.active', sub())
  const alice = read('users', 'alice')
  assert.equal(alice.subscription.cancelAtPeriodEnd, true)
  assert.equal(describeSubscription(alice).state, 'canceling')
})

test('webhook: uses the payload when Dodo can’t be reached', async () => {
  dodoDown = true
  const res = await deliver('subscription.active', sub())
  assert.equal(res.statusCode, 200)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, true)
})

test('webhook: without metadata, the open checkout’s email finds the writer', async () => {
  seed('users', 'alice', {
    name: 'alice',
    email: 'alice@example.com',
    pendingCheckout: { sessionId: 'cks_1', email: 'alice@example.com', createdAt: iso(NOW - 60 * 1000) },
  })
  const noMeta = sub({ metadata: {}, created_at: iso(NOW) })
  dodo.sub_1 = noMeta
  const res = await deliver('subscription.active', noMeta)
  assert.equal(res.body.applied, true)
  const alice = read('users', 'alice')
  assert.equal(alice.hasCustomDomainAccess, true)
  assert.equal(alice.pendingCheckout, undefined, 'open checkout is cleared')
  // ...and the subscription gets tagged so later webhooks match directly
  assert.equal(dodo.sub_1.metadata.userId, 'alice')
  assert.ok(calls.some(c => c.method === 'PATCH' && c.body.metadata?.userId === 'alice'))
})

test('webhook: a subscription nobody can be matched to changes nothing', async () => {
  const stranger = sub({ subscription_id: 'sub_x', metadata: {}, customer: { customer_id: 'cus_x', email: 'x@example.com' } })
  dodo.sub_x = stranger
  const res = await deliver('subscription.active', stranger)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.applied, false)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, undefined)
})

test('webhook: another product sold to the same customer is not Pro', async () => {
  seed('users', 'alice', {
    name: 'alice',
    email: 'alice@example.com',
    pendingCheckout: { email: 'alice@example.com', createdAt: iso(NOW - 1000) },
  })
  const other = sub({ product_id: 'pdt_tshirt', metadata: {}, created_at: iso(NOW) })
  dodo.sub_1 = other
  await deliver('subscription.active', other)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, undefined)
})

test('webhook: metadata naming a writer that doesn’t exist is dropped', async () => {
  const ghost = sub({ metadata: { userId: 'ghost' } })
  dodo.sub_1 = ghost
  const res = await deliver('subscription.active', ghost)
  assert.equal(res.body.applied, false)
})

test('lifecycle: cancel at period end, resume, payment failure, recovery, expiry', async () => {
  dodo.sub_1 = sub()
  await deliver('subscription.active', sub())

  dodo.sub_1 = sub({ cancel_at_next_billing_date: true })
  await deliver('subscription.updated', dodo.sub_1)
  let alice = read('users', 'alice')
  assert.equal(describeSubscription(alice).state, 'canceling')
  assert.equal(alice.hasCustomDomainAccess, true, 'still paid up')

  dodo.sub_1 = sub({ cancel_at_next_billing_date: false })
  await deliver('subscription.updated', dodo.sub_1)
  assert.equal(describeSubscription(read('users', 'alice')).state, 'active')

  // Renewal fails
  dodo.sub_1 = sub({ status: 'on_hold' })
  await deliver('subscription.on_hold', dodo.sub_1)
  alice = read('users', 'alice')
  assert.equal(describeSubscription(alice).state, 'past_due')
  assert.equal(alice.hasCustomDomainAccess, true, 'grace period')
  const graceUntil = alice.subscription.graceUntil
  assert.ok(Math.abs(Date.parse(graceUntil) - (Date.now() + PAYMENT_GRACE_DAYS * DAY)) < 5000)

  // A second on_hold delivery doesn't restart the clock
  await deliver('subscription.on_hold', dodo.sub_1)
  assert.equal(read('users', 'alice').subscription.graceUntil, graceUntil)
  assert.equal(hasActiveAccess(read('users', 'alice'), Date.now() + (PAYMENT_GRACE_DAYS + 1) * DAY), false)

  // Card updated, payment goes through
  dodo.sub_1 = sub()
  await deliver('subscription.active', dodo.sub_1)
  alice = read('users', 'alice')
  assert.equal(describeSubscription(alice).state, 'active')
  assert.equal(alice.subscription.graceUntil, null)

  // Term ends
  dodo.sub_1 = sub({ status: 'expired' })
  await deliver('subscription.expired', dodo.sub_1)
  alice = read('users', 'alice')
  assert.equal(alice.hasCustomDomainAccess, false)

  assert.deepEqual(subscriptionEmails(), ['activated', 'canceled', 'resumed', 'payment_failed', 'expired'])
})

test('lifecycle: past_due uses Dodo’s own grace deadline', async () => {
  const until = iso(NOW + 3 * DAY)
  dodo.sub_1 = sub({ status: 'past_due', past_due_ends_at: until })
  await deliver('subscription.past_due', dodo.sub_1)
  assert.equal(read('users', 'alice').subscription.graceUntil, until)
})

test('lifecycle: cancelled mid-period keeps the domain until the paid date', async () => {
  dodo.sub_1 = sub()
  await deliver('subscription.active', sub())
  dodo.sub_1 = sub({ status: 'cancelled', cancelled_at: iso(NOW) })
  await deliver('subscription.cancelled', dodo.sub_1)
  const alice = read('users', 'alice')
  assert.equal(alice.hasCustomDomainAccess, true)
  assert.equal(describeSubscription(alice).accessUntil, iso(NOW + 25 * DAY))
  assert.equal(hasActiveAccess(alice, NOW + 26 * DAY), false)
})

test('old subscriptions: events about a previous one never touch the current one', async () => {
  // Alice resubscribed: sub_2 is current, sub_1 is the old, ended one
  seed('users', 'alice', {
    name: 'alice',
    email: 'alice@example.com',
    hasCustomDomainAccess: true,
    subscription: { provider: 'dodo', id: 'sub_2', status: 'active', customerId: 'cus_1', currentPeriodEnd: iso(NOW + 20 * DAY) },
  })
  dodo.sub_1 = sub({ status: 'expired' })
  const res = await deliver('subscription.expired', dodo.sub_1)
  assert.equal(res.body.applied, false)
  const alice = read('users', 'alice')
  assert.equal(alice.subscription.id, 'sub_2')
  assert.equal(alice.hasCustomDomainAccess, true)
  assert.equal(alice.subscription.duplicateIds, undefined)
  assert.deepEqual(subscriptionEmails(), [])
})

test('old subscriptions: an ended one can’t replace a current one that is winding down', async () => {
  seed('users', 'alice', {
    name: 'alice',
    email: 'alice@example.com',
    hasCustomDomainAccess: true,
    subscription: { provider: 'dodo', id: 'sub_2', status: 'active', cancelAtPeriodEnd: true, customerId: 'cus_1', currentPeriodEnd: iso(NOW + 20 * DAY) },
  })
  dodo.sub_1 = sub({ status: 'expired' })
  await deliver('subscription.expired', dodo.sub_1)
  const alice = read('users', 'alice')
  assert.equal(alice.subscription.id, 'sub_2')
  assert.equal(alice.hasCustomDomainAccess, true)
  assert.deepEqual(subscriptionEmails(), [])
})

test('resubscribing replaces an ended subscription', async () => {
  seed('users', 'alice', {
    name: 'alice',
    email: 'alice@example.com',
    hasCustomDomainAccess: false,
    subscription: { provider: 'dodo', id: 'sub_old', status: 'expired', customerId: 'cus_1' },
  })
  dodo.sub_1 = sub()
  await deliver('subscription.active', sub())
  const alice = read('users', 'alice')
  assert.equal(alice.subscription.id, 'sub_1')
  assert.equal(alice.hasCustomDomainAccess, true)
  assert.deepEqual(subscriptionEmails(), ['activated'])
})

test('double checkout: a second active subscription is recorded, not swapped in', async () => {
  dodo.sub_1 = sub()
  await deliver('subscription.active', sub())
  dodo.sub_2 = sub({ subscription_id: 'sub_2' })
  const res = await deliver('subscription.active', dodo.sub_2)
  assert.equal(res.body.reason, 'duplicate-subscription')
  const alice = read('users', 'alice')
  assert.equal(alice.subscription.id, 'sub_1')
  assert.deepEqual(alice.subscription.duplicateIds, ['sub_2'])
})

test('legacy Polar subscribers are replaced cleanly by a Dodo subscription', async () => {
  seed('users', 'alice', {
    name: 'alice',
    hasCustomDomainAccess: true,
    subscription: { id: 'polar_1', status: 'active', customerId: 'polar_cus', cancelAtPeriodEnd: false },
  })
  dodo.sub_1 = sub()
  await deliver('subscription.active', sub())
  assert.equal(read('users', 'alice').subscription.provider, 'dodo')
})

// ---- checkout ----

test('checkout: requires sign-in and only for yourself', async () => {
  assert.equal((await call(checkout, POST({}, { userId: 'alice' }))).statusCode, 401)
  assert.equal((await call(checkout, POST(authHeader('bob'), { userId: 'alice' }))).statusCode, 403)
})

test('checkout: creates a Dodo session for the Pro product and remembers it', async () => {
  const res = await call(checkout, POST({ ...authHeader('alice', { email: 'Alice@Example.com' }), host: 'bublr.life' }, { userId: 'alice' }))
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.checkoutUrl, 'https://test.checkout.dodopayments.com/cks_1')

  const req = calls.find(c => c.path === '/checkouts')
  assert.deepEqual(req.body.product_cart, [{ product_id: 'pdt_pro', quantity: 1 }])
  assert.equal(req.body.metadata.userId, 'alice')
  assert.equal(req.body.customer.email, 'Alice@Example.com', 'uses the verified sign-in email')
  assert.equal(req.body.return_url, 'https://bublr.life/dashboard/settings/domain?checkout=success')
  assert.equal(req.body.cancel_url, 'https://bublr.life/dashboard/settings/domain?checkout=cancelled')

  const pending = read('users', 'alice').pendingCheckout
  assert.equal(pending.sessionId, 'cks_1')
  assert.equal(pending.email, 'alice@example.com')
})

test('checkout: returns to the deployment you started from, never to a writer’s domain', async () => {
  await call(checkout, POST({ ...authHeader('alice'), host: 'bublr-git-x.vercel.app' }, { userId: 'alice' }))
  assert.match(calls.find(c => c.path === '/checkouts').body.return_url, /^https:\/\/bublr-git-x\.vercel\.app\//)

  await call(checkout, POST({ ...authHeader('alice'), host: 'localhost:3000' }, { userId: 'alice' }))
  assert.match(calls.filter(c => c.path === '/checkouts')[1].body.return_url, /^http:\/\/localhost:3000\//)

  await call(checkout, POST({ ...authHeader('alice'), host: 'evil.example.com' }, { userId: 'alice' }))
  assert.match(calls.filter(c => c.path === '/checkouts')[2].body.return_url, /^https:\/\/bublr\.life\//)
})

test('checkout: without a sign-in email, a typed one is used; garbage is not', async () => {
  await call(checkout, POST(authHeader('alice'), { userId: 'alice', userEmail: 'billing@example.com' }))
  assert.equal(calls.find(c => c.path === '/checkouts').body.customer.email, 'billing@example.com')
  await call(checkout, POST(authHeader('alice'), { userId: 'alice', userEmail: 'not an email' }))
  assert.equal(calls.filter(c => c.path === '/checkouts')[1].body.customer, undefined, 'Dodo asks for it instead')
})

test('checkout: refuses to sell a second subscription', async () => {
  seed('users', 'alice', { name: 'alice', hasCustomDomainAccess: true, subscription: { provider: 'dodo', id: 'sub_1', status: 'active', currentPeriodEnd: iso(NOW + DAY) } })
  const active = await call(checkout, POST(authHeader('alice'), { userId: 'alice' }))
  assert.equal(active.statusCode, 409)
  assert.equal(active.body.code, 'ALREADY_SUBSCRIBED')

  seed('users', 'alice', { name: 'alice', hasCustomDomainAccess: true, subscription: { provider: 'dodo', id: 'sub_1', status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: iso(NOW + DAY) } })
  assert.equal((await call(checkout, POST(authHeader('alice'), { userId: 'alice' }))).body.code, 'CAN_RESUME')

  seed('users', 'alice', { name: 'alice', hasCustomDomainAccess: true, subscription: { provider: 'dodo', id: 'sub_1', status: 'on_hold', graceUntil: iso(NOW + DAY) } })
  assert.equal((await call(checkout, POST(authHeader('alice'), { userId: 'alice' }))).body.code, 'PAYMENT_ISSUE')

  assert.equal(calls.filter(c => c.path === '/checkouts').length, 0)
})

test('checkout: an ended subscription can buy again', async () => {
  seed('users', 'alice', { name: 'alice', hasCustomDomainAccess: false, subscription: { provider: 'dodo', id: 'sub_1', status: 'expired' } })
  assert.equal((await call(checkout, POST(authHeader('alice'), { userId: 'alice' }))).statusCode, 200)
})

test('checkout: says so clearly when payments aren’t configured or Dodo fails', async () => {
  const saved = process.env.DODO_PAYMENTS_PRODUCT_ID
  delete process.env.DODO_PAYMENTS_PRODUCT_ID
  try {
    const res = await call(checkout, POST(authHeader('alice'), { userId: 'alice' }))
    assert.equal(res.statusCode, 503)
    assert.equal(res.body.code, 'BILLING_NOT_CONFIGURED')
  } finally {
    process.env.DODO_PAYMENTS_PRODUCT_ID = saved
  }

  dodoDown = true
  const down = await call(checkout, POST(authHeader('alice'), { userId: 'alice' }))
  assert.equal(down.statusCode, 502)
  assert.equal(read('users', 'alice').pendingCheckout, undefined)
})

// ---- sync after checkout ----

test('sync: coming back from checkout switches Pro on before the webhook lands', async () => {
  dodo.sub_1 = sub()
  const res = await call(sync, POST(authHeader('alice'), { userId: 'alice', subscriptionId: 'sub_1' }))
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.hasCustomDomainAccess, true)
  assert.equal(res.body.state, 'active')

  // The webhook arriving afterwards doesn't send a second welcome email
  await deliver('subscription.active', sub())
  assert.deepEqual(subscriptionEmails(), ['activated'])
})

test('sync: can’t claim someone else’s subscription', async () => {
  dodo.sub_1 = sub() // metadata says alice
  const res = await call(sync, POST(authHeader('bob'), { userId: 'bob', subscriptionId: 'sub_1' }))
  assert.equal(res.statusCode, 403)
  assert.equal(read('users', 'bob').hasCustomDomainAccess, undefined)

  // Without metadata, a matching open checkout is required
  dodo.sub_2 = sub({ subscription_id: 'sub_2', metadata: {} })
  const sneaky = await call(sync, POST(authHeader('bob'), { userId: 'bob', subscriptionId: 'sub_2' }))
  assert.equal(sneaky.statusCode, 403)
})

test('sync: metadata naming another writer wins over a look-alike checkout', async () => {
  // Bob opened a checkout with Alice's billing email; the subscription Dodo
  // returns is tagged for Alice, so Bob still can't take it
  seed('users', 'bob', {
    name: 'bob',
    pendingCheckout: { email: 'alice@example.com', createdAt: iso(NOW - 60 * 1000) },
  })
  dodo.sub_1 = sub({ created_at: iso(NOW) })
  const res = await call(sync, POST(authHeader('bob'), { userId: 'bob', subscriptionId: 'sub_1' }))
  assert.equal(res.statusCode, 403)
  assert.equal(read('users', 'bob').subscription, undefined)
})

test('sync: bad and unknown subscription IDs', async () => {
  assert.equal((await call(sync, POST(authHeader('alice'), { userId: 'alice', subscriptionId: '../../etc' }))).statusCode, 400)
  assert.equal((await call(sync, POST(authHeader('alice'), { userId: 'alice', subscriptionId: 'sub_nope' }))).statusCode, 404)
  const nothing = await call(sync, POST(authHeader('alice'), { userId: 'alice' }))
  assert.equal(nothing.statusCode, 200)
  assert.equal(nothing.body.state, 'none')
})

// ---- status ----

test('status: re-reads a stale open subscription from Dodo (missed webhook)', async () => {
  seed('users', 'alice', {
    name: 'alice',
    email: 'alice@example.com',
    hasCustomDomainAccess: true,
    subscription: { provider: 'dodo', id: 'sub_1', status: 'active', customerId: 'cus_1', lastSyncedAt: iso(NOW - DAY) },
  })
  dodo.sub_1 = sub({ cancel_at_next_billing_date: true })
  const res = await call(status, { method: 'GET', headers: authHeader('alice'), query: { userId: 'alice' } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.state, 'canceling')
  assert.equal(res.body.subscription.canManageBilling, true)
  assert.equal(res.body.plan.price, '$4.99')
})

test('status: a fresh subscription isn’t re-read on every page view', async () => {
  seed('users', 'alice', {
    name: 'alice',
    hasCustomDomainAccess: true,
    subscription: { provider: 'dodo', id: 'sub_1', status: 'active', lastSyncedAt: iso(Date.now()) },
  })
  await call(status, { method: 'GET', headers: authHeader('alice'), query: { userId: 'alice' } })
  assert.equal(calls.filter(c => c.path.startsWith('/subscriptions')).length, 0)
})

test('status: a paid period that quietly ran out switches off once, with one email', async () => {
  seed('users', 'alice', {
    name: 'alice',
    email: 'alice@example.com',
    hasCustomDomainAccess: true,
    subscription: { provider: 'dodo', id: 'sub_1', status: 'cancelled', currentPeriodEnd: iso(NOW - DAY) },
  })
  const res = await call(status, { method: 'GET', headers: authHeader('alice'), query: { userId: 'alice' } })
  assert.equal(res.body.hasCustomDomainAccess, false)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, false)
  await call(status, { method: 'GET', headers: authHeader('alice'), query: { userId: 'alice' } })
  assert.deepEqual(subscriptionEmails(), ['expired'])
})

test('status: only for yourself', async () => {
  const res = await call(status, { method: 'GET', headers: authHeader('bob'), query: { userId: 'alice' } })
  assert.equal(res.statusCode, 403)
})

// ---- portal and manage ----

test('portal: opens Dodo’s customer portal for your own customer', async () => {
  seed('users', 'alice', { name: 'alice', subscription: { provider: 'dodo', id: 'sub_1', status: 'active', customerId: 'cus_1' } })
  const res = await call(portal, POST({ ...authHeader('alice'), host: 'bublr.life' }, { userId: 'alice' }))
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.portalUrl, 'https://portal.example/cus_1')
  const req = calls.find(c => c.path.endsWith('/customer-portal/session'))
  assert.equal(req.query.return_url, 'https://bublr.life/dashboard/settings/domain')

  const none = await call(portal, POST(authHeader('bob'), { userId: 'bob' }))
  assert.equal(none.statusCode, 400)
})

test('manage: cancel at period end, then resume', async () => {
  dodo.sub_1 = sub()
  await deliver('subscription.active', sub())

  const cancelled = await call(manage, POST(authHeader('alice'), { userId: 'alice', action: 'cancel' }))
  assert.equal(cancelled.statusCode, 200)
  assert.equal(cancelled.body.state, 'canceling')
  assert.equal(calls.find(c => c.method === 'PATCH').body.cancel_at_next_billing_date, true)

  // Cancelling twice is a no-op
  const again = await call(manage, POST(authHeader('alice'), { userId: 'alice', action: 'cancel' }))
  assert.equal(again.statusCode, 200)
  assert.equal(calls.filter(c => c.method === 'PATCH').length, 1)

  const resumed = await call(manage, POST(authHeader('alice'), { userId: 'alice', action: 'resume' }))
  assert.equal(resumed.statusCode, 200)
  assert.equal(resumed.body.state, 'active')
  assert.deepEqual(subscriptionEmails(), ['activated', 'canceled', 'resumed'])
})

test('manage: can’t resume an ended subscription or act for someone else', async () => {
  seed('users', 'alice', { name: 'alice', subscription: { provider: 'dodo', id: 'sub_1', status: 'expired' } })
  assert.equal((await call(manage, POST(authHeader('alice'), { userId: 'alice', action: 'resume' }))).statusCode, 409)
  assert.equal((await call(manage, POST(authHeader('alice'), { userId: 'alice', action: 'cancel' }))).statusCode, 409)
  assert.equal((await call(manage, POST(authHeader('bob'), { userId: 'alice', action: 'cancel' }))).statusCode, 403)
  assert.equal((await call(manage, POST(authHeader('alice'), { userId: 'alice', action: 'delete' }))).statusCode, 400)
})

// ---- Pro-only features follow the same rules ----

test('Pro features: branding and newsletter templates stop when Pro ends', async () => {
  seed('users', 'alice', { name: 'alice', hasCustomDomainAccess: true, subscription: { provider: 'dodo', id: 'sub_1', status: 'cancelled', currentPeriodEnd: iso(NOW - 1000) } })
  const brand = await call(branding, POST(authHeader('alice'), { userId: 'alice', footerText: 'Hi' }))
  assert.equal(brand.statusCode, 403)
  const tmpl = await call(template, POST(authHeader('alice'), { userId: 'alice', htmlTemplate: '<p>{{unsubscribeUrl}}</p>' }))
  assert.equal(tmpl.statusCode, 403)

  seed('users', 'alice', { name: 'alice', hasCustomDomainAccess: true, subscription: { provider: 'dodo', id: 'sub_1', status: 'active' } })
  const ok = await call(branding, POST(authHeader('alice'), { userId: 'alice', footerText: '  Written by Alice  ' }))
  assert.equal(ok.statusCode, 200)
  assert.equal(read('users', 'alice').customBranding.footerText, 'Written by Alice')
  assert.equal((await call(branding, POST(authHeader('alice'), { userId: 'alice', footerText: 'x'.repeat(101) }))).statusCode, 400)
  assert.equal((await call(branding, POST(authHeader('alice'), { userId: 'alice', footerText: { evil: true } }))).statusCode, 400)
})

test('billing helpers: transition emails are decided from state, not event names', () => {
  const t = billing.transitionEmail
  assert.deepEqual(t({ hasAccess: false, state: 'none' }, { hasAccess: true, state: 'active' }), { type: 'activated' })
  assert.equal(t({ hasAccess: true, state: 'active' }, { hasAccess: true, state: 'active' }), null)
  assert.deepEqual(t({ hasAccess: true, state: 'active' }, { hasAccess: true, state: 'canceling', accessUntil: 'x' }), { type: 'canceled', periodEndDate: 'x' })
  assert.deepEqual(t({ hasAccess: true, state: 'canceling' }, { hasAccess: false, state: 'ended' }), { type: 'expired' })
  assert.equal(t({ hasAccess: false, state: 'none' }, { hasAccess: false, state: 'pending' }), null)
})

// ---- review fixes ----

test('the goodbye email goes out when Dodo reports the end after the paid period', async () => {
  // Typical: cancelled at period end, and Dodo's "cancelled" arrives just after it
  seed('users', 'alice', {
    name: 'alice',
    email: 'alice@example.com',
    hasCustomDomainAccess: true,
    subscription: { provider: 'dodo', id: 'sub_1', status: 'active', cancelAtPeriodEnd: true, customerId: 'cus_1', currentPeriodEnd: iso(NOW - 60 * 1000), lastSyncedAt: iso(NOW - DAY) },
  })
  dodo.sub_1 = sub({ status: 'cancelled', next_billing_date: iso(NOW - 60 * 1000), cancel_at_next_billing_date: true })
  await deliver('subscription.cancelled', dodo.sub_1)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, false)
  assert.deepEqual(subscriptionEmails(), ['expired'])

  // Replays and the status page don't say goodbye twice
  await deliver('subscription.cancelled', dodo.sub_1)
  await call(status, { method: 'GET', headers: authHeader('alice'), query: { userId: 'alice' } })
  assert.deepEqual(subscriptionEmails(), ['expired'])
})

test('an older copy of the subscription can’t undo a newer change', async () => {
  dodo.sub_1 = sub()
  await deliver('subscription.active', sub())
  const cancelled = await call(manage, POST(authHeader('alice'), { userId: 'alice', action: 'cancel' }))
  assert.equal(cancelled.body.state, 'canceling')

  // A status refresh that read Dodo before the cancel finishes afterwards
  const result = await billing.applyDodoSubscription(sub(), { userId: 'alice', source: 'refresh', snapshotAt: Date.now() - 60 * 1000 })
  assert.equal(result.reason, 'stale-snapshot')
  assert.equal(read('users', 'alice').subscription.cancelAtPeriodEnd, true)
  assert.deepEqual(subscriptionEmails(), ['activated', 'canceled'], 'no bogus "resumed" email')
})

test('with Dodo unreachable, a late webhook payload can’t roll state back', async () => {
  dodo.sub_1 = sub({ cancel_at_next_billing_date: true })
  await deliver('subscription.updated', dodo.sub_1) // stored: cancelling, read just now
  dodoDown = true
  const late = await deliver('subscription.active', sub(), { eventTime: Date.now() - 2 * 60 * 60 * 1000 })
  assert.equal(late.body.reason, 'stale-snapshot')
  assert.equal(read('users', 'alice').subscription.cancelAtPeriodEnd, true)
})

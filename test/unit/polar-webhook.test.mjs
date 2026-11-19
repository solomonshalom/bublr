// Polar webhook deliveries: the signature check (both of Polar's signing keys)
// and what the real /api/subscription/webhook route does with each event.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import { mockRes } from './helpers.mjs'
import { resetStore, seed, read } from './mocks/firebase.mjs'
import { sent, resetSent } from './mocks/resend.mjs'

// The route reads these when it's first imported.
const SECRET = `whsec_${crypto.randomBytes(24).toString('base64')}`
const PRODUCT = 'prod_custom_domain_monthly'
process.env.POLAR_WEBHOOK_SECRET = SECRET
process.env.POLAR_CUSTOM_DOMAIN_PRODUCT_ID = PRODUCT
delete process.env.POLAR_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID

const { validateEvent, verifySignature, WebhookVerificationError } = await import('../../src/lib/polar-webhook.js')
const webhook = (await import('../../src/pages/api/subscription/webhook.js')).default

// Polar signs with one of two keys, depending on when the secret was made.
const KEYS = {
  // before 8 September 2026: the UTF-8 bytes of the whole secret
  legacy: secret => Buffer.from(secret, 'utf8'),
  // since then (Standard Webhooks): the part after whsec_, base64-decoded
  standard: secret => Buffer.from(secret.slice('whsec_'.length), 'base64'),
}

function sign(body, { secret = SECRET, scheme = 'standard', at = Date.now(), id = 'evt_1' } = {}) {
  const timestamp = String(Math.floor(at / 1000))
  const mac = crypto.createHmac('sha256', KEYS[scheme](secret)).update(`${id}.${timestamp}.${body}`).digest('base64')
  return { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${mac}` }
}

// A subscription the way Polar sends it (snake_case, ISO dates).
function subscription(overrides = {}) {
  return {
    id: 'sub_1',
    status: 'active',
    customer_id: 'cus_1',
    product_id: PRODUCT,
    recurring_interval: 'month',
    current_period_start: '2026-11-19T10:00:00Z',
    current_period_end: '2026-12-19T10:00:00Z',
    cancel_at_period_end: false,
    metadata: { userId: 'alice', userName: 'alice' },
    ...overrides,
  }
}

// POST a delivery to the route. It reads the raw body off the request stream.
async function deliver(type, data, signing = {}) {
  const body = JSON.stringify({ type, timestamp: new Date().toISOString(), data })
  const req = {
    method: 'POST',
    headers: signing.headers || sign(body, signing),
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

test('polar webhook: accepts a delivery signed with either of Polar\'s keys', () => {
  const body = JSON.stringify({ type: 'order.paid', data: { id: 'ord_1' } })
  for (const scheme of ['legacy', 'standard']) {
    const event = validateEvent(body, sign(body, { scheme }), SECRET)
    assert.equal(event.type, 'order.paid', scheme)
    assert.equal(event.data.id, 'ord_1', scheme)
  }
})

test('polar webhook: an older secret without the whsec_ prefix still verifies', () => {
  const oldSecret = 'a3f9c0de51b74d2e8f6a'
  const body = '{"type":"order.paid","data":{}}'
  assert.doesNotThrow(() => verifySignature(body, sign(body, { secret: oldSecret, scheme: 'legacy' }), oldSecret))
})

test('polar webhook: refuses forged, altered, stale and unsigned deliveries', () => {
  const body = JSON.stringify({ type: 'subscription.active', data: subscription() })
  const refused = (headers, sentBody = body, secret = SECRET) =>
    assert.throws(() => verifySignature(sentBody, headers, secret), WebhookVerificationError)

  refused(sign(body, { secret: `whsec_${crypto.randomBytes(24).toString('base64')}` })) // someone else's secret
  refused(sign(body), body.replace('alice', 'mallory')) // body changed after signing
  refused(sign(body, { at: Date.now() - 10 * 60 * 1000 })) // replayed ten minutes later
  refused({}) // no signature at all
  refused({ ...sign(body), 'webhook-signature': 'v1,' }) // empty signature

  // A secret with nothing after the prefix must not turn into an empty key.
  const emptyKeyMac = crypto.createHmac('sha256', Buffer.alloc(0))
  const headers = sign(body)
  emptyKeyMac.update(`${headers['webhook-id']}.${headers['webhook-timestamp']}.${body}`)
  refused({ ...headers, 'webhook-signature': `v1,${emptyKeyMac.digest('base64')}` }, body, 'whsec_')
})

test('polar webhook: the route answers 403 to a bad signature and writes nothing', async () => {
  const res = await deliver('subscription.active', subscription(), { secret: 'whsec_bm90LXRoZS1zZWNyZXQ=' })
  assert.equal(res.statusCode, 403)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, undefined)
})

// ---- what the route does ----

test('polar webhook: a new subscription gives access and one welcome email', async () => {
  // Polar sends both events for a new subscription. Old and new keys both work.
  const created = await deliver('subscription.created', subscription(), { scheme: 'legacy', id: 'evt_created' })
  const active = await deliver('subscription.active', subscription(), { scheme: 'standard', id: 'evt_active' })
  assert.equal(created.statusCode, 202)
  assert.equal(active.statusCode, 202)

  const alice = read('users', 'alice')
  assert.equal(alice.hasCustomDomainAccess, true)
  assert.equal(alice.subscription.id, 'sub_1')
  assert.equal(alice.subscription.status, 'active')
  assert.equal(alice.subscription.customerId, 'cus_1')
  assert.equal(alice.subscription.productId, PRODUCT)
  assert.equal(alice.subscription.cancelAtPeriodEnd, false)
  assert.equal(alice.subscription.currentPeriodEnd.getTime(), Date.parse('2026-12-19T10:00:00Z'))

  const welcomes = sent.filter(email => email.kind === 'subscription' && email.type === 'activated')
  assert.equal(welcomes.length, 1)
  assert.equal(welcomes[0].userEmail, 'alice@example.com')
})

test('polar webhook: event types we don\'t handle are acknowledged, not failed', async () => {
  // Polar retries anything that isn't a 2xx and disables the endpoint after ten in a row.
  for (const [type, data] of [
    ['subscription.cycled', subscription()],
    ['subscription.past_due', subscription({ status: 'past_due' })],
    ['member.created', { id: 'mem_1' }],
    ['checkout.expired', { id: 'chk_1' }],
    ['customer.state_changed', { id: 'cus_1', active_subscriptions: [] }],
  ]) {
    const res = await deliver(type, data)
    assert.equal(res.statusCode, 202, type)
  }
  assert.equal(read('users', 'alice').hasCustomDomainAccess, undefined)
  assert.equal(sent.length, 0)
})

test('polar webhook: subscriptions to another product in the same Polar organization are left alone', async () => {
  const other = { id: 'sub_other', product_id: 'prod_some_other_app' }

  // Carrying a userId that happens to be a Bublr writer: no access, no email.
  let res = await deliver('subscription.active', subscription(other))
  assert.equal(res.statusCode, 202)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, undefined)

  // Carrying a userId Bublr has never seen: used to throw (no such document) and answer 500.
  for (const type of ['subscription.created', 'subscription.updated', 'subscription.canceled', 'subscription.revoked']) {
    res = await deliver(type, subscription({ ...other, metadata: { userId: 'not-a-bublr-user' } }))
    assert.equal(res.statusCode, 202, type)
  }
  assert.equal(read('users', 'not-a-bublr-user'), undefined)
  assert.equal(sent.length, 0)
})

test('polar webhook: a subscription already on record is still ours after the product ID changes', async () => {
  seed('users', 'alice', {
    name: 'alice',
    email: 'alice@example.com',
    hasCustomDomainAccess: true,
    subscription: { id: 'sub_old', status: 'active', customerId: 'cus_1', productId: 'prod_retired' },
  })

  const res = await deliver('subscription.revoked', subscription({ id: 'sub_old', product_id: 'prod_retired', status: 'canceled' }))
  assert.equal(res.statusCode, 202)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, false)
  assert.equal(read('users', 'alice').subscription.status, 'revoked')
})

test('polar webhook: cancelling keeps access until the paid period ends, then it is revoked', async () => {
  await deliver('subscription.active', subscription())
  resetSent()

  const periodEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
  const canceled = await deliver('subscription.canceled', subscription({ cancel_at_period_end: true, current_period_end: periodEnd }))
  assert.equal(canceled.statusCode, 202)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, true)
  assert.equal(read('users', 'alice').subscription.cancelAtPeriodEnd, true)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].type, 'canceled')
  assert.equal(new Date(sent[0].periodEndDate).toISOString(), periodEnd)

  const revoked = await deliver('subscription.revoked', subscription({ status: 'canceled', current_period_end: periodEnd }))
  assert.equal(revoked.statusCode, 202)
  assert.equal(read('users', 'alice').hasCustomDomainAccess, false)
  assert.equal(sent[1].type, 'expired')
})

test('polar webhook: a failed renewal takes access away and a recovered one brings it back', async () => {
  await deliver('subscription.active', subscription())

  await deliver('subscription.updated', subscription({ status: 'past_due' }))
  assert.equal(read('users', 'alice').hasCustomDomainAccess, false)
  assert.equal(read('users', 'alice').subscription.status, 'past_due')

  await deliver('subscription.updated', subscription({ status: 'active' }))
  assert.equal(read('users', 'alice').hasCustomDomainAccess, true)
})

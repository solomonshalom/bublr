// The calls Bublr makes to Creem (start a checkout, open the billing portal)
// and the two routes that make them. Creem itself is a stubbed fetch.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { installTestCerts, authHeader, call } from './helpers.mjs'
import { resetStore, seed } from './mocks/firebase.mjs'

const PRODUCT = 'prod_custom_domain_monthly'
process.env.CREEM_API_KEY = 'creem_live_key_for_tests'
process.env.CREEM_CUSTOM_DOMAIN_PRODUCT_ID = PRODUCT
delete process.env.CREEM_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID
delete process.env.NEXT_PUBLIC_BASE_URL

const { apiBase, customDomainProductIds, createCheckout, createPortalLink, CreemError } = await import('../../src/lib/creem.js')
const createCheckoutRoute = (await import('../../src/pages/api/subscription/create-checkout.js')).default
const portalRoute = (await import('../../src/pages/api/subscription/portal.js')).default

// What Creem answers next, and what it was asked.
let requests = []
let reply = { status: 200, body: {} }

globalThis.fetch = async (url, init) => {
  requests.push({ url, method: init.method, headers: init.headers, body: JSON.parse(init.body) })
  const text = typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body)
  return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, text: async () => text }
}

const POST = (headers, body) => ({ method: 'POST', headers, body })

beforeEach(() => {
  installTestCerts()
  resetStore()
  requests = []
  reply = { status: 200, body: {} }
  process.env.CREEM_API_KEY = 'creem_live_key_for_tests'
  process.env.CREEM_CUSTOM_DOMAIN_PRODUCT_ID = PRODUCT
  seed('users', 'alice', { name: 'alice', displayName: 'Alice' })
})

test('creem: a test-mode key goes to the test API, any other key to the live one', () => {
  assert.equal(apiBase('creem_test_abc123'), 'https://test-api.creem.io')
  assert.equal(apiBase('creem_abc123'), 'https://api.creem.io')
  assert.equal(apiBase(undefined), 'https://api.creem.io')
})

test('creem: the plans this deployment sells are the configured product IDs', () => {
  assert.deepEqual(customDomainProductIds(), [PRODUCT])
  process.env.CREEM_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID = 'prod_yearly'
  assert.deepEqual(customDomainProductIds(), [PRODUCT, 'prod_yearly'])
  delete process.env.CREEM_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID
})

test('creem: starting a checkout sends the product, the email and the metadata', async () => {
  reply = { status: 200, body: { id: 'ch_1', checkout_url: 'https://checkout.creem.io/ch_1', status: 'pending' } }
  const checkout = await createCheckout({
    productId: PRODUCT,
    email: 'alice@example.com',
    successUrl: 'https://bublr.life/dashboard?subscription=success',
    metadata: { userId: 'alice' },
  })

  assert.deepEqual(checkout, { id: 'ch_1', url: 'https://checkout.creem.io/ch_1' })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://api.creem.io/v1/checkouts')
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[0].headers['x-api-key'], 'creem_live_key_for_tests')
  assert.deepEqual(requests[0].body, {
    product_id: PRODUCT,
    customer: { email: 'alice@example.com' },
    success_url: 'https://bublr.life/dashboard?subscription=success',
    metadata: { userId: 'alice' },
  })
})

test('creem: an error answer becomes a CreemError with the status and trace ID', async () => {
  reply = { status: 403, body: { trace_id: 'trace_123', status: 403, error: 'Forbidden', message: ['Insufficient permissions'] } }
  await assert.rejects(createPortalLink('cust_1'), error => {
    assert.ok(error instanceof CreemError)
    assert.equal(error.status, 403)
    assert.equal(error.traceId, 'trace_123')
    assert.match(error.message, /403/)
    assert.match(error.message, /Insufficient permissions/)
    // The key never ends up in an error message or a log line.
    assert.doesNotMatch(error.message, /creem_live_key_for_tests/)
    return true
  })

  // Not JSON at all (a gateway error page).
  reply = { status: 502, body: '<html>Bad gateway</html>' }
  await assert.rejects(createPortalLink('cust_1'), error => error instanceof CreemError && error.status === 502)

  // A 200 that's missing what we asked for.
  reply = { status: 200, body: {} }
  await assert.rejects(createPortalLink('cust_1'), CreemError)
  await assert.rejects(createCheckout({ productId: PRODUCT, email: 'a@example.com' }), CreemError)
})

test('creem: without an API key nothing is sent', async () => {
  delete process.env.CREEM_API_KEY
  await assert.rejects(createPortalLink('cust_1'), /CREEM_API_KEY not configured/)
  assert.equal(requests.length, 0)
})

// ---- the routes ----

test('checkout route: only the signed-in writer can start their own checkout', async () => {
  const anonymous = await call(createCheckoutRoute, POST({}, { userId: 'alice', userEmail: 'alice@example.com' }))
  assert.equal(anonymous.statusCode, 401)

  const other = await call(createCheckoutRoute, POST(authHeader('bob'), { userId: 'alice', userEmail: 'bob@example.com' }))
  assert.equal(other.statusCode, 403)
  assert.equal(requests.length, 0)
})

test('checkout route: returns Creem\'s checkout URL and ties the payment to the writer', async () => {
  reply = { status: 200, body: { id: 'ch_7', checkout_url: 'https://checkout.creem.io/ch_7' } }
  const res = await call(
    createCheckoutRoute,
    POST(authHeader('alice'), { userId: 'alice', userEmail: 'alice@example.com', userName: 'Alice' })
  )

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { checkoutUrl: 'https://checkout.creem.io/ch_7', checkoutId: 'ch_7' })
  assert.deepEqual(requests[0].body, {
    product_id: PRODUCT,
    customer: { email: 'alice@example.com' },
    success_url: 'https://bublr.life/dashboard?subscription=success',
    metadata: { userId: 'alice', userName: 'Alice', plan: 'pro' },
  })
})

test('checkout route: says so when the email or the product is missing, or Creem fails', async () => {
  const noEmail = await call(createCheckoutRoute, POST(authHeader('alice'), { userId: 'alice' }))
  assert.equal(noEmail.statusCode, 400)

  delete process.env.CREEM_CUSTOM_DOMAIN_PRODUCT_ID
  const noProduct = await call(createCheckoutRoute, POST(authHeader('alice'), { userId: 'alice', userEmail: 'a@example.com' }))
  assert.equal(noProduct.statusCode, 500)
  assert.equal(requests.length, 0)
  process.env.CREEM_CUSTOM_DOMAIN_PRODUCT_ID = PRODUCT

  reply = { status: 500, body: { error: 'Internal Server Error' } }
  const failed = await call(createCheckoutRoute, POST(authHeader('alice'), { userId: 'alice', userEmail: 'a@example.com' }))
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.error, 'Failed to create checkout session')
})

test('portal route: opens the billing portal for the writer\'s own Creem customer', async () => {
  seed('users', 'alice', { name: 'alice', subscription: { id: 'sub_1', status: 'active', customerId: 'cust_1' } })
  reply = { status: 200, body: { customer_portal_link: 'https://creem.io/my-orders/login/abc' } }

  const res = await call(portalRoute, POST(authHeader('alice'), { userId: 'alice' }))
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { portalUrl: 'https://creem.io/my-orders/login/abc' })
  assert.equal(requests[0].url, 'https://api.creem.io/v1/customers/billing')
  assert.deepEqual(requests[0].body, { customer_id: 'cust_1' })

  const other = await call(portalRoute, POST(authHeader('bob'), { userId: 'alice' }))
  assert.equal(other.statusCode, 403)
  assert.equal(requests.length, 1)
})

test('portal route: a writer who never subscribed has no portal', async () => {
  const res = await call(portalRoute, POST(authHeader('alice'), { userId: 'alice' }))
  assert.equal(res.statusCode, 400)
  assert.equal(requests.length, 0)
})

test('checkout route: a writer with a renewing plan can’t start a second subscription', async () => {
  seed('users', 'alice', { name: 'alice', displayName: 'Alice', hasCustomDomainAccess: true, subscription: { id: 'sub_1', status: 'active', cancelAtPeriodEnd: false } })
  const res = await call(
    createCheckoutRoute,
    POST(authHeader('alice'), { userId: 'alice', userEmail: 'alice@example.com', userName: 'Alice', plan: 'shop' })
  )
  assert.equal(res.statusCode, 409)
  assert.equal(res.body.code, 'ALREADY_SUBSCRIBED')
  assert.equal(requests.length, 0)
})

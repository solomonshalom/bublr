// The shop's API routes, end to end against the in-memory Firestore, with
// Stripe and Creem replaced by a stubbed fetch. Covers the promises the
// feature makes: only paying writers get a shop, prices come from the server,
// money goes to the writer's own account, secrets never leak.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { installTestCerts, authHeader, call } from './helpers.mjs'
import { resetStore, seed, read } from './mocks/firebase.mjs'
import { sent, resetSent } from './mocks/resend.mjs'

process.env.INTEGRATIONS_SECRET = 'test-integrations-secret-that-is-long-enough-123'
process.env.RESEND_API_KEY = 're_test'
delete process.env.NEXT_PUBLIC_BASE_URL

const { seal, open, hashId } = await import('../../src/lib/secret-box.js')
const { signShopGrant, signCatalogue } = await import('../../src/lib/shop-trust.js')
const { normalizeProduct } = await import('../../src/lib/shop.js')
const { resetRateLimits } = await import('../../src/lib/rate-limit.js')

// Fake keys are joined at runtime so secret scanners don't mistake them for real ones.
const fakeKey = (...parts) => parts.join('_')

const productsRoute = (await import('../../src/pages/api/shop/products.js')).default
const paymentsRoute = (await import('../../src/pages/api/shop/payments.js')).default
const checkoutRoute = (await import('../../src/pages/api/shop/checkout.js')).default
const completeRoute = (await import('../../src/pages/api/shop/checkout-complete.js')).default
const ordersRoute = (await import('../../src/pages/api/shop/orders.js')).default

const STRIPE_KEY = fakeKey('rk', 'test', '51abcdefghijklmnopqrstuv')
const CREEM_KEY = fakeKey('creem', 'test', 'abcdefghijklmnop')

let requests = []
let replies = []
globalThis.fetch = async (url, init = {}) => {
  const body = init.body ? (String(init.headers?.['Content-Type'] || '').includes('json') ? JSON.parse(init.body) : new URLSearchParams(init.body)) : null
  requests.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body })
  const reply = replies.shift() || { status: 200, body: {} }
  const text = JSON.stringify(reply.body)
  return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, text: async () => text, json: async () => JSON.parse(text) }
}

const shopPlan = {
  hasCustomDomainAccess: true,
  hasShopAccess: true,
  subscription: { id: 'sub_1', status: 'active', cancelAtPeriodEnd: false, productId: 'prod_shop' },
}

const tee = () => normalizeProduct({
  id: 'tee0000001',
  title: 'Rich Kids tee',
  price: 2500,
  currency: 'usd',
  kind: 'physical',
  shipping: 500,
  images: ['https://res.cloudinary.com/x/image/upload/tee.jpg'],
  colors: [{ id: 'white001', title: 'White', hex: '#ffffff' }],
  sizes: [{ id: 'sizes001', title: 'S' }, { id: 'sizem001', title: 'M', available: false }],
})

const ebook = () => normalizeProduct({ id: 'ebook00001', title: 'Zine', price: 900, currency: 'usd', kind: 'digital', images: [] })

// A writer as the server leaves them: plan granted by the webhook, catalogue
// signed when saved. `extra` can override anything, including those.
function seedWriter(extra = {}, { mode = 'live', products } = {}) {
  const list = products || [tee(), { ...ebook(), deliverySealed: seal('https://drive.example/zine.pdf', 'alice:shop-delivery:ebook00001') }]
  seed('users', 'alice', {
    name: 'alice',
    displayName: 'Alice',
    email: 'alice@example.com',
    ...shopPlan,
    shopGrant: signShopGrant('alice', shopPlan.subscription),
    shop: { products: list, sig: signCatalogue('alice', list) },
    integrations: { payments: { provider: 'stripe', keySealed: seal(STRIPE_KEY, 'alice:payments'), keyHint: 'rk_test_…stuv', mode } },
    ...extra,
  })
}

const buyer = { first_name: 'Ana', last_name: 'Lee', email: 'ana@example.com', country: 'NL', address1: 'Damrak 1', city: 'Amsterdam', zip: '1012', phone: '+31 612345678' }
const req = (method, { headers = {}, body = {}, query = {} } = {}) => ({ method, headers: { host: 'bublr.life', ...headers }, body, query })

beforeEach(() => {
  installTestCerts()
  resetStore()
  resetSent()
  resetRateLimits()
  requests = []
  replies = []
  process.env.INTEGRATIONS_SECRET = 'test-integrations-secret-that-is-long-enough-123'
})

// ---------------------------------------------------------------- the plan gate

test('products: only a writer on Pro + Shop can save a shop', async () => {
  seed('users', 'bob', { name: 'bob', hasCustomDomainAccess: true, hasShopAccess: false, subscription: { status: 'active' } })
  const res = await call(productsRoute, req('PUT', { headers: authHeader('bob'), body: { products: [] } }))
  assert.equal(res.statusCode, 402)
  assert.equal(res.body.code, 'SHOP_PLAN_REQUIRED')

  const anon = await call(productsRoute, req('PUT', { body: { products: [] } }))
  assert.equal(anon.statusCode, 401)
})

test('products: saved after server-side checks; download links are sealed and stay private', async () => {
  seedWriter()
  const res = await call(
    productsRoute,
    req('PUT', {
      headers: authHeader('alice'),
      body: {
        products: [{ ...ebook(), title: 'Zine vol. 2', price: 1200 }],
        deliveryLinks: { ebook00001: 'https://drive.example/zine-2.pdf' },
      },
    })
  )
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.products[0].hasDelivery, true)
  assert.ok(!JSON.stringify(res.body).includes('drive.example'))
  const saved = read('users', 'alice').shop.products[0]
  assert.equal(saved.price, 1200)
  assert.ok(read('users', 'alice').shop.sig, 'the saved catalogue is signed')
  assert.equal(open(saved.deliverySealed, 'alice:shop-delivery:ebook00001'), 'https://drive.example/zine-2.pdf')

  const bad = await call(productsRoute, req('PUT', { headers: authHeader('alice'), body: { products: [{ title: 'x', price: 1 }] } }))
  assert.equal(bad.statusCode, 400)
  const badLink = await call(productsRoute, req('PUT', { headers: authHeader('alice'), body: { products: [ebook()], deliveryLinks: { ebook00001: 'http://insecure' } } }))
  assert.equal(badLink.statusCode, 400)
})

// ---------------------------------------------------------------- connecting payments

test('payments: a Stripe key is checked with Stripe, then stored sealed', async () => {
  seedWriter({ integrations: {} })
  replies = [{ status: 200, body: { data: [] } }, { status: 403, body: { error: { message: 'no account access' } } }]
  const res = await call(paymentsRoute, req('POST', { headers: authHeader('alice'), body: { apiKey: STRIPE_KEY } }))
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.payments.provider, 'stripe')
  assert.equal(res.body.payments.mode, 'test')
  assert.ok(!JSON.stringify(res.body).includes(STRIPE_KEY))
  assert.equal(requests[0].url, 'https://api.stripe.com/v1/checkout/sessions?limit=1')
  assert.equal(requests[0].headers.Authorization, `Bearer ${STRIPE_KEY}`)
  const stored = read('users', 'alice').integrations.payments
  assert.ok(!JSON.stringify(stored).includes(STRIPE_KEY))
  assert.equal(open(stored.keySealed, 'alice:payments'), STRIPE_KEY)

  const status = await call(paymentsRoute, req('GET', { headers: authHeader('alice') }))
  assert.equal(status.body.payments.keyHint, 'rk_test_…stuv')
  assert.ok(!JSON.stringify(status.body).includes('keySealed'))
})

test('payments: rejected keys, publishable keys and other junk are refused', async () => {
  seedWriter({ integrations: {} })
  replies = [{ status: 401, body: { error: { message: 'Invalid API Key' } } }]
  const wrong = await call(paymentsRoute, req('POST', { headers: authHeader('alice'), body: { apiKey: fakeKey('rk', 'live', '0000000000000000') } }))
  assert.equal(wrong.statusCode, 400)
  assert.match(wrong.body.error, /didn’t accept/)

  const fullSecret = await call(paymentsRoute, req('POST', { headers: authHeader('alice'), body: { apiKey: fakeKey('sk', 'live', '0000000000000000') } }))
  assert.equal(fullSecret.statusCode, 400, 'a full secret key can refund and pay out, so only restricted keys are kept')
  assert.match(fullSecret.body.error, /restricted key/)

  const junk = await call(paymentsRoute, req('POST', { headers: authHeader('alice'), body: { apiKey: fakeKey('pk', 'live', '0000000000000000') } }))
  assert.equal(junk.statusCode, 400)
  assert.equal(read('users', 'alice').integrations.payments, undefined)
})

test('payments: a Creem key is checked against the right API and can be disconnected', async () => {
  seedWriter({ integrations: {} })
  replies = [{ status: 200, body: { items: [] } }]
  const res = await call(paymentsRoute, req('POST', { headers: authHeader('alice'), body: { apiKey: CREEM_KEY } }))
  assert.equal(res.statusCode, 200)
  assert.equal(requests[0].url, 'https://test-api.creem.io/v1/products/search?page_number=1&page_size=1')
  assert.equal(requests[0].headers['x-api-key'], CREEM_KEY)
  const gone = await call(paymentsRoute, req('DELETE', { headers: authHeader('alice') }))
  assert.equal(gone.statusCode, 200)
  assert.equal(read('users', 'alice').integrations.payments, undefined)
})

// ---------------------------------------------------------------- buying

test('checkout: a Stripe checkout on the writer’s own account, priced from the saved product', async () => {
  seedWriter()
  replies = [{ status: 200, body: { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' } }]
  const res = await call(
    checkoutRoute,
    req('POST', { body: { username: 'alice', productId: 'tee0000001', colorId: 'white001', sizeId: 'sizes001', buyer, price: 1 } })
  )
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.checkoutUrl, 'https://checkout.stripe.com/c/pay/cs_test_1')

  const r = requests[0]
  assert.equal(r.url, 'https://api.stripe.com/v1/checkout/sessions')
  assert.equal(r.headers.Authorization, `Bearer ${STRIPE_KEY}`, 'uses the writer’s key, not Bublr’s')
  assert.match(r.headers['Idempotency-Key'], /^bublr-/)
  const f = r.body
  assert.equal(f.get('mode'), 'payment')
  assert.equal(f.get('line_items[0][price_data][unit_amount]'), '2500', 'price from the server, not the request')
  assert.equal(f.get('line_items[0][price_data][product_data][name]'), 'Rich Kids tee (White / S)')
  assert.equal(f.get('line_items[1][price_data][unit_amount]'), '500')
  assert.equal(f.get('line_items[1][price_data][product_data][name]'), 'Shipping')
  assert.equal(f.get('metadata[bublr_user]'), 'alice')
  assert.equal(f.get('payment_intent_data[shipping][address][line1]'), 'Damrak 1')
  assert.equal(f.get('payment_intent_data[shipping][address][country]'), 'NL')
  assert.equal(f.get('customer_email'), 'ana@example.com')
  assert.equal(f.get('success_url'), 'https://bublr.life/alice/shop/tee0000001?checkout=success&session_id={CHECKOUT_SESSION_ID}')
  assert.equal(f.get('cancel_url'), 'https://bublr.life/alice/shop/tee0000001?checkout=cancelled')
})

test('checkout: buyers on the writer’s custom domain come back there', async () => {
  seedWriter({ customDomain: { domain: 'alice.example', status: 'verified' } })
  replies = [{ status: 200, body: { id: 'cs_2', url: 'https://checkout.stripe.com/c/pay/cs_2' } }]
  await call(checkoutRoute, req('POST', { headers: { host: 'alice.example' }, body: { username: 'alice', productId: 'tee0000001', colorId: 'white001', sizeId: 'sizes001', buyer } }))
  assert.equal(requests[0].body.get('cancel_url'), 'https://alice.example/shop/tee0000001?checkout=cancelled')

  requests = []
  replies = [{ status: 200, body: { id: 'cs_3', url: 'https://checkout.stripe.com/c/pay/cs_3' } }]
  await call(checkoutRoute, req('POST', { headers: { host: 'evil.example' }, body: { username: 'alice', productId: 'tee0000001', colorId: 'white001', sizeId: 'sizes001', buyer } }))
  assert.match(requests[0].body.get('cancel_url'), /^https:\/\/bublr\.life\//, 'an unknown host never becomes the return address')
})

test('checkout: refused when the shop is closed, unpaid, sold out or the option is out of stock', async () => {
  seedWriter({ hasShopAccess: false })
  const closed = await call(checkoutRoute, req('POST', { body: { username: 'alice', productId: 'tee0000001', colorId: 'white001', sizeId: 'sizes001', buyer } }))
  assert.equal(closed.statusCode, 403)

  resetStore()
  seedWriter({ integrations: {} })
  const noPayments = await call(checkoutRoute, req('POST', { body: { username: 'alice', productId: 'tee0000001', colorId: 'white001', sizeId: 'sizes001', buyer } }))
  assert.equal(noPayments.statusCode, 409)

  resetStore()
  seedWriter()
  const outOfStock = await call(checkoutRoute, req('POST', { body: { username: 'alice', productId: 'tee0000001', colorId: 'white001', sizeId: 'sizem001', buyer } }))
  assert.equal(outOfStock.statusCode, 400)
  const missingAddress = await call(checkoutRoute, req('POST', { body: { username: 'alice', productId: 'tee0000001', colorId: 'white001', sizeId: 'sizes001', buyer: { ...buyer, address1: '' } } }))
  assert.equal(missingAddress.statusCode, 400)
  const unknown = await call(checkoutRoute, req('POST', { body: { username: 'alice', productId: 'nope', buyer } }))
  assert.equal(unknown.statusCode, 404)
  assert.equal(requests.length, 0, 'nothing reached Stripe')
})

test('checkout: Creem sells digital items through a product made once in the writer’s store', async () => {
  seedWriter({ integrations: { payments: { provider: 'creem', keySealed: seal(CREEM_KEY, 'alice:payments'), mode: 'live', creemProducts: {} } } })
  replies = [
    { status: 200, body: { id: 'prod_creem_1' } },
    { status: 200, body: { id: 'ch_1', checkout_url: 'https://checkout.creem.io/ch_1' } },
    { status: 200, body: { id: 'ch_2', checkout_url: 'https://checkout.creem.io/ch_2' } },
  ]
  const digitalBuyer = { first_name: 'Ana', last_name: 'Lee', email: 'ana@example.com' }
  const first = await call(checkoutRoute, req('POST', { body: { username: 'alice', productId: 'ebook00001', buyer: digitalBuyer } }))
  assert.equal(first.statusCode, 200)
  assert.equal(requests[0].url, 'https://test-api.creem.io/v1/products')
  assert.equal(requests[0].body.price, 900)
  assert.equal(requests[0].body.billing_type, 'onetime')
  assert.equal(requests[1].body.product_id, 'prod_creem_1')
  assert.equal(requests[1].body.metadata.bublr_user, 'alice')

  const second = await call(checkoutRoute, req('POST', { body: { username: 'alice', productId: 'ebook00001', buyer: digitalBuyer } }))
  assert.equal(second.statusCode, 200)
  assert.equal(requests.length, 3, 'the Creem product is reused')

  // Someone points the cache at a cheaper Creem product: the forged entry has
  // no valid signature, so a fresh product at the right price is made.
  const cache = read('users', 'alice').integrations.payments.creemProducts
  const key = Object.keys(cache)[0]
  seed('users', 'alice', { ...read('users', 'alice'), integrations: { payments: { ...read('users', 'alice').integrations.payments, creemProducts: { [key]: { id: 'prod_cheap', sig: 'forged' } } } } })
  replies = [{ status: 200, body: { id: 'prod_creem_2' } }, { status: 200, body: { id: 'ch_3', checkout_url: 'https://checkout.creem.io/ch_3' } }]
  requests = []
  await call(checkoutRoute, req('POST', { body: { username: 'alice', productId: 'ebook00001', buyer: digitalBuyer } }))
  assert.equal(requests[0].url, 'https://test-api.creem.io/v1/products')
  assert.equal(requests[1].body.product_id, 'prod_creem_2')

  const physical = await call(checkoutRoute, req('POST', { body: { username: 'alice', productId: 'tee0000001', colorId: 'white001', sizeId: 'sizes001', buyer } }))
  assert.equal(physical.statusCode, 409, 'Creem cannot sell things that ship')
})

// ---------------------------------------------------------------- after paying

const paidSession = (extra = {}) => ({
  id: 'cs_test_1',
  status: 'complete',
  payment_status: 'paid',
  amount_total: 3000,
  currency: 'usd',
  customer_details: { email: 'ana@example.com', name: 'Ana Lee' },
  metadata: { bublr_user: 'alice', bublr_product: 'tee0000001', bublr_order: 'order0000000001', bublr_variant: 'White / S' },
  payment_intent: { shipping: { name: 'Ana Lee', phone: '+31 612345678', address: { line1: 'Damrak 1', city: 'Amsterdam', postal_code: '1012', country: 'NL' } } },
  ...extra,
})

test('checkout: a writer’s test key never sells to visitors, only to the writer', async () => {
  seedWriter({}, { mode: 'test' })
  const visitor = await call(checkoutRoute, req('POST', { body: { username: 'alice', productId: 'ebook00001', buyer: { first_name: 'A', last_name: 'B', email: 'a@b.co' } } }))
  assert.equal(visitor.statusCode, 403)
  const stranger = await call(checkoutRoute, req('POST', { headers: authHeader('mallory'), body: { username: 'alice', productId: 'ebook00001', buyer: { first_name: 'A', last_name: 'B', email: 'a@b.co' } } }))
  assert.equal(stranger.statusCode, 403)
  replies = [{ status: 200, body: { id: 'cs_t', url: 'https://checkout.stripe.com/c/pay/cs_t' } }]
  const owner = await call(checkoutRoute, req('POST', { headers: authHeader('alice'), body: { username: 'alice', productId: 'ebook00001', buyer: { first_name: 'A', last_name: 'B', email: 'a@b.co' } } }))
  assert.equal(owner.statusCode, 200)
})

test('checkout: a plan or catalogue written straight into Firestore is not trusted', async () => {
  seedWriter({ shopGrant: 'forged' })
  const forgedPlan = await call(checkoutRoute, req('POST', { body: { username: 'alice', productId: 'tee0000001', colorId: 'white001', sizeId: 'sizes001', buyer } }))
  assert.equal(forgedPlan.statusCode, 403)

  resetStore()
  const cheap = [{ ...tee(), price: 50 }]
  seedWriter({ shop: { products: cheap, sig: signCatalogue('alice', [tee()]) } })
  const repriced = await call(checkoutRoute, req('POST', { body: { username: 'alice', productId: 'tee0000001', colorId: 'white001', sizeId: 'sizes001', buyer } }))
  assert.equal(repriced.statusCode, 404, 'an edited catalogue without the server’s signature sells nothing')
  assert.equal(requests.length, 0)

  const products = await call(productsRoute, req('PUT', { headers: authHeader('alice'), body: { products: [] } }))
  assert.equal(products.statusCode, 200, 'the writer can still save, which signs it again')
})

test('checkout-complete: a paid order is recorded once and the writer is emailed once', async () => {
  seedWriter()
  replies = [{ status: 200, body: paidSession() }, { status: 200, body: paidSession() }]
  const first = await call(completeRoute, req('GET', { query: { user: 'alice', session_id: 'cs_test_1' } }))
  assert.equal(first.statusCode, 200)
  assert.equal(first.body.paid, true)
  assert.match(requests[0].url, /\/v1\/checkout\/sessions\/cs_test_1\?expand\[\]=payment_intent$/)
  const again = await call(completeRoute, req('GET', { query: { user: 'alice', session_id: 'cs_test_1' } }))
  assert.equal(again.statusCode, 200)

  const orders = read('users', 'alice').shopOrders
  assert.equal(orders.length, 1)
  assert.equal(orders[0].amount, 3000)
  assert.ok(!JSON.stringify(orders).includes('Damrak'), 'buyer details are sealed')
  assert.ok(!JSON.stringify(orders).includes('cs_test_1'), 'the checkout id works like a receipt, so it is never stored in the open')
  assert.equal(orders[0].checkoutHash, hashId('cs_test_1'))
  const mails = sent.filter(m => m.kind === 'shop-order')
  assert.equal(mails.length, 1)
  assert.equal(mails[0].writerEmail, 'alice@example.com')
  assert.equal(mails[0].buyer.address.line1, 'Damrak 1')

  const list = await call(ordersRoute, req('GET', { headers: authHeader('alice') }))
  assert.equal(list.body.orders[0].buyer.name, 'Ana Lee')
  assert.equal(list.body.orders[0].checkoutId, 'cs_test_1', 'the writer sees their Stripe reference')
  assert.equal(list.body.orders[0].buyerSealed, undefined)
  const stranger = await call(ordersRoute, req('GET', { headers: authHeader('mallory') }))
  assert.equal(stranger.statusCode, 404)
})

test('checkout-complete: unpaid sessions and other writers’ sessions record nothing', async () => {
  seedWriter()
  replies = [{ status: 200, body: paidSession({ payment_status: 'unpaid', status: 'open' }) }]
  const unpaid = await call(completeRoute, req('GET', { query: { user: 'alice', session_id: 'cs_test_1' } }))
  assert.equal(unpaid.statusCode, 202)

  replies = [{ status: 200, body: paidSession({ metadata: { bublr_user: 'someone-else', bublr_product: 'tee0000001' } }) }]
  const foreign = await call(completeRoute, req('GET', { query: { user: 'alice', session_id: 'cs_test_1' } }))
  assert.equal(foreign.statusCode, 404)
  assert.equal(read('users', 'alice').shopOrders, undefined)

  const badId = await call(completeRoute, req('GET', { query: { user: 'alice', session_id: '../../x' } }))
  assert.equal(badId.statusCode, 400)
})

test('checkout-complete: paying less than the price confirms nothing and hands out nothing', async () => {
  seedWriter()
  replies = [{ status: 200, body: paidSession({ amount_total: 100, metadata: { bublr_user: 'alice', bublr_product: 'ebook00001', bublr_order: 'order0000000003', bublr_amount: '900', bublr_currency: 'usd' }, payment_intent: {} }) }]
  const res = await call(completeRoute, req('GET', { query: { user: 'alice', session_id: 'cs_test_cheap' } }))
  assert.equal(res.statusCode, 409)
  assert.equal(res.body.delivery, undefined)
  assert.equal(read('users', 'alice').shopOrders, undefined)

  replies = [{ status: 200, body: paidSession({ currency: 'inr', amount_total: 900, metadata: { bublr_user: 'alice', bublr_product: 'ebook00001', bublr_order: 'order0000000004', bublr_amount: '900', bublr_currency: 'usd' }, payment_intent: {} }) }]
  const otherCurrency = await call(completeRoute, req('GET', { query: { user: 'alice', session_id: 'cs_test_inr' } }))
  assert.equal(otherCurrency.statusCode, 409)
})

test('checkout-complete: a digital buyer gets the download link only after paying', async () => {
  seedWriter()
  replies = [{ status: 200, body: paidSession({ metadata: { bublr_user: 'alice', bublr_product: 'ebook00001', bublr_order: 'order0000000002' }, payment_intent: {} }) }]
  const res = await call(completeRoute, req('GET', { query: { user: 'alice', session_id: 'cs_test_9' } }))
  assert.equal(res.body.delivery, 'https://drive.example/zine.pdf')
  assert.equal(res.body.kind, 'digital')
})

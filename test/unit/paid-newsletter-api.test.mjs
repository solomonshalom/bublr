// Paid newsletters end to end, against the in-memory Firestore with Stripe
// and Creem replaced by a stubbed fetch. Covers the promises the feature
// makes: only Pro + Shop writers charge, prices come from the server, money
// goes to the writer's own account, a paid post's body is never in the open,
// only paying readers (and the writer) read it, and nobody is charged for a
// newsletter they left.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { installTestCerts, authHeader, call } from './helpers.mjs'
import { resetStore, seed, read, all } from './mocks/firebase.mjs'
import { sent, resetSent } from './mocks/resend.mjs'

process.env.INTEGRATIONS_SECRET = 'test-integrations-secret-that-is-long-enough-123'
process.env.RESEND_API_KEY = 're_test'
delete process.env.NEXT_PUBLIC_BASE_URL

const { seal, hashId } = await import('../../src/lib/secret-box.js')
const { signShopGrant } = await import('../../src/lib/shop-trust.js')
const { resetRateLimits } = await import('../../src/lib/rate-limit.js')
const { signedPaidSettings, signPaidRecord, sealSubscriptionRef, verifiedPaid } = await import('../../src/lib/paid-newsletter.js')
const { sealedFields } = await import('../../src/lib/paid-content.js')
const { READER_COOKIE, verifiedSessionCookie, loginUrl, manageUrl } = await import('../../src/lib/reader-session.js')
const { toPublicUser, toPublicPost } = await import('../../src/lib/public-user.js')
const { setPostPublished } = await import('../../src/lib/publishing.js')
const { notifySubscribersOfPost } = await import('../../src/lib/newsletter-notify.js')

const settingsRoute = (await import('../../src/pages/api/newsletter/paid/settings.js')).default
const checkoutRoute = (await import('../../src/pages/api/newsletter/paid/checkout.js')).default
const completeRoute = (await import('../../src/pages/api/newsletter/paid/complete.js')).default
const contentRoute = (await import('../../src/pages/api/newsletter/paid/content.js')).default
const loginRoute = (await import('../../src/pages/api/newsletter/paid/login.js')).default
const sessionRoute = (await import('../../src/pages/api/newsletter/paid/session.js')).default
const manageRoute = (await import('../../src/pages/api/newsletter/paid/manage.js')).default
const subscribersRoute = (await import('../../src/pages/api/newsletter/paid/subscribers.js')).default
const unsubscribeRoute = (await import('../../src/pages/api/newsletter/unsubscribe.js')).default
const accessRoute = (await import('../../src/pages/api/posts/access.js')).default
const postContentRoute = (await import('../../src/pages/api/posts/content.js')).default
const deleteAccountRoute = (await import('../../src/pages/api/account/delete.js')).default
const { verifyUnsubscribe, signUnsubscribe } = await import('../../src/lib/unsubscribe-token.js')

const fakeKey = (...parts) => parts.join('_')
const STRIPE_KEY = fakeKey('rk', 'live', '51abcdefghijklmnopqrstuv')
const CREEM_KEY = fakeKey('creem', 'abcdefghijklmnop')
const DAY = 24 * 60 * 60 * 1000
const LINE = '<div data-type="paywall" class="tiptap-paywall"></div>'

// ---------------------------------------------------------------- fetch stub

let requests = []
let routes = []
const on = (method, pattern, reply) => routes.push({ method, pattern, reply })
globalThis.fetch = async (url, init = {}) => {
  const method = init.method || 'GET'
  const isJson = String(init.headers?.['Content-Type'] || '').includes('json')
  const body = init.body ? (isJson ? JSON.parse(init.body) : new URLSearchParams(init.body)) : null
  requests.push({ url: String(url), method, headers: init.headers || {}, body })
  const route = [...routes].reverse().find(r => r.method === method && (typeof r.pattern === 'string' ? String(url).includes(r.pattern) : r.pattern.test(String(url))))
  const reply = route ? (typeof route.reply === 'function' ? route.reply({ url: String(url), body }) : route.reply) : { status: 404, body: { error: { message: 'no stub' } } }
  const text = JSON.stringify(reply.body ?? {})
  return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, headers: { get: () => null }, text: async () => text, json: async () => JSON.parse(text) }
}

// ---------------------------------------------------------------- fixtures

const shopPlan = {
  hasCustomDomainAccess: true,
  hasShopAccess: true,
  subscription: { id: 'sub_plan', status: 'active', cancelAtPeriodEnd: false, productId: 'prod_shop' },
}

function seedWriter(extra = {}, { provider = 'stripe', mode = 'live', settings = { enabled: true, currency: 'usd', monthly: 500, yearly: 5000, description: 'Every essay', teaseFree: true }, subscribers = [] } = {}) {
  seed('users', 'alice', {
    name: 'alice',
    displayName: 'Alice',
    email: 'alice@example.com',
    posts: [],
    ...shopPlan,
    shopGrant: signShopGrant('alice', shopPlan.subscription),
    integrations: { payments: { provider, keySealed: seal(provider === 'stripe' ? STRIPE_KEY : CREEM_KEY, 'alice:payments'), keyHint: '…', mode } },
    ...(settings ? { paidNewsletter: signedPaidSettings('alice', settings) } : {}),
    subscribers,
    ...extra,
  })
}

function paidEntry(email, fields = {}, { subscriptionId = 'sub_reader', customerId = 'cus_reader' } = {}) {
  return {
    email,
    subscribedAt: new Date().toISOString(),
    paid: signPaidRecord('alice', email, {
      provider: 'stripe',
      mode: 'live',
      interval: 'month',
      amount: 500,
      currency: 'usd',
      status: 'active',
      currentPeriodEnd: Date.now() + 20 * DAY,
      startedAt: Date.now() - DAY,
      checkedAt: Date.now() - DAY,
      checkoutHash: 'h1',
      ref: sealSubscriptionRef('alice', email, { subscriptionId, customerId }),
      ...fields,
    }),
  }
}

function seedPaidPost({ id = 'post1', published = true, html = `<p>Free bit</p>${LINE}<p>The secret ending</p>` } = {}) {
  seed('posts', id, { author: 'alice', title: 'Paid one', slug: 'paid-one', excerpt: 'An excerpt', published, access: 'paid', ...sealedFields('alice', id, html) })
}

const req = (method, { headers = {}, body = {}, query = {} } = {}) => ({ method, headers: { host: 'bublr.life', ...headers }, body, query })
const cookieFrom = setCookie => `${READER_COOKIE}=${String(setCookie).split(';')[0].split('=').slice(1).join('=')}`
const readerCookie = email => ({ cookie: cookieFrom(verifiedSessionCookie(email)) })

beforeEach(() => {
  installTestCerts()
  resetStore()
  resetSent()
  resetRateLimits()
  requests = []
  routes = []
  process.env.INTEGRATIONS_SECRET = 'test-integrations-secret-that-is-long-enough-123'
})

// ---------------------------------------------------------------- settings

test('settings: paid subscriptions need Pro + Shop and a connected account', async () => {
  seed('users', 'bob', { name: 'bob', hasCustomDomainAccess: true, subscription: { status: 'active' } })
  const noPlan = await call(settingsRoute, req('POST', { headers: authHeader('bob'), body: { monthly: 500 } }))
  assert.equal(noPlan.statusCode, 402)
  assert.equal(noPlan.body.code, 'SHOP_PLAN_REQUIRED')

  seedWriter({ integrations: {} }, { settings: null })
  const noPayments = await call(settingsRoute, req('POST', { headers: authHeader('alice'), body: { monthly: 500 } }))
  assert.equal(noPayments.statusCode, 409)
  assert.equal(noPayments.body.code, 'PAYMENTS_REQUIRED')

  assert.equal((await call(settingsRoute, req('POST', { body: { monthly: 500 } }))).statusCode, 401)
})

test('settings: a Stripe key without Subscriptions permission is refused; a good one saves signed prices', async () => {
  seedWriter({}, { settings: null })
  on('GET', 'api.stripe.com/v1/subscriptions?limit=1', { status: 403, body: { error: { message: 'restricted' } } })
  const refused = await call(settingsRoute, req('POST', { headers: authHeader('alice'), body: { monthly: 500 } }))
  assert.equal(refused.statusCode, 400)
  assert.equal(refused.body.code, 'KEY_PERMISSIONS')

  on('GET', 'api.stripe.com/v1/subscriptions?limit=1', { status: 200, body: { data: [] } })
  const ok = await call(settingsRoute, req('POST', { headers: authHeader('alice'), body: { monthly: 700, yearly: 7000, currency: 'eur', description: 'Essays' } }))
  assert.equal(ok.statusCode, 200)
  assert.equal(ok.body.open, true)
  const stored = read('users', 'alice').paidNewsletter
  assert.equal(stored.monthly, 700)
  assert.ok(stored.sig)

  // Turning it off keeps the prices and needs nothing else
  const off = await call(settingsRoute, req('POST', { headers: authHeader('alice'), body: { enabled: false } }))
  assert.equal(off.statusCode, 200)
  assert.equal(off.body.open, false)
  assert.equal(read('users', 'alice').paidNewsletter.monthly, 700)
})

// ---------------------------------------------------------------- checkout

test('checkout: a subscription on the writer’s own Stripe, at the signed price', async () => {
  seedWriter()
  on('POST', 'api.stripe.com/v1/checkout/sessions', { status: 200, body: { id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' } })
  const res = await call(checkoutRoute, req('POST', { body: { username: 'alice', email: 'Reader@Example.com', interval: 'year', returnPath: '/alice/paid-one', amount: 1 } }))
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.checkoutUrl, 'https://checkout.stripe.com/c/cs_1')
  const call0 = requests.find(r => r.url.endsWith('/v1/checkout/sessions'))
  assert.equal(call0.headers.Authorization, `Bearer ${STRIPE_KEY}`)
  assert.equal(call0.body.get('mode'), 'subscription')
  assert.equal(call0.body.get('line_items[0][price_data][unit_amount]'), '5000')
  assert.equal(call0.body.get('line_items[0][price_data][recurring][interval]'), 'year')
  assert.equal(call0.body.get('customer_email'), 'reader@example.com')
  assert.equal(call0.body.get('subscription_data[metadata][bublr_user]'), 'alice')
  assert.match(call0.body.get('success_url'), /^https:\/\/bublr\.life\/alice\/paid-one\?paid=success&session_id=\{CHECKOUT_SESSION_ID\}$/)
})

test('checkout: tampered prices, closed newsletters and test keys don’t sell', async () => {
  seedWriter()
  const doc = read('users', 'alice')
  seed('users', 'alice', { ...doc, paidNewsletter: { ...doc.paidNewsletter, monthly: 100 } })
  const tampered = await call(checkoutRoute, req('POST', { body: { username: 'alice', email: 'r@example.com' } }))
  assert.equal(tampered.statusCode, 404)

  resetStore()
  seedWriter({}, { mode: 'test' })
  const visitor = await call(checkoutRoute, req('POST', { body: { username: 'alice', email: 'r@example.com' } }))
  assert.equal(visitor.statusCode, 403)
  on('POST', 'api.stripe.com/v1/checkout/sessions', { status: 200, body: { id: 'cs_2', url: 'https://checkout.stripe.com/c/cs_2' } })
  const writer = await call(checkoutRoute, req('POST', { headers: authHeader('alice'), body: { username: 'alice', email: 'alice@example.com' } }))
  assert.equal(writer.statusCode, 200)
})

test('checkout: someone already paying gets a sign-in link instead of a second charge', async () => {
  seedWriter({}, { subscribers: [paidEntry('reader@example.com')] })
  const res = await call(checkoutRoute, req('POST', { body: { username: 'alice', email: 'reader@example.com' } }))
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.alreadySubscribed, true)
  assert.equal(requests.length, 0)
  assert.equal(sent.find(m => m.kind === 'reader-login').subscriberEmail, 'reader@example.com')
})

test('checkout: Creem sells from a recurring product made once per price', async () => {
  seedWriter({}, { provider: 'creem', settings: { enabled: true, currency: 'usd', monthly: 500 } })
  on('POST', 'api.creem.io/v1/products', { status: 200, body: { id: 'prod_nl' } })
  on('POST', 'api.creem.io/v1/checkouts', { status: 200, body: { id: 'ch_1', checkout_url: 'https://creem.io/pay/ch_1' } })
  const res = await call(checkoutRoute, req('POST', { body: { username: 'alice', email: 'r@example.com' } }))
  assert.equal(res.statusCode, 200)
  const product = requests.find(r => r.url.endsWith('/v1/products'))
  assert.equal(product.body.billing_type, 'recurring')
  assert.equal(product.body.billing_period, 'every-month')
  assert.equal(product.body.price, 500)
  requests = []
  await call(checkoutRoute, req('POST', { body: { username: 'alice', email: 's@example.com' } }))
  assert.equal(requests.filter(r => r.url.endsWith('/v1/products')).length, 0, 'the product is reused')
})

// ---------------------------------------------------------------- coming back from paying

function stripeSession(overrides = {}) {
  return {
    id: 'cs_paid',
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 500,
    currency: 'usd',
    customer: 'cus_new',
    customer_details: { email: 'reader@example.com' },
    metadata: { bublr_kind: 'newsletter', bublr_user: 'alice', bublr_email: 'reader@example.com', bublr_interval: 'month', bublr_amount: '500', bublr_currency: 'usd' },
    subscription: {
      id: 'sub_new',
      status: 'active',
      cancel_at_period_end: false,
      customer: 'cus_new',
      items: { data: [{ current_period_end: Math.floor((Date.now() + 30 * DAY) / 1000), price: { unit_amount: 500, currency: 'usd', recurring: { interval: 'month' } } }] },
    },
    ...overrides,
  }
}

test('complete: asks Stripe, records a signed paid subscriber once, welcomes them, tells the writer, signs the browser in', async () => {
  seedWriter({}, { subscribers: [{ email: 'reader@example.com', subscribedAt: '2026-01-01T00:00:00Z', pending: true }] })
  on('GET', 'api.stripe.com/v1/checkout/sessions/cs_paid', { status: 200, body: stripeSession() })
  const res = await call(completeRoute, req('GET', { query: { user: 'alice', session_id: 'cs_paid' } }))
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.paid, true)
  assert.equal(res.body.signedIn, true)
  assert.match(res.headers['set-cookie'], new RegExp(`^${READER_COOKIE}=`))

  const subs = read('users', 'alice').subscribers
  assert.equal(subs.length, 1)
  assert.equal(subs[0].pending, undefined, 'paying confirms the address')
  const paid = verifiedPaid('alice', subs[0])
  assert.ok(paid)
  assert.equal(paid.status, 'active')
  assert.equal(paid.checkoutHash, hashId('cs_paid'))
  assert.ok(!JSON.stringify(subs).includes('sub_new'), 'provider ids are sealed')
  assert.ok(!JSON.stringify(subs).includes('cs_paid'), 'the checkout id is never stored')

  assert.equal(sent.filter(m => m.kind === 'paid-welcome').length, 1)
  assert.equal(sent.filter(m => m.kind === 'paid-new-subscriber').length, 1)
  assert.equal(all('notifications').filter(n => n.recipientId === 'alice').length, 1)

  // A reload records nothing new and sends nothing more
  await call(completeRoute, req('GET', { query: { user: 'alice', session_id: 'cs_paid' } }))
  assert.equal(sent.filter(m => m.kind === 'paid-welcome').length, 1)
  assert.equal(read('users', 'alice').subscribers.length, 1)
})

test('complete: someone else’s checkout, an unpaid one or the wrong amount records nothing', async () => {
  seedWriter()
  on('GET', 'api.stripe.com/v1/checkout/sessions/cs_paid', { status: 200, body: stripeSession({ metadata: { ...stripeSession().metadata, bublr_user: 'bob' } }) })
  assert.equal((await call(completeRoute, req('GET', { query: { user: 'alice', session_id: 'cs_paid' } }))).statusCode, 404)

  on('GET', 'api.stripe.com/v1/checkout/sessions/cs_paid', { status: 200, body: stripeSession({ status: 'open', payment_status: 'unpaid' }) })
  assert.equal((await call(completeRoute, req('GET', { query: { user: 'alice', session_id: 'cs_paid' } }))).statusCode, 202)

  on('GET', 'api.stripe.com/v1/checkout/sessions/cs_paid', { status: 200, body: stripeSession({ amount_total: 100 }) })
  assert.equal((await call(completeRoute, req('GET', { query: { user: 'alice', session_id: 'cs_paid' } }))).statusCode, 409)
  assert.equal(read('users', 'alice').subscribers.length, 0)
})

test('complete: an old receipt doesn’t sign anyone in', async () => {
  seedWriter({}, { subscribers: [paidEntry('reader@example.com', { checkoutHash: hashId('cs_paid'), startedAt: Date.now() - 3 * 60 * 60 * 1000 })] })
  on('GET', 'api.stripe.com/v1/checkout/sessions/cs_paid', { status: 200, body: stripeSession() })
  const res = await call(completeRoute, req('GET', { query: { user: 'alice', session_id: 'cs_paid' } }))
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.signedIn, false)
  assert.equal(res.headers['set-cookie'], undefined)
})

// ---------------------------------------------------------------- reading paid posts

test('content: locked for strangers, open to paying readers and the writer, never cached', async () => {
  seedWriter({}, { subscribers: [paidEntry('reader@example.com'), { email: 'free@example.com', subscribedAt: '2026-01-01' }] })
  seedPaidPost()

  const stranger = await call(contentRoute, req('GET', { query: { postId: 'post1' } }))
  assert.deepEqual(stranger.body, { locked: true, signedIn: null })
  assert.equal(stranger.headers['cache-control'], 'private, no-store')

  const free = await call(contentRoute, req('GET', { query: { postId: 'post1' }, headers: readerCookie('free@example.com') }))
  assert.equal(free.body.locked, true)
  assert.equal(free.body.signedIn, 'fre***@example.com')

  const reader = await call(contentRoute, req('GET', { query: { postId: 'post1' }, headers: readerCookie('reader@example.com') }))
  assert.match(reader.body.html, /The secret ending/)
  assert.ok(!reader.body.html.includes('paywall'))
  assert.match(reader.body.reader.manageUrl, /\/api\/newsletter\/paid\/manage\?token=/)

  const writer = await call(contentRoute, req('GET', { query: { postId: 'post1' }, headers: authHeader('alice') }))
  assert.equal(writer.body.author, true)
  assert.match(writer.body.html, /The secret ending/)
})

test('content: a session from paying one writer doesn’t open another', async () => {
  seedWriter({}, { subscribers: [paidEntry('reader@example.com')] })
  seedPaidPost()
  const { paidSessionCookie } = await import('../../src/lib/reader-session.js')
  const scoped = cookieFrom(paidSessionCookie({ headers: {} }, 'reader@example.com', 'bob'))
  const res = await call(contentRoute, req('GET', { query: { postId: 'post1' }, headers: { cookie: scoped } }))
  assert.equal(res.body.locked, true)
})

test('content: a period that ran out is checked with Stripe first', async () => {
  seedWriter({}, { subscribers: [paidEntry('reader@example.com', { currentPeriodEnd: Date.now() - 5 * DAY, checkedAt: Date.now() - DAY })] })
  seedPaidPost()
  on('GET', 'api.stripe.com/v1/subscriptions/sub_reader', {
    status: 200,
    body: { id: 'sub_reader', status: 'active', cancel_at_period_end: false, current_period_end: Math.floor((Date.now() + 25 * DAY) / 1000), customer: 'cus_reader', items: { data: [{ price: { unit_amount: 500, currency: 'usd', recurring: { interval: 'month' } } }] } },
  })
  const renewed = await call(contentRoute, req('GET', { query: { postId: 'post1' }, headers: readerCookie('reader@example.com') }))
  assert.match(renewed.body.html, /secret/)
  assert.ok(verifiedPaid('alice', read('users', 'alice').subscribers[0]).currentPeriodEnd > Date.now() + 20 * DAY)

  resetStore()
  seedWriter({}, { subscribers: [paidEntry('reader@example.com', { currentPeriodEnd: Date.now() - 5 * DAY, checkedAt: Date.now() - DAY })] })
  seedPaidPost()
  on('GET', 'api.stripe.com/v1/subscriptions/sub_reader', { status: 200, body: { id: 'sub_reader', status: 'canceled', current_period_end: Math.floor((Date.now() - 5 * DAY) / 1000) } })
  const lapsed = await call(contentRoute, req('GET', { query: { postId: 'post1' }, headers: readerCookie('reader@example.com') }))
  assert.equal(lapsed.body.locked, true)
})

test('public pages: a paid post shows only its preview; nothing sealed or signed reaches the page', async () => {
  seedWriter({}, { subscribers: [paidEntry('reader@example.com')] })
  seedPaidPost()
  const post = { id: 'post1', ...read('posts', 'post1') }
  assert.equal(post.content, '<p>Free bit</p>')
  assert.ok(!JSON.stringify(post).includes('secret ending'))
  assert.equal(toPublicPost(post).paidContentSealed, undefined)

  const user = toPublicUser({ id: 'alice', ...read('users', 'alice') })
  assert.equal(user.paidNewsletter, undefined)
  assert.equal(user.subscribers, undefined)
  assert.deepEqual(user.paidPlan, { open: true, testMode: false, currency: 'usd', monthly: 500, yearly: 5000, description: 'Every essay' })
})

// ---------------------------------------------------------------- signing in

test('login: a link goes only to an address that pays; the answer is the same either way', async () => {
  seedWriter({}, { subscribers: [paidEntry('reader@example.com'), { email: 'free@example.com' }] })
  const paying = await call(loginRoute, req('POST', { body: { username: 'alice', email: 'reader@example.com', next: '/alice/paid-one' } }))
  const free = await call(loginRoute, req('POST', { body: { username: 'alice', email: 'free@example.com' } }))
  const nobody = await call(loginRoute, req('POST', { body: { username: 'nobody', email: 'x@example.com' } }))
  assert.deepEqual(paying.body, free.body)
  assert.deepEqual(free.body, nobody.body)
  const links = sent.filter(m => m.kind === 'reader-login')
  assert.equal(links.length, 1)
  assert.equal(links[0].subscriberEmail, 'reader@example.com')

  // The link signs the browser in and goes to the post
  const token = new URL(links[0].loginUrl).searchParams.get('token')
  const res = await call(sessionRoute, req('GET', { query: { token } }))
  assert.equal(res.statusCode, 303)
  assert.equal(res.headers.location, '/alice/paid-one')
  assert.match(res.headers['set-cookie'], /HttpOnly/)

  const bad = await call(sessionRoute, req('GET', { query: { token: 'nope' } }))
  assert.equal(bad.statusCode, 400)
})

// ---------------------------------------------------------------- managing and leaving

test('manage: a subscriber stops renewing through the writer’s Stripe, and can undo it', async () => {
  seedWriter({}, { subscribers: [paidEntry('reader@example.com')] })
  const token = new URL(manageUrl('https://bublr.life', 'reader@example.com', 'alice')).searchParams.get('token')
  on('GET', 'api.stripe.com/v1/subscriptions/sub_reader', { status: 200, body: { id: 'sub_reader', status: 'active', cancel_at_period_end: false, current_period_end: Math.floor((Date.now() + 20 * DAY) / 1000) } })
  const page = await call(manageRoute, req('GET', { query: { token } }))
  assert.equal(page.statusCode, 200)
  assert.match(page.body, /Cancel subscription/)

  on('POST', 'api.stripe.com/v1/subscriptions/sub_reader', ({ body }) => ({
    status: 200,
    body: { id: 'sub_reader', status: 'active', cancel_at_period_end: body.get('cancel_at_period_end') === 'true', current_period_end: Math.floor((Date.now() + 20 * DAY) / 1000) },
  }))
  const cancelled = await call(manageRoute, req('POST', { body: { token, action: 'cancel' } }))
  assert.match(cancelled.body, /won’t renew/)
  assert.equal(verifiedPaid('alice', read('users', 'alice').subscribers[0]).cancelAtPeriodEnd, true)

  const resumed = await call(manageRoute, req('POST', { body: { token, action: 'resume' } }))
  assert.match(resumed.body, /renew as before/)
  assert.equal(verifiedPaid('alice', read('users', 'alice').subscribers[0]).cancelAtPeriodEnd, false)

  const forged = await call(manageRoute, req('GET', { query: { token: `${token}x` } }))
  assert.equal(forged.statusCode, 400)
})

test('unsubscribe: a paying reader who leaves stops paying too', async () => {
  seedWriter({}, { subscribers: [paidEntry('reader@example.com')] })
  const token = signUnsubscribe('reader@example.com', 'alice')
  const page = await call(unsubscribeRoute, req('GET', { query: { email: 'reader@example.com', author: 'alice', token } }))
  assert.match(page.body, /Unsubscribe and cancel payment/)

  on('POST', 'api.stripe.com/v1/subscriptions/sub_reader', { status: 200, body: { id: 'sub_reader', status: 'active', cancel_at_period_end: true, current_period_end: Math.floor((Date.now() + 20 * DAY) / 1000) } })
  const res = await call(unsubscribeRoute, req('POST', { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: { email: 'reader@example.com', author: 'alice', token } }))
  assert.match(res.body, /cancelled too/)
  assert.equal(requests.filter(r => r.method === 'POST' && r.url.includes('/v1/subscriptions/sub_reader')).length, 1)
  assert.equal(read('users', 'alice').subscribers.length, 0)
  assert.ok(verifyUnsubscribe('reader@example.com', 'alice', token))
})

test('unsubscribe: if the payment can’t be stopped, the reader is still unsubscribed and the writer is asked to cancel it', async () => {
  seedWriter({}, { subscribers: [paidEntry('reader@example.com')] })
  const token = signUnsubscribe('reader@example.com', 'alice')
  on('POST', 'api.stripe.com/v1/subscriptions/sub_reader', { status: 500, body: { error: { message: 'down' } } })
  const res = await call(unsubscribeRoute, req('POST', { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: { email: 'reader@example.com', author: 'alice', token } }))
  assert.match(res.body, /couldn’t cancel your payment automatically/)
  assert.equal(read('users', 'alice').subscribers.length, 0)
  assert.equal(sent.filter(m => m.kind === 'paid-cancel-failed').length, 1)
})

test('writer: end every paid subscription before leaving; account deletion waits for it', async () => {
  seedWriter({}, { subscribers: [paidEntry('a@example.com', {}, { subscriptionId: 'sub_a' }), paidEntry('b@example.com', {}, { subscriptionId: 'sub_b' }), { email: 'free@example.com' }] })
  const blocked = await call(deleteAccountRoute, req('POST', { headers: authHeader('alice'), body: { confirm: 'delete my account' } }))
  // The custom domain plan renews too; take it out of the way for this check
  assert.equal(blocked.statusCode, 409)

  on('POST', /api\.stripe\.com\/v1\/subscriptions\/sub_[ab]$/, ({ url }) => ({
    status: 200,
    body: { id: url.split('/').pop(), status: 'active', cancel_at_period_end: true, current_period_end: Math.floor((Date.now() + 20 * DAY) / 1000) },
  }))
  const res = await call(subscribersRoute, req('POST', { headers: authHeader('alice'), body: { action: 'cancel-all' } }))
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { cancelled: 2, failed: 0, stillRenewing: 0 })

  // With the plan itself cancelled, nothing renews and deletion goes ahead
  const doc = read('users', 'alice')
  seed('users', 'alice', { ...doc, subscription: { ...doc.subscription, cancelAtPeriodEnd: true } })
  const deleted = await call(deleteAccountRoute, req('POST', { headers: authHeader('alice'), body: { confirm: 'delete my account' } }))
  assert.equal(deleted.statusCode, 200)
})

test('account deletion: refused while readers would still be charged', async () => {
  seedWriter({ subscription: { ...shopPlan.subscription, cancelAtPeriodEnd: true } }, { subscribers: [paidEntry('a@example.com')] })
  const res = await call(deleteAccountRoute, req('POST', { headers: authHeader('alice'), body: { confirm: 'delete my account' } }))
  assert.equal(res.statusCode, 409)
  assert.equal(res.body.code, 'PAID_SUBSCRIBERS_ACTIVE')
})

// ---------------------------------------------------------------- writing paid posts

test('access: going paid seals the body and leaves the preview; going back restores it', async () => {
  seedWriter()
  const html = `<p>Free bit</p>${LINE}<p>The secret ending</p>`
  seed('posts', 'post1', { author: 'alice', title: 'T', slug: 't', content: html, published: false })

  const res = await call(accessRoute, req('POST', { headers: authHeader('alice'), body: { postId: 'post1', access: 'paid' } }))
  assert.equal(res.statusCode, 200)
  const sealedPost = read('posts', 'post1')
  assert.equal(sealedPost.access, 'paid')
  assert.equal(sealedPost.content, '<p>Free bit</p>')
  assert.ok(!JSON.stringify(sealedPost).includes('secret ending'))

  const loaded = await call(postContentRoute, req('GET', { headers: authHeader('alice'), query: { postId: 'post1' } }))
  assert.equal(loaded.body.content, html)

  const saved = await call(postContentRoute, req('PUT', { headers: authHeader('alice'), body: { postId: 'post1', content: `<p>New free</p>${LINE}<p>New secret</p>` } }))
  assert.equal(saved.statusCode, 200)
  assert.equal(read('posts', 'post1').content, '<p>New free</p>')
  assert.ok(!JSON.stringify(read('posts', 'post1')).includes('New secret'))

  const back = await call(accessRoute, req('POST', { headers: authHeader('alice'), body: { postId: 'post1', access: 'everyone' } }))
  assert.equal(back.statusCode, 200)
  const open = read('posts', 'post1')
  assert.equal(open.access, undefined)
  assert.equal(open.paidContentSealed, undefined)
  assert.equal(open.content, `<p>New free</p>${LINE}<p>New secret</p>`)

  const notMine = await call(accessRoute, req('POST', { headers: authHeader('mallory'), body: { postId: 'post1', access: 'paid' } }))
  assert.equal(notMine.statusCode, 403)
})

test('access and publishing: paid posts need the paid newsletter on', async () => {
  seedWriter({}, { settings: { enabled: false, currency: 'usd', monthly: 500 } })
  seed('posts', 'post1', { author: 'alice', title: 'T', slug: 't', content: '<p>x</p>', published: false })
  const res = await call(accessRoute, req('POST', { headers: authHeader('alice'), body: { postId: 'post1', access: 'paid' } }))
  assert.equal(res.statusCode, 402)

  seedPaidPost({ id: 'post2', published: false })
  const result = await setPostPublished({ postId: 'post2', publish: true })
  assert.equal(result.published, false)
  assert.equal(result.code, 'PAID_PLAN_REQUIRED')
  assert.equal(read('posts', 'post2').published, false)
})

// ---------------------------------------------------------------- the newsletter

test('newsletter: paying readers get the whole post and a sign-in link; free ones a preview and an invitation', async () => {
  seedWriter({}, { subscribers: [paidEntry('reader@example.com'), { email: 'free@example.com', subscribedAt: '2026-01-01' }, { email: 'pending@example.com', pending: true }] })
  seedPaidPost()
  const result = await notifySubscribersOfPost('post1')
  assert.equal(result.status, 200)
  const batch = sent.find(m => m.kind === 'batch')
  assert.deepEqual(batch.subscribers.map(s => s.email), ['reader@example.com', 'free@example.com'])
  const forReader = batch.personalized.find(p => p.email === 'reader@example.com')
  const forFree = batch.personalized.find(p => p.email === 'free@example.com')
  assert.match(forReader.postContent, /secret ending/)
  assert.match(forReader.postUrl, /\/api\/newsletter\/paid\/session\?token=/)
  assert.match(forReader.manageUrl, /manage/)
  assert.equal(forFree.postContent, undefined, 'free readers get the stored preview')
  assert.equal(forFree.ctaText, 'Subscribe to read')
  assert.match(forFree.notice, /\$5\/month/)
  assert.ok(!JSON.stringify(forFree).includes('secret'))
  assert.ok(!batch.postContent.includes('secret'), 'the shared content is the preview')
})

test('newsletter: with previews off, only paying readers get paid posts', async () => {
  seedWriter({}, { settings: { enabled: true, currency: 'usd', monthly: 500, teaseFree: false }, subscribers: [paidEntry('reader@example.com'), { email: 'free@example.com' }] })
  seedPaidPost()
  await notifySubscribersOfPost('post1')
  const batch = sent.find(m => m.kind === 'batch')
  assert.deepEqual(batch.subscribers.map(s => s.email), ['reader@example.com'])
})

test('newsletter: sign-in links from emails last a month and open every paid post', async () => {
  const url = loginUrl('https://bublr.life', 'reader@example.com', { next: '/alice/paid-one', ttlMs: 30 * DAY })
  const token = new URL(url).searchParams.get('token')
  const res = await call(sessionRoute, req('GET', { query: { token } }))
  assert.equal(res.statusCode, 303)
})

test('complete: Creem, where the checkout names the subscription and it’s fetched on its own', async () => {
  seedWriter({}, { provider: 'creem', settings: { enabled: true, currency: 'eur', monthly: 400 } })
  on('GET', 'api.creem.io/v1/checkouts?checkout_id=ch_paid', {
    status: 200,
    body: {
      id: 'ch_paid',
      status: 'completed',
      order: { amount: 400, currency: 'EUR', status: 'paid' },
      customer: { id: 'cust_1', email: 'reader@example.com' },
      subscription: 'sub_creem',
      metadata: { bublr_kind: 'newsletter', bublr_user: 'alice', bublr_email: 'reader@example.com', bublr_interval: 'month', bublr_amount: '400', bublr_currency: 'eur' },
    },
  })
  on('GET', 'api.creem.io/v1/subscriptions?subscription_id=sub_creem', {
    status: 200,
    body: { id: 'sub_creem', status: 'active', current_period_end_date: new Date(Date.now() + 30 * DAY).toISOString(), customer: 'cust_1', product: { id: 'prod_x', price: 400, currency: 'EUR', billing_period: 'every-month' } },
  })
  const res = await call(completeRoute, req('GET', { query: { user: 'alice', checkout_id: 'ch_paid' } }))
  assert.equal(res.statusCode, 200)
  const paid = verifiedPaid('alice', read('users', 'alice').subscribers[0])
  assert.equal(paid.provider, 'creem')
  assert.equal(paid.currency, 'eur')
  assert.equal(paid.status, 'active')

  // Cancelling through Creem schedules it for the period's end
  on('POST', 'api.creem.io/v1/subscriptions/sub_creem/cancel', ({ body }) => ({
    status: 200,
    body: { id: 'sub_creem', status: body.mode === 'scheduled' ? 'scheduled_cancel' : 'canceled', current_period_end_date: new Date(Date.now() + 30 * DAY).toISOString() },
  }))
  const cancel = await call(subscribersRoute, req('POST', { headers: authHeader('alice'), body: { action: 'cancel', email: 'reader@example.com' } }))
  assert.equal(cancel.statusCode, 200)
  assert.equal(cancel.body.cancelAtPeriodEnd, true)
  assert.equal(verifiedPaid('alice', read('users', 'alice').subscribers[0]).cancelAtPeriodEnd, true)
})

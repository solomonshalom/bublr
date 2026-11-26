// The pieces paid newsletters stand on: the paywall split and sealing of paid
// posts, signed settings and subscriber records, who gets access when, the
// reader's sign-in tokens, and rotating the server's secret without losing
// anything sealed.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

process.env.INTEGRATIONS_SECRET = 'test-integrations-secret-that-is-long-enough-123'

const paid = await import('../../src/lib/paid-content.js')
const nl = await import('../../src/lib/paid-newsletter.js')
const box = await import('../../src/lib/secret-box.js')
const rs = await import('../../src/lib/reader-session.js')

const DAY = 24 * 60 * 60 * 1000
const LINE = '<div data-type="paywall" class="tiptap-paywall"></div>'

beforeEach(() => {
  process.env.INTEGRATIONS_SECRET = 'test-integrations-secret-that-is-long-enough-123'
  delete process.env.INTEGRATIONS_SECRET_PREVIOUS
})

// ---------------------------------------------------------------- paid posts

test('paywall: the free preview is what comes before the first line; no line, no preview', () => {
  assert.equal(paid.freePreview(`<p>free</p>${LINE}<p>paid</p>`), '<p>free</p>')
  assert.equal(paid.freePreview(`<p>free</p><div class="x" data-type='paywall'></div><p>paid</p>`), '<p>free</p>')
  assert.equal(paid.freePreview('<p>all paid</p>'), '')
  assert.equal(paid.hasPaywallLine(`<p>a</p>${LINE}`), true)
  assert.equal(paid.hasPaywallLine('<p>a</p><div data-type="callout"></div>'), false)
  assert.equal(paid.removePaywallLine(`<p>a</p>${LINE}<p>b</p>`), '<p>a</p><p>b</p>')
})

test('paid posts: the body is sealed for that writer and post; content keeps only the preview', () => {
  const html = `<p>free</p>${LINE}<p>the secret part</p>`
  const fields = paid.sealedFields('alice', 'post1', html)
  assert.equal(fields.content, '<p>free</p>')
  assert.ok(!fields.paidContentSealed.includes('secret'))
  const post = { id: 'post1', author: 'alice', access: 'paid', ...fields }
  assert.equal(paid.fullContent(post), html)

  // Copied onto another post or claimed by another writer: it doesn't open
  assert.equal(paid.fullContent({ ...post, id: 'post2' }), null)
  assert.equal(paid.fullContent({ ...post, author: 'mallory' }), null)
  // Free posts are just their content; a "paid" flag without a sealed body too
  assert.equal(paid.fullContent({ id: 'p', author: 'a', content: '<p>x</p>' }), '<p>x</p>')
  assert.equal(paid.fullContent({ id: 'p', author: 'a', access: 'paid', content: '<p>x</p>' }), '<p>x</p>')
})

test('paid posts: refuse to save where the body would sit in the open', () => {
  delete process.env.INTEGRATIONS_SECRET
  assert.throws(() => paid.sealedFields('alice', 'post1', '<p>x</p>'), /INTEGRATIONS_SECRET/)
})

test('feeds: a paid post carries its preview and a note', () => {
  assert.equal(paid.feedContent({ content: '<p>x</p>' }), '<p>x</p>')
  const out = paid.feedContent({ content: '<p>x</p>', access: 'paid' })
  assert.match(out, /^<p>x<\/p>/)
  assert.match(out, /paid subscribers/)
})

// ---------------------------------------------------------------- settings

test('settings: prices are checked, and only what the server signed counts', () => {
  assert.throws(() => nl.normalizePaidSettings({ monthly: 50 }, { provider: 'stripe' }), /at least/)
  assert.throws(() => nl.normalizePaidSettings({ monthly: 500, currency: 'gbp' }, { provider: 'creem' }), /USD or EUR/)
  const settings = nl.normalizePaidSettings({ monthly: 500, yearly: '5000', currency: 'EUR', description: '  Every essay  ' }, { provider: 'creem' })
  assert.deepEqual(settings, { enabled: true, currency: 'eur', monthly: 500, yearly: 5000, description: 'Every essay', teaseFree: true })

  const stored = nl.signedPaidSettings('alice', settings)
  assert.equal(nl.trustedPaidSettings({ id: 'alice', paidNewsletter: stored }).monthly, 500)
  // Someone rewrites the price in the (world-writable) document
  assert.equal(nl.trustedPaidSettings({ id: 'alice', paidNewsletter: { ...stored, monthly: 100 } }), null)
  // Or copies a signed setting onto another writer
  assert.equal(nl.trustedPaidSettings({ id: 'bob', paidNewsletter: stored }), null)
})

// ---------------------------------------------------------------- subscriber records

function record(fields = {}) {
  return nl.signPaidRecord('alice', 'Reader@Example.com', {
    provider: 'stripe',
    mode: 'live',
    interval: 'month',
    amount: 500,
    currency: 'usd',
    status: 'active',
    currentPeriodEnd: Date.now() + 10 * DAY,
    startedAt: Date.now(),
    checkedAt: Date.now(),
    ...fields,
  })
}

test('records: signed for the writer and the address; any change breaks the signature', () => {
  const entry = { email: 'reader@example.com', paid: record() }
  assert.ok(nl.verifiedPaid('alice', entry))
  assert.equal(nl.verifiedPaid('bob', entry), null)
  assert.equal(nl.verifiedPaid('alice', { ...entry, email: 'other@example.com' }), null)
  assert.equal(nl.verifiedPaid('alice', { ...entry, paid: { ...entry.paid, currentPeriodEnd: Date.now() + 999 * DAY } }), null)
  assert.equal(nl.verifiedPaid('alice', { email: 'x@example.com', paid: { status: 'active', currentPeriodEnd: Date.now() + DAY } }), null)
})

test('access: active with a renewal grace, cancelled until the end, failed payments for a week, test cards only in test mode', () => {
  const now = Date.now()
  assert.equal(nl.paidAccess(record({ currentPeriodEnd: now + DAY }), { now }), true)
  assert.equal(nl.paidAccess(record({ currentPeriodEnd: now - DAY }), { now }), true, 'renewal still going through')
  assert.equal(nl.paidAccess(record({ currentPeriodEnd: now - 4 * DAY }), { now }), false)
  assert.equal(nl.paidAccess(record({ cancelAtPeriodEnd: true, currentPeriodEnd: now + DAY }), { now }), true)
  assert.equal(nl.paidAccess(record({ cancelAtPeriodEnd: true, currentPeriodEnd: now - 1000 }), { now }), false, 'no grace once cancelled')
  assert.equal(nl.paidAccess(record({ status: 'past_due', currentPeriodEnd: now - 5 * DAY }), { now }), true)
  assert.equal(nl.paidAccess(record({ status: 'past_due', currentPeriodEnd: now - 8 * DAY }), { now }), false)
  assert.equal(nl.paidAccess(record({ status: 'ended' }), { now }), false)
  assert.equal(nl.paidAccess(record({ status: 'unpaid' }), { now }), false)
  assert.equal(nl.paidAccess(record({ mode: 'test' }), { now, currentMode: 'live' }), false)
  assert.equal(nl.paidAccess(record({ mode: 'test' }), { now, currentMode: 'test' }), true)

  assert.equal(nl.paidState(record({ cancelAtPeriodEnd: true }), { now }), 'ending')
  assert.equal(nl.isRenewing(record(), { now }), true)
  assert.equal(nl.isRenewing(record({ cancelAtPeriodEnd: true }), { now }), false)
})

test('refresh: only once a period has run out, and not more than every few minutes', () => {
  const now = Date.now()
  assert.equal(nl.needsRefresh(record({ currentPeriodEnd: now + DAY }), { now }), false)
  assert.equal(nl.needsRefresh(record({ currentPeriodEnd: now - 1000, checkedAt: now - 60 * 60 * 1000 }), { now }), true)
  assert.equal(nl.needsRefresh(record({ currentPeriodEnd: now - 1000, checkedAt: now - 1000 }), { now }), false)
  assert.equal(nl.needsRefresh(record({ status: 'ended', currentPeriodEnd: now - 1000, checkedAt: 0 }), { now }), false)
})

test('records: the provider ids are sealed to the subscriber', () => {
  const ref = nl.sealSubscriptionRef('alice', 'reader@example.com', { subscriptionId: 'sub_123', customerId: 'cus_9' })
  assert.ok(!ref.includes('sub_123'))
  assert.deepEqual(nl.openSubscriptionRef('alice', 'READER@example.com', { ref }), { subscriptionId: 'sub_123', customerId: 'cus_9' })
  assert.equal(nl.openSubscriptionRef('alice', 'other@example.com', { ref }), null)
})

// ---------------------------------------------------------------- tokens and sessions

test('tokens: each purpose has its own key, and they expire', () => {
  const token = box.signToken('reader-login', { e: 'a@b.co' }, { ttlMs: 1000 })
  assert.equal(box.verifyToken('reader-login', token).e, 'a@b.co')
  assert.equal(box.verifyToken('paid-manage', token), null)
  assert.equal(box.verifyToken('reader-login', token, { now: Date.now() + 5000 }), null)
  assert.equal(box.verifyToken('reader-login', `${token}x`), null)
  const [body, mac] = token.split('.')
  const forged = Buffer.from(JSON.stringify({ e: 'evil@b.co', iat: Date.now() })).toString('base64url')
  assert.equal(box.verifyToken('reader-login', `${forged}.${mac}`), null)
  assert.ok(body)
})

test('reader sessions: an email link opens every writer; paying opens only that writer', () => {
  const cookieValue = header => header.split(';')[0].split('=').slice(1).join('=')
  const verified = rs.verifiedSessionCookie('Reader@Example.com')
  const session = rs.readerFromRequest({ headers: { cookie: `${rs.READER_COOKIE}=${cookieValue(verified)}` } })
  assert.deepEqual(session, { email: 'reader@example.com', verified: true, writers: [] })
  assert.equal(rs.sessionCovers(session, 'anyone'), true)

  const scoped = rs.paidSessionCookie({ headers: {} }, 'reader@example.com', 'alice')
  const scopedSession = rs.readerFromRequest({ headers: { cookie: `${rs.READER_COOKIE}=${cookieValue(scoped)}` } })
  assert.equal(rs.sessionCovers(scopedSession, 'alice'), true)
  assert.equal(rs.sessionCovers(scopedSession, 'bob'), false)
  assert.match(scoped, /HttpOnly; Secure; SameSite=Lax/)

  // A cookie forged in the browser doesn't count
  assert.equal(rs.readerFromRequest({ headers: { cookie: `${rs.READER_COOKIE}=abc.def` } }), null)
})

test('links: sign-in links only go to paths on this site', () => {
  assert.equal(rs.safeNext('/alice/post'), '/alice/post')
  assert.equal(rs.safeNext('//evil.example'), '/')
  assert.equal(rs.safeNext('https://evil.example'), '/')
  assert.equal(rs.safeNext('/\\evil.example'), '/')
  const url = rs.loginUrl('https://bublr.life', 'a@b.co', { next: '//evil.example' })
  const token = new URL(url).searchParams.get('token')
  assert.equal(rs.verifyLoginToken(token).next, '/')
  assert.equal(rs.maskEmail('reader@example.com'), 'rea***@example.com')
})

// ---------------------------------------------------------------- rotating the secret

test('secret rotation: what was sealed or signed with the previous secret still opens', () => {
  const sealed = box.seal('a paid post', 'alice:paid-post:p1')
  const sig = box.signValues('paid-newsletter', ['alice', 1])
  process.env.INTEGRATIONS_SECRET = 'a-brand-new-secret-that-is-also-long-enough-456'
  assert.equal(box.open(sealed, 'alice:paid-post:p1'), null)
  assert.equal(box.verifyValues('paid-newsletter', ['alice', 1], sig), false)
  process.env.INTEGRATIONS_SECRET_PREVIOUS = 'test-integrations-secret-that-is-long-enough-123'
  assert.equal(box.open(sealed, 'alice:paid-post:p1'), 'a paid post')
  assert.equal(box.verifyValues('paid-newsletter', ['alice', 1], sig), true)
  // New things use the new secret
  const fresh = box.seal('x', 'c')
  delete process.env.INTEGRATIONS_SECRET_PREVIOUS
  assert.equal(box.open(fresh, 'c'), 'x')
})

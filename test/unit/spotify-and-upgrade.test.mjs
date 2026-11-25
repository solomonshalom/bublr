// Adaptive music (each writer's own Spotify app) and adding the shop to an
// existing Pro subscription. Spotify and Creem are a stubbed fetch.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { installTestCerts, authHeader, call } from './helpers.mjs'
import { resetStore, seed, read } from './mocks/firebase.mjs'

process.env.INTEGRATIONS_SECRET = 'test-integrations-secret-that-is-long-enough-123'
process.env.CREEM_API_KEY = 'creem_live_key_for_tests'
process.env.CREEM_SHOP_PRODUCT_ID = 'prod_shop'
process.env.CREEM_CUSTOM_DOMAIN_PRODUCT_ID = 'prod_pro'
delete process.env.NEXT_PUBLIC_BASE_URL

const { seal, open, signState } = await import('../../src/lib/secret-box.js')
const { _resetSpotifyCaches } = await import('../../src/lib/spotify.js')
const { resetRateLimits } = await import('../../src/lib/rate-limit.js')
const connectRoute = (await import('../../src/pages/api/integrations/spotify/connect.js')).default
const callbackRoute = (await import('../../src/pages/api/integrations/spotify/callback.js')).default
const statusRoute = (await import('../../src/pages/api/integrations/spotify/status.js')).default
const nowPlayingRoute = (await import('../../src/pages/api/music/now-playing.js')).default
const upgradeRoute = (await import('../../src/pages/api/subscription/upgrade.js')).default

const CLIENT_ID = 'a'.repeat(32)
const CLIENT_SECRET = 'b'.repeat(32)

let requests = []
let replies = []
globalThis.fetch = async (url, init = {}) => {
  let body = null
  if (init.body) body = String(init.headers?.['Content-Type'] || '').includes('json') ? JSON.parse(init.body) : new URLSearchParams(init.body)
  requests.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body })
  const reply = replies.shift() || { status: 200, body: {} }
  const text = reply.body === null ? '' : JSON.stringify(reply.body)
  return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, text: async () => text, json: async () => JSON.parse(text) }
}

beforeEach(() => {
  installTestCerts()
  resetStore()
  resetRateLimits()
  _resetSpotifyCaches()
  requests = []
  replies = []
  seed('users', 'alice', { name: 'alice', displayName: 'Alice' })
})

const req = (method, extra = {}) => ({ method, headers: {}, body: {}, query: {}, ...extra })

test('spotify: connecting checks the app with Spotify, seals the secret and sends the writer to authorise', async () => {
  replies = [{ status: 200, body: { access_token: 'cc', expires_in: 3600 } }]
  const res = await call(connectRoute, req('POST', { headers: authHeader('alice'), body: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET } }))
  assert.equal(res.statusCode, 200)
  const url = new URL(res.body.authorizeUrl)
  assert.equal(url.origin + url.pathname, 'https://accounts.spotify.com/authorize')
  assert.equal(url.searchParams.get('client_id'), CLIENT_ID)
  assert.equal(url.searchParams.get('redirect_uri'), 'https://bublr.life/api/integrations/spotify/callback')
  assert.equal(url.searchParams.get('scope'), 'user-read-currently-playing user-read-recently-played')
  assert.ok(url.searchParams.get('state'))
  assert.equal(requests[0].body.get('grant_type'), 'client_credentials')
  assert.equal(requests[0].headers.Authorization, `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`)

  const stored = read('users', 'alice').integrations.spotify
  assert.equal(stored.status, 'pending')
  assert.ok(!JSON.stringify(stored).includes(CLIENT_SECRET))
  assert.equal(open(stored.secretSealed, 'alice:spotify-secret'), CLIENT_SECRET)

  const status = await call(statusRoute, req('GET', { headers: authHeader('alice') }))
  assert.equal(status.body.hasSecret, true)
  assert.ok(!JSON.stringify(status.body).includes('Sealed'))
})

test('spotify: wrong credentials are refused before anything is stored', async () => {
  replies = [{ status: 400, body: { error: 'invalid_client' } }]
  const res = await call(connectRoute, req('POST', { headers: authHeader('alice'), body: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET } }))
  assert.equal(res.statusCode, 400)
  assert.equal(read('users', 'alice').integrations, undefined)
  const badId = await call(connectRoute, req('POST', { headers: authHeader('alice'), body: { clientId: 'short', clientSecret: CLIENT_SECRET } }))
  assert.equal(badId.statusCode, 400)
  const anon = await call(connectRoute, req('POST', { body: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET } }))
  assert.equal(anon.statusCode, 401)
})

function seedPending() {
  seed('users', 'alice', {
    name: 'alice',
    music: { mode: 'spotify', tracks: [] },
    integrations: { spotify: { clientId: CLIENT_ID, secretSealed: seal(CLIENT_SECRET, 'alice:spotify-secret'), refreshSealed: null, status: 'pending' } },
  })
}

test('spotify: the callback trades the code with the writer’s own app and stores the refresh token sealed', async () => {
  seedPending()
  replies = [
    { status: 200, body: { access_token: 'at', refresh_token: 'rt_secret', expires_in: 3600 } },
    { status: 200, body: { display_name: 'Alice L' } },
  ]
  const res = await call(callbackRoute, req('GET', { query: { code: 'code123', state: signState({ uid: 'alice' }) } }))
  assert.equal(res.statusCode, 302)
  assert.equal(res.redirectedTo, '/dashboard/settings/music?spotify=connected')
  assert.equal(requests[0].body.get('grant_type'), 'authorization_code')
  assert.equal(requests[0].body.get('redirect_uri'), 'https://bublr.life/api/integrations/spotify/callback')
  const stored = read('users', 'alice').integrations.spotify
  assert.equal(stored.status, 'connected')
  assert.equal(stored.displayName, 'Alice L')
  assert.equal(open(stored.refreshSealed, 'alice:spotify-refresh'), 'rt_secret')
})

test('spotify: a forged or expired state is refused, and a denial is reported', async () => {
  seedPending()
  const forged = await call(callbackRoute, req('GET', { query: { code: 'c', state: 'eyJ1aWQiOiJhbGljZSJ9.forged' } }))
  assert.equal(forged.redirectedTo, '/dashboard/settings/music?spotify=error&reason=expired')
  const old = await call(callbackRoute, req('GET', { query: { code: 'c', state: signState({ uid: 'alice' }, { now: Date.now() - 60 * 60 * 1000 }) } }))
  assert.equal(old.redirectedTo, '/dashboard/settings/music?spotify=error&reason=expired')
  const denied = await call(callbackRoute, req('GET', { query: { error: 'access_denied', state: signState({ uid: 'alice' }) } }))
  assert.equal(denied.redirectedTo, '/dashboard/settings/music?spotify=error&reason=denied')
  assert.equal(requests.length, 0)
})

function seedConnected(extra = {}) {
  seed('users', 'alice', {
    name: 'alice',
    music: { mode: 'spotify', tracks: [] },
    integrations: {
      spotify: {
        clientId: CLIENT_ID,
        secretSealed: seal(CLIENT_SECRET, 'alice:spotify-secret'),
        refreshSealed: seal('rt_secret', 'alice:spotify-refresh'),
        status: 'connected',
      },
    },
    ...extra,
  })
}

const track = (id, name) => ({
  id,
  type: 'track',
  name,
  artists: [{ name: 'Kanye West' }],
  album: { name: 'The Life of Pablo', images: [{ url: 'https://i.scdn.co/big.jpg', width: 640 }, { url: 'https://i.scdn.co/mid.jpg', width: 300 }] },
  external_urls: { spotify: `https://open.spotify.com/track/${id}` },
  duration_ms: 200000,
})

test('now playing: shows the current song and recent ones, and nothing secret', async () => {
  seedConnected()
  replies = [
    { status: 200, body: { access_token: 'access_1', expires_in: 3600 } },
    { status: 200, body: { is_playing: true, progress_ms: 5000, currently_playing_type: 'track', item: track('t1', 'Saint Pablo') } },
    { status: 200, body: { items: [{ track: track('t2', 'Ultralight Beam'), played_at: '2026-11-25T10:00:00Z' }, { track: track('t2', 'Ultralight Beam'), played_at: '2026-11-25T09:00:00Z' }] } },
  ]
  const res = await call(nowPlayingRoute, req('GET', { query: { user: 'alice' } }))
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.connected, true)
  assert.equal(res.body.nowPlaying.title, 'Saint Pablo')
  assert.equal(res.body.nowPlaying.isPlaying, true)
  assert.equal(res.body.nowPlaying.image, 'https://i.scdn.co/mid.jpg')
  assert.equal(res.body.recent.length, 1, 'repeats are folded')
  const json = JSON.stringify(res.body)
  for (const secret of [CLIENT_SECRET, 'rt_secret', 'access_1']) assert.ok(!json.includes(secret))
  assert.equal(requests[0].body.get('grant_type'), 'refresh_token')

  // Cached: a second visitor within seconds doesn't hit Spotify again.
  const again = await call(nowPlayingRoute, req('GET', { query: { user: 'alice' } }))
  assert.equal(again.body.nowPlaying.title, 'Saint Pablo')
  assert.equal(requests.length, 3)
})

test('now playing: nothing playing (204) still shows recent songs', async () => {
  seedConnected()
  replies = [
    { status: 200, body: { access_token: 'access_1', expires_in: 3600 } },
    { status: 204, body: null },
    { status: 200, body: { items: [{ track: track('t2', 'Ultralight Beam'), played_at: '2026-11-25T10:00:00Z' }] } },
  ]
  const res = await call(nowPlayingRoute, req('GET', { query: { user: 'alice' } }))
  assert.equal(res.body.nowPlaying, null)
  assert.equal(res.body.recent[0].title, 'Ultralight Beam')
})

test('now playing: a revoked Spotify sign-in marks the connection expired and falls back', async () => {
  seedConnected()
  replies = [{ status: 400, body: { error: 'invalid_grant', error_description: 'Refresh token revoked' } }]
  const res = await call(nowPlayingRoute, req('GET', { query: { user: 'alice' } }))
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.connected, false)
  assert.equal(read('users', 'alice').integrations.spotify.status, 'expired')
})

test('now playing: writers in list mode, or not connected, are not looked up on Spotify', async () => {
  seedConnected({ music: { mode: 'list', tracks: [] } })
  const res = await call(nowPlayingRoute, req('GET', { query: { user: 'alice' } }))
  assert.equal(res.body.connected, false)
  assert.equal(requests.length, 0)
  const missing = await call(nowPlayingRoute, req('GET', { query: { user: 'nobody' } }))
  assert.equal(missing.statusCode, 404)
})

test('spotify: disconnecting removes the secret and the refresh token', async () => {
  seedConnected()
  const res = await call(statusRoute, req('DELETE', { headers: authHeader('alice') }))
  assert.equal(res.statusCode, 200)
  assert.equal(read('users', 'alice').integrations.spotify, undefined)
})

// ---------------------------------------------------------------- adding the shop to Pro

test('upgrade: a renewing monthly Pro subscription moves to Pro + Shop; the webhook opens the shop', async () => {
  seed('users', 'alice', {
    name: 'alice',
    hasCustomDomainAccess: true,
    subscription: { id: 'sub_9', status: 'active', cancelAtPeriodEnd: false, productId: 'prod_pro' },
  })
  replies = [{ status: 200, body: { id: 'sub_9', product: 'prod_shop' } }]
  const res = await call(upgradeRoute, req('POST', { headers: authHeader('alice') }))
  assert.equal(res.statusCode, 200)
  assert.equal(requests[0].url, 'https://api.creem.io/v1/subscriptions/sub_9/upgrade')
  assert.deepEqual(requests[0].body, { product_id: 'prod_shop', update_behavior: 'proration-charge-immediately' })
  const user = read('users', 'alice')
  assert.equal(user.hasShopAccess, undefined, 'nothing opens until Creem confirms the charge')
  assert.equal(user.subscription.productId, 'prod_pro')
})

test('upgrade: a yearly Pro plan is not swapped for the monthly shop plan', async () => {
  seed('users', 'alice', { name: 'alice', hasCustomDomainAccess: true, subscription: { id: 'sub_y', status: 'active', cancelAtPeriodEnd: false, productId: 'prod_pro_yearly' } })
  const res = await call(upgradeRoute, req('POST', { headers: authHeader('alice') }))
  assert.equal(res.statusCode, 409)
  assert.equal(res.body.code, 'NOT_MONTHLY_PRO')
  assert.equal(requests.length, 0)
})

test('upgrade: no renewing subscription, no upgrade; Creem refusing changes nothing', async () => {
  seed('users', 'alice', { name: 'alice', hasCustomDomainAccess: true, subscription: { id: 'sub_9', status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: Date.now() + 1e9 } })
  const ending = await call(upgradeRoute, req('POST', { headers: authHeader('alice') }))
  assert.equal(ending.statusCode, 409)

  seed('users', 'alice', { name: 'alice', hasCustomDomainAccess: true, subscription: { id: 'sub_9', status: 'active', cancelAtPeriodEnd: false, productId: 'prod_pro' } })
  replies = [{ status: 403, body: { message: 'insufficient permissions', trace_id: 't1' } }]
  const refused = await call(upgradeRoute, req('POST', { headers: authHeader('alice') }))
  assert.equal(refused.statusCode, 502)
  assert.equal(read('users', 'alice').hasShopAccess, undefined)
})

// Bublr on the fediverse (ActivityPub), end to end against the in-memory
// Firestore with remote servers replaced by a stubbed fetch. A "remote"
// Mastodon account with its own RSA key follows a writer; signatures are
// real both ways.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import { installTestCerts, authHeader, call, mockRes } from './helpers.mjs'
import { resetStore, seed, read, all } from './mocks/firebase.mjs'
import { resetSent } from './mocks/resend.mjs'

process.env.INTEGRATIONS_SECRET = 'test-integrations-secret-that-is-long-enough-123'
delete process.env.NEXT_PUBLIC_BASE_URL
delete process.env.FEDIVERSE_ORIGIN
delete process.env.FEDIVERSE_DOMAIN

const config = await import('../../src/lib/activitypub/config.js')
const sig = await import('../../src/lib/activitypub/signatures.js')
const remote = await import('../../src/lib/activitypub/remote.js')
const { newSealedKey, actorPublicKeyPem } = await import('../../src/lib/activitypub/actor-keys.js')
const { federatePost } = await import('../../src/lib/activitypub/federation.js')
const { _clearKeyCacheForTesting } = await import('../../src/lib/activitypub/inbox.js')
const { sealedFields } = await import('../../src/lib/paid-content.js')
const { toPublicUser } = await import('../../src/lib/public-user.js')
const { deleteAccountData } = await import('../../src/lib/delete-account.js')

const webfinger = (await import('../../src/pages/api/activitypub/webfinger.js')).default
const nodeinfo = (await import('../../src/pages/api/activitypub/nodeinfo.js')).default
const actorRoute = (await import('../../src/pages/api/activitypub/users/[uid]/index.js')).default
const inboxRoute = (await import('../../src/pages/api/activitypub/users/[uid]/inbox.js')).default
const sharedInbox = (await import('../../src/pages/api/activitypub/inbox.js')).default
const outboxRoute = (await import('../../src/pages/api/activitypub/users/[uid]/outbox.js')).default
const followersRoute = (await import('../../src/pages/api/activitypub/users/[uid]/followers.js')).default
const postRoute = (await import('../../src/pages/api/activitypub/posts/[...id].js')).default
const settingsRoute = (await import('../../src/pages/api/activitypub/settings.js')).default
const federateRoute = (await import('../../src/pages/api/posts/federate.js')).default
const deleteRoute = (await import('../../src/pages/api/posts/delete.js')).default

const BASE = 'https://www.bublr.life/api/activitypub'
const ALICE = `${BASE}/users/alice`

// ---------------------------------------------------------------- a remote server

const remoteKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const REMOTE_ACTOR = 'https://mastodon.example/users/bob'
const remoteActorDoc = {
  id: REMOTE_ACTOR,
  type: 'Person',
  preferredUsername: 'bob',
  inbox: 'https://mastodon.example/users/bob/inbox',
  endpoints: { sharedInbox: 'https://mastodon.example/inbox' },
  publicKey: { id: `${REMOTE_ACTOR}#main-key`, owner: REMOTE_ACTOR, publicKeyPem: remoteKeys.publicKey.export({ type: 'spki', format: 'pem' }) },
}

let requests = []
let routes = []
const on = (method, url, reply) => routes.push({ method, url, reply })
globalThis.fetch = async (url, init = {}) => {
  const method = init.method || 'GET'
  requests.push({ url: String(url), method, headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null, rawBody: init.body || null })
  const route = [...routes].reverse().find(r => r.method === method && r.url === String(url))
  const reply = route ? (typeof route.reply === 'function' ? route.reply() : route.reply) : { status: 404, body: {} }
  const text = JSON.stringify(reply.body ?? {})
  return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, headers: { get: () => null }, text: async () => text, json: async () => JSON.parse(text) }
}
remote._setLookupForTesting(async host => (host.endsWith('.example') ? ['93.184.216.34'] : host === 'rebind.example.net' ? ['10.0.0.5'] : ['93.184.216.34']))

// A delivery signed by the remote account, as Mastodon sends it
function signedDelivery(activity, { path = '/api/activitypub/users/alice/inbox', keys = remoteKeys, keyId = `${REMOTE_ACTOR}#main-key`, date = new Date().toUTCString(), tamper = null } = {}) {
  const body = JSON.stringify(activity)
  const digest = sig.digestHeader(body)
  const headers = { host: 'www.bublr.life', date, digest, 'content-type': 'application/activity+json' }
  const signingString = `(request-target): post ${path}\nhost: ${headers.host}\ndate: ${headers.date}\ndigest: ${headers.digest}\ncontent-type: ${headers['content-type']}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingString), keys.privateKey).toString('base64')
  headers.signature = `keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="${signature}"`
  return { method: 'POST', url: path, headers, rawBody: tamper ? tamper(body) : body, body: {}, query: {} }
}

function seedWriter(extra = {}) {
  seed('users', 'alice', {
    name: 'alice',
    displayName: 'Alice',
    about: 'Writes about tea.',
    photo: 'https://api.dicebear.com/7.x/notionists/svg?seed=alice',
    link: 'https://alice.example',
    posts: [],
    fediverse: { enabled: true, ...newSealedKey('alice') },
    ...extra,
  })
}

function seedFollower(uid = 'alice') {
  seed('fediverseFollowers', `f-${uid}`, { uid, actor: REMOTE_ACTOR, inbox: remoteActorDoc.inbox, sharedInbox: remoteActorDoc.endpoints.sharedInbox, followId: 'https://mastodon.example/follows/1' })
}

const req = (method, { headers = {}, body = {}, query = {} } = {}) => ({ method, headers: { host: 'www.bublr.life', ...headers }, body, query })

// Inbox deliveries keep their raw body and URL (the signature covers them)
async function deliver(handler, request) {
  const res = mockRes()
  await handler(request, res)
  return res
}

beforeEach(() => {
  installTestCerts()
  resetStore()
  resetSent()
  _clearKeyCacheForTesting()
  requests = []
  routes = [{ method: 'GET', url: REMOTE_ACTOR, reply: { status: 200, body: remoteActorDoc } }]
  process.env.INTEGRATIONS_SECRET = 'test-integrations-secret-that-is-long-enough-123'
})

// ---------------------------------------------------------------- addresses

test('addresses: handles are @name@bublr.life, ActivityPub lives on www (bublr.life redirects)', () => {
  assert.equal(config.apOrigin(), 'https://www.bublr.life')
  assert.equal(config.handleDomain(), 'bublr.life')
  assert.equal(config.actorUrl('alice'), ALICE)
  assert.equal(config.uidFromActorUrl(`${ALICE}#main-key`), 'alice')
  assert.equal(config.uidFromActorUrl('https://evil.example/api/activitypub/users/alice'), null)
  assert.equal(config.objectUrl('p1'), `${BASE}/posts/p1`)
  assert.equal(config.objectUrl('p1', 2), `${BASE}/posts/p1/2`)
})

// ---------------------------------------------------------------- signatures

test('signatures: what we sign verifies; a changed body, an old date or another key doesn’t', () => {
  const ours = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const body = JSON.stringify({ type: 'Follow' })
  const headers = sig.signRequest({ method: 'POST', url: 'https://mastodon.example/inbox', body, keyId: 'k', privateKeyPem: ours.privateKey, contentType: 'application/activity+json' })
  const all = { ...headers, host: 'mastodon.example' }
  const parsed = sig.parseSignatureHeader(headers.signature)
  const pem = ours.publicKey.export({ type: 'spki', format: 'pem' })
  assert.equal(sig.verifyRequestSignature({ method: 'POST', paths: ['/inbox'], headers: all, rawBody: body, parsed, publicKeyPem: pem }), true)
  assert.throws(() => sig.verifyRequestSignature({ method: 'POST', paths: ['/inbox'], headers: all, rawBody: body.replace('Follow', 'Undo'), parsed, publicKeyPem: pem }), /digest/)
  assert.throws(() => sig.verifyRequestSignature({ method: 'POST', paths: ['/inbox'], headers: all, rawBody: body, parsed, publicKeyPem: pem, now: Date.now() + 13 * 60 * 60 * 1000 }), /too old/)
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' })
  assert.throws(() => sig.verifyRequestSignature({ method: 'POST', paths: ['/inbox'], headers: all, rawBody: body, parsed, publicKeyPem: other }), /doesn’t match/)
})

test('remote fetches: https on the public internet only, after DNS too', async () => {
  for (const bad of ['http://mastodon.example/u', 'https://localhost/u', 'https://127.0.0.1/u', 'https://10.1.2.3/u', 'https://[::1]/u', 'https://169.254.169.254/latest', 'https://intranet/u', 'https://mastodon.example:8443/u', 'https://rebind.example.net/u']) {
    await assert.rejects(remote.assertPublicUrl(bad), remote.RemoteError, bad)
  }
  await remote.assertPublicUrl('https://mastodon.example/users/bob')
  assert.equal(remote.isPrivateAddress('::ffff:192.168.1.1'), true)
  assert.equal(remote.isPrivateAddress('93.184.216.34'), false)
})

// ---------------------------------------------------------------- discovery

test('webfinger: finds writers who turned the fediverse on, by handle on either host, by profile or actor URL', async () => {
  seedWriter()
  seed('users', 'carol', { name: 'carol' })
  const found = await call(webfinger, req('GET', { query: { resource: 'acct:alice@bublr.life' } }))
  assert.equal(found.statusCode, 200)
  const jrd = JSON.parse(found.body)
  assert.equal(jrd.subject, 'acct:alice@bublr.life')
  assert.deepEqual(jrd.links.find(l => l.rel === 'self'), { rel: 'self', type: 'application/activity+json', href: ALICE })
  assert.equal((await call(webfinger, req('GET', { query: { resource: 'acct:alice@www.bublr.life' } }))).statusCode, 200)
  assert.equal((await call(webfinger, req('GET', { query: { resource: 'https://bublr.life/alice' } }))).statusCode, 200)
  assert.equal((await call(webfinger, req('GET', { query: { resource: ALICE } }))).statusCode, 200)
  assert.equal((await call(webfinger, req('GET', { query: { resource: 'acct:carol@bublr.life' } }))).statusCode, 404, 'off by default')
  assert.equal((await call(webfinger, req('GET', { query: { resource: 'acct:alice@evil.example' } }))).statusCode, 404)
})

test('nodeinfo: says what Bublr is', async () => {
  const links = await call(nodeinfo, req('GET', { query: { discover: '1' } }))
  assert.equal(links.body.links[0].href, `${BASE}/nodeinfo`)
  const doc = JSON.parse((await call(nodeinfo, req('GET'))).body)
  assert.equal(doc.software.name, 'bublr')
  assert.deepEqual(doc.protocols, ['activitypub'])
})

test('actor: a Person with a key derived from the sealed one; gone when the fediverse is off', async () => {
  seedWriter()
  const res = await call(actorRoute, req('GET', { query: { uid: 'alice' }, headers: { accept: 'application/activity+json' } }))
  assert.equal(res.statusCode, 200)
  assert.match(res.headers['content-type'], /activity\+json/)
  const actor = JSON.parse(res.body)
  assert.equal(actor.type, 'Person')
  assert.equal(actor.preferredUsername, 'alice')
  assert.equal(actor.inbox, `${ALICE}/inbox`)
  assert.equal(actor.endpoints.sharedInbox, `${BASE}/inbox`)
  assert.equal(actor.url, 'https://bublr.life/alice')
  assert.equal(actor.icon.url, 'https://api.dicebear.com/7.x/notionists/png?seed=alice', 'no SVG avatars')
  assert.equal(actor.publicKey.publicKeyPem, actorPublicKeyPem({ id: 'alice', ...read('users', 'alice') }))
  assert.ok(!res.body.includes('PRIVATE KEY'))

  // Someone writes a public key of their own into the document: ignored
  seed('users', 'alice', { ...read('users', 'alice'), publicKeyPem: 'attacker key' })
  assert.ok(!(await call(actorRoute, req('GET', { query: { uid: 'alice' } }))).body.includes('attacker key'))

  const browser = await call(actorRoute, req('GET', { query: { uid: 'alice' }, headers: { accept: 'text/html' } }))
  assert.equal(browser.statusCode, 302)

  seed('users', 'alice', { ...read('users', 'alice'), fediverse: { enabled: false } })
  assert.equal((await call(actorRoute, req('GET', { query: { uid: 'alice' } }))).statusCode, 410)
})

test('public pages: the handle is shown, the key never is', () => {
  seedWriter()
  const user = toPublicUser({ id: 'alice', ...read('users', 'alice') })
  assert.equal(user.fediverseHandle, '@alice@bublr.life')
  assert.equal(user.fediverseActor, ALICE)
  assert.equal(user.fediverse, undefined)
})

// ---------------------------------------------------------------- following

test('follow: a signed Follow is accepted, the follower remembered, and an Accept sent signed by the writer', async () => {
  seedWriter()
  on('POST', remoteActorDoc.inbox, { status: 202, body: {} })
  const follow = { '@context': 'https://www.w3.org/ns/activitystreams', id: 'https://mastodon.example/follows/1', type: 'Follow', actor: REMOTE_ACTOR, object: ALICE }
  const res = await deliver(inboxRoute, { ...signedDelivery(follow), query: { uid: 'alice' } })
  assert.equal(res.statusCode, 202)

  const followers = all('fediverseFollowers')
  assert.equal(followers.length, 1)
  assert.equal(followers[0].actor, REMOTE_ACTOR)
  assert.equal(followers[0].sharedInbox, 'https://mastodon.example/inbox')

  const accept = requests.find(r => r.method === 'POST' && r.url === remoteActorDoc.inbox)
  assert.equal(accept.body.type, 'Accept')
  assert.equal(accept.body.object.id, follow.id)
  // Its signature checks out against the writer's published key
  const parsed = sig.parseSignatureHeader(accept.headers.signature)
  assert.equal(parsed.keyId, `${ALICE}#main-key`)
  const pem = actorPublicKeyPem({ id: 'alice', ...read('users', 'alice') })
  assert.equal(sig.verifyRequestSignature({ method: 'POST', paths: ['/users/bob/inbox'], headers: { ...accept.headers, host: 'mastodon.example' }, rawBody: accept.rawBody, parsed, publicKeyPem: pem }), true)

  // The follower count is public, the list isn't
  const count = JSON.parse((await call(followersRoute, req('GET', { query: { uid: 'alice' } }))).body)
  assert.equal(count.totalItems, 1)
  assert.equal(count.orderedItems, undefined)

  // Undo through the shared inbox
  const undo = { id: 'https://mastodon.example/undo/1', type: 'Undo', actor: REMOTE_ACTOR, object: follow }
  const undone = await deliver(sharedInbox, signedDelivery(undo, { path: '/api/activitypub/inbox' }))
  assert.equal(undone.statusCode, 202)
  assert.equal(all('fediverseFollowers').length, 0)
})

test('inbox: unsigned, tampered, wrongly signed or impersonating deliveries are refused', async () => {
  seedWriter()
  const follow = { id: 'https://mastodon.example/follows/2', type: 'Follow', actor: REMOTE_ACTOR, object: ALICE }

  const unsigned = signedDelivery(follow)
  delete unsigned.headers.signature
  assert.equal((await deliver(inboxRoute, { ...unsigned, query: { uid: 'alice' } })).statusCode, 401)

  const tampered = signedDelivery(follow, { tamper: body => body.replace('follows/2', 'follows/3') })
  assert.equal((await deliver(inboxRoute, { ...tampered, query: { uid: 'alice' } })).statusCode, 401)

  const otherKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  assert.equal((await deliver(inboxRoute, { ...signedDelivery(follow, { keys: otherKeys }), query: { uid: 'alice' } })).statusCode, 401)

  // Signed by bob, claiming to be carol
  const impersonating = { ...follow, actor: 'https://mastodon.example/users/carol' }
  assert.equal((await deliver(inboxRoute, { ...signedDelivery(impersonating), query: { uid: 'alice' } })).statusCode, 401)

  // A key on a private address is never fetched
  const internal = signedDelivery(follow, { keyId: 'https://10.0.0.1/key' })
  assert.equal((await deliver(inboxRoute, { ...internal, query: { uid: 'alice' } })).statusCode, 401)
  assert.ok(!requests.some(r => r.url.includes('10.0.0.1')))

  assert.equal(all('fediverseFollowers').length, 0)

  // A writer who isn't on the fediverse has no inbox
  seed('users', 'carol', { name: 'carol' })
  assert.equal((await deliver(inboxRoute, { ...signedDelivery({ ...follow, object: `${BASE}/users/carol` }), query: { uid: 'carol' } })).statusCode, 404)
})

test('inbox: a deleted account’s goodbye removes its follows even though its key is gone', async () => {
  seedWriter()
  seedFollower()
  on('GET', REMOTE_ACTOR, { status: 410, body: {} })
  const res = await deliver(sharedInbox, signedDelivery({ id: `${REMOTE_ACTOR}#delete`, type: 'Delete', actor: REMOTE_ACTOR, object: REMOTE_ACTOR }, { path: '/api/activitypub/inbox' }))
  assert.equal(res.statusCode, 202)
  assert.equal(all('fediverseFollowers').length, 0)
})

// ---------------------------------------------------------------- posts

test('posts: publishing sends a Create, an edit an Update, nothing when nothing changed, unpublishing a Delete', async () => {
  seedWriter()
  seedFollower()
  on('POST', 'https://mastodon.example/inbox', { status: 202, body: {} })
  seed('posts', 'p1', { author: 'alice', title: 'Tea', slug: 'tea', excerpt: 'On tea', content: '<p>Green tea.</p>', published: true, lastEdited: Date.now() })

  const deliveries = () => requests.filter(r => r.method === 'POST' && r.url === 'https://mastodon.example/inbox').map(r => r.body)

  assert.equal((await federatePost('p1')).sent, 'Create')
  const create = deliveries()[0]
  assert.equal(create.type, 'Create')
  assert.equal(create.object.type, 'Article')
  assert.equal(create.object.id, `${BASE}/posts/p1`)
  assert.equal(create.object.name, 'Tea')
  assert.equal(create.object.url, 'https://bublr.life/alice/tea')
  assert.match(create.object.content, /Green tea/)

  assert.equal((await federatePost('p1')).sent, null, 'nothing changed')

  seed('posts', 'p1', { ...read('posts', 'p1'), content: '<p>Green tea, steeped.</p>' })
  assert.equal((await federatePost('p1')).sent, 'Update')

  seed('posts', 'p1', { ...read('posts', 'p1'), published: false })
  assert.equal((await federatePost('p1')).sent, 'Delete')
  assert.equal(deliveries().at(-1).object.id, `${BASE}/posts/p1`)
  assert.equal(read('posts', 'p1').fediverse.gen, 1)

  // Published again: a new id (Mastodon won't take back a deleted one)
  seed('posts', 'p1', { ...read('posts', 'p1'), published: true })
  await federatePost('p1')
  assert.equal(deliveries().at(-1).object.id, `${BASE}/posts/p1/1`)
  assert.equal((await call(postRoute, req('GET', { query: { id: ['p1'] } }))).statusCode, 410, 'the old id is gone')
  assert.equal((await call(postRoute, req('GET', { query: { id: ['p1', '1'] } }))).statusCode, 200)
})

test('posts: a paid post goes out as its free preview and a link, never the sealed part', async () => {
  seedWriter()
  seedFollower()
  on('POST', 'https://mastodon.example/inbox', { status: 202, body: {} })
  const html = '<p>Free part.</p><div data-type="paywall"></div><p>Paid secret.</p>'
  seed('posts', 'p2', { author: 'alice', title: 'Paid', slug: 'paid', published: true, access: 'paid', ...sealedFields('alice', 'p2', html) })
  await federatePost('p2')
  const create = requests.find(r => r.method === 'POST').body
  assert.match(create.object.content, /Free part/)
  assert.match(create.object.content, /paid subscribers/)
  assert.ok(!JSON.stringify(create).includes('Paid secret'))

  const outbox = JSON.parse((await call(outboxRoute, req('GET', { query: { uid: 'alice', page: '1' } }))).body)
  assert.equal(outbox.orderedItems.length, 1)
  assert.ok(!JSON.stringify(outbox).includes('Paid secret'))
})

test('posts: writers who aren’t on the fediverse send nothing', async () => {
  seed('users', 'carol', { name: 'carol' })
  seed('posts', 'p3', { author: 'carol', title: 'x', slug: 'x', content: '<p>x</p>', published: true })
  assert.equal((await federatePost('p3')).sent, null)
  assert.equal(requests.length, 0)
})

test('posts: deleting one tells followers first; the editor’s edits go through the server', async () => {
  seedWriter({ posts: ['p4'] })
  seedFollower()
  on('POST', 'https://mastodon.example/inbox', { status: 202, body: {} })
  seed('posts', 'p4', { author: 'alice', title: 'Bye', slug: 'bye', content: '<p>x</p>', published: true })
  await federatePost('p4')

  seed('posts', 'p4', { ...read('posts', 'p4'), content: '<p>y</p>' })
  const edit = await call(federateRoute, req('POST', { headers: authHeader('alice'), body: { postId: 'p4' } }))
  assert.equal(edit.body.sent, 'Update')
  assert.equal((await call(federateRoute, req('POST', { headers: authHeader('mallory'), body: { postId: 'p4' } }))).statusCode, 403)

  const res = await call(deleteRoute, req('POST', { headers: authHeader('alice'), body: { postId: 'p4' } }))
  assert.equal(res.statusCode, 200)
  assert.equal(requests.filter(r => r.method === 'POST').at(-1).body.type, 'Delete')
  assert.equal(read('posts', 'p4'), undefined)
  assert.deepEqual(read('users', 'alice').posts, [])
})

test('delivery: a server that says 410 Gone loses its followers', async () => {
  seedWriter()
  seedFollower()
  on('POST', 'https://mastodon.example/inbox', { status: 410, body: {} })
  seed('posts', 'p5', { author: 'alice', title: 'x', slug: 'x', content: '<p>x</p>', published: true })
  await federatePost('p5')
  assert.equal(all('fediverseFollowers').length, 0)
})

// ---------------------------------------------------------------- the setting

test('settings: turning on makes a sealed key; turning off says goodbye to followers and forgets them', async () => {
  seed('users', 'alice', { name: 'alice', displayName: 'Alice' })
  const on1 = await call(settingsRoute, req('POST', { headers: authHeader('alice'), body: { enabled: true } }))
  assert.equal(on1.statusCode, 200)
  assert.equal(on1.body.handle, '@alice@bublr.life')
  const stored = read('users', 'alice').fediverse
  assert.equal(stored.enabled, true)
  assert.match(stored.keySealed, /^v1\./)
  assert.ok(!JSON.stringify(stored).includes('PRIVATE KEY'))

  seedFollower()
  on('POST', 'https://mastodon.example/inbox', { status: 202, body: {} })
  seed('posts', 'p6', { author: 'alice', title: 'x', slug: 'x', content: '<p>x</p>', published: true, fediverse: { gen: 0, live: true, hash: 'h' } })
  const off = await call(settingsRoute, req('POST', { headers: authHeader('alice'), body: { enabled: false } }))
  assert.equal(off.body.enabled, false)
  const goodbye = requests.find(r => r.method === 'POST' && r.url === 'https://mastodon.example/inbox').body
  assert.equal(goodbye.type, 'Delete')
  assert.equal(goodbye.object, ALICE)
  assert.equal(all('fediverseFollowers').length, 0)
  assert.equal(read('posts', 'p6').fediverse.live, false)
  assert.equal(read('users', 'alice').fediverse.keySealed, undefined)

  assert.equal((await call(settingsRoute, req('POST', { body: { enabled: true } }))).statusCode, 401)
})

test('account deletion: followers’ servers are told and the follower list goes', async () => {
  seedWriter()
  seedFollower()
  seed('fediverseFollowers', 'f-other', { uid: 'bob', actor: REMOTE_ACTOR, inbox: 'https://mastodon.example/users/bob/inbox' })
  on('POST', 'https://mastodon.example/inbox', { status: 202, body: {} })
  await deleteAccountData('alice')
  assert.equal(requests.find(r => r.method === 'POST').body.type, 'Delete')
  assert.deepEqual(all('fediverseFollowers').map(f => f.uid), ['bob'])
})

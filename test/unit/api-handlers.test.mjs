// Exercises the real API route handlers against an in-memory Firestore with
// signed test tokens: who can act as whom, and what each route writes.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { installTestCerts, authHeader, call } from './helpers.mjs'
import { resetStore, seed, read, all } from './mocks/firebase.mjs'
import { sent, resetSent } from './mocks/resend.mjs'
import { signUnsubscribe, unsubscribeUrl } from '../../src/lib/unsubscribe-token.js'

process.env.GROQ_API_KEY = 'test-groq-key' // lets modules build their client; no real calls are made
process.env.CLOUDINARY_CLOUD_NAME = 'demo'
process.env.CLOUDINARY_API_KEY = '123'
process.env.CLOUDINARY_API_SECRET = 'shh'
delete process.env.MODERATION_SECRET_KEY
process.env.UNSUBSCRIBE_SECRET = 'test-unsub-secret'
// Keep the publish route's fire-and-forget newsletter call off the network
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })

const api = async route => (await import(`../../src/pages/api/${route}.js`)).default
const keysCreate = await api('keys/create')
const keysList = await api('keys/list')
const keysRevoke = await api('keys/revoke')
const publish = await api('posts/publish')
const notify = await api('newsletter/notify')
const likes = await api('likes/[postId]')
const follow = await api('follow')
const notifications = await api('notifications/index')
const cloudinarySign = await api('cloudinary-sign')
const translate = await api('translate/index')
const moderate = await api('moderate/index')
const unsubscribe = await api('newsletter/unsubscribe')
const template = await api('newsletter/template')
const domainVerify = await api('domain/verify')
const transcribe = await api('transcribe')

beforeEach(() => {
  installTestCerts()
  resetStore()
  resetSent()
  seed('users', 'alice', { name: 'alice', displayName: 'Alice', photo: 'a.png', posts: ['post1'], subscribers: [{ email: 'r@example.com' }], followers: [] })
  seed('users', 'bob', { name: 'bob', displayName: 'Bob', photo: 'b.png', posts: [], followers: [], following: [] })
  seed('posts', 'post1', { author: 'alice', title: 'Hi', content: '<p>short</p>', slug: 'hi', published: false, lastEdited: new Date() })
})

const POST = (headers, body) => ({ method: 'POST', headers, body })

// ---- API keys ----

test('API keys: no sign-in is refused', async () => {
  const res = await call(keysCreate, POST({}, { userId: 'alice', name: 'k' }))
  assert.equal(res.statusCode, 401)
  assert.equal(read('users', 'alice').apiKeys, undefined)
})

test('API keys: cannot create a key for someone else', async () => {
  const res = await call(keysCreate, POST(authHeader('bob'), { userId: 'alice', name: 'k' }))
  assert.equal(res.statusCode, 403)
  assert.equal(read('users', 'alice').apiKeys, undefined)
})

test('API keys: create, list and revoke your own', async () => {
  const created = await call(keysCreate, POST(authHeader('alice'), { userId: 'alice', name: 'Freewrite' }))
  assert.equal(created.statusCode, 200)
  assert.match(created.body.key, /^bublr_sk_[a-f0-9]{64}$/)
  assert.equal(read('users', 'alice').apiKeys.length, 1)

  const listed = await call(keysList, { method: 'GET', headers: authHeader('alice'), query: { userId: 'alice' } })
  assert.equal(listed.statusCode, 200)
  assert.equal(listed.body.keys.length, 1)

  const sneaky = await call(keysList, { method: 'GET', headers: authHeader('bob'), query: { userId: 'alice' } })
  assert.equal(sneaky.statusCode, 403)

  const keyId = read('users', 'alice').apiKeys[0].id
  const revoked = await call(keysRevoke, POST(authHeader('alice'), { userId: 'alice', keyId }))
  assert.equal(revoked.statusCode, 200)
  assert.equal(read('users', 'alice').apiKeys.length, 0)
})

// ---- Publishing and newsletters ----

test('publish: only the author can publish', async () => {
  const anon = await call(publish, POST({}, { postId: 'post1', publish: true }))
  assert.equal(anon.statusCode, 401)
  const other = await call(publish, POST(authHeader('bob'), { postId: 'post1', publish: true }))
  assert.equal(other.statusCode, 403)
  assert.equal(read('posts', 'post1').published, false)
})

test('publish: first publish announces once, re-publishing does not', async () => {
  seed('users', 'bob', { name: 'bob', displayName: 'Bob', following: ['alice'] })
  seed('users', 'alice', { name: 'alice', displayName: 'Alice', posts: ['post1'], followers: ['bob'] })

  const first = await call(publish, POST(authHeader('alice'), { postId: 'post1', publish: true }))
  assert.equal(first.statusCode, 200)
  assert.equal(read('posts', 'post1').published, true)
  assert.ok(read('posts', 'post1').announcedAt)
  assert.equal(all('notifications').filter(n => n.type === 'new_post').length, 1)

  await call(publish, POST(authHeader('alice'), { postId: 'post1', publish: false }))
  assert.equal(read('posts', 'post1').published, false)
  await call(publish, POST(authHeader('alice'), { postId: 'post1', publish: true }))
  assert.equal(read('posts', 'post1').published, true)
  assert.equal(all('notifications').filter(n => n.type === 'new_post').length, 1, 'followers notified once')
})

test('newsletter notify: author only, and at most once per post', async () => {
  seed('posts', 'post1', { author: 'alice', title: 'Hi', content: '<p>x</p>', slug: 'hi', published: true })

  const other = await call(notify, POST(authHeader('bob'), { postId: 'post1', authorId: 'alice' }))
  assert.equal(other.statusCode, 403)
  assert.equal(sent.length, 0)

  const first = await call(notify, POST(authHeader('alice'), { postId: 'post1' }))
  assert.equal(first.statusCode, 200)
  assert.equal(first.body.sent, 1)
  assert.equal(sent.length, 1)
  assert.ok(read('posts', 'post1').newsletterSentAt)

  const again = await call(notify, POST(authHeader('alice'), { postId: 'post1' }))
  assert.equal(again.body.sent, 0)
  assert.equal(sent.length, 1, 'subscribers are not emailed twice')
})

test('newsletter template: cannot overwrite another writer’s template', async () => {
  seed('users', 'alice', { name: 'alice', hasCustomDomainAccess: true })
  const res = await call(template, POST(authHeader('bob'), { userId: 'alice', htmlTemplate: '<p>{{unsubscribeUrl}} spam</p>' }))
  assert.equal(res.statusCode, 403)
  assert.equal(read('users', 'alice').newsletterTemplate, undefined)
})

test('unsubscribe: page escapes the writer’s display name and only confirms on GET', async () => {
  seed('users', 'alice', { name: 'alice', displayName: '<img src=x onerror=alert(1)>', subscribers: [{ email: 'r@example.com' }] })
  const token = signUnsubscribe('r@example.com', 'alice')
  const res = await call(unsubscribe, { method: 'GET', query: { email: 'r@example.com', author: 'alice', token } })
  assert.equal(res.statusCode, 200)
  assert.doesNotMatch(res.body, /<img src=x/)
  assert.match(res.body, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.equal(read('users', 'alice').subscribers.length, 1) // a link scanner opening the link changes nothing
})

test('unsubscribe: links without a valid token do nothing', async () => {
  for (const token of [undefined, '', 'nope', signUnsubscribe('other@example.com', 'alice')]) {
    const get = await call(unsubscribe, { method: 'GET', query: { email: 'r@example.com', author: 'alice', token } })
    assert.equal(get.statusCode, 400)
    const post = await call(unsubscribe, { method: 'POST', headers: {}, body: { email: 'r@example.com', author: 'alice', token } })
    assert.equal(post.statusCode, 403)
  }
  assert.equal(read('users', 'alice').subscribers.length, 1)
})

test('unsubscribe: POST with the emailed token removes the subscriber', async () => {
  const token = signUnsubscribe('R@Example.com', 'alice')
  const res = await call(unsubscribe, { method: 'POST', headers: {}, body: { email: 'R@Example.com', author: 'alice', token } })
  assert.equal(res.statusCode, 200)
  assert.equal(read('users', 'alice').subscribers.length, 0)
  assert.match(unsubscribeUrl('r@example.com', 'alice'), /token=[0-9a-f]{32}$/)
})

// ---- Likes, follows, notifications ----

test('likes: the liker is the signed-in user, and the author is notified server-side', async () => {
  seed('posts', 'post1', { author: 'alice', title: 'Hi', slug: 'hi', published: true, likes: 0, likedBy: [] })

  const anon = await call(likes, { method: 'POST', query: { postId: 'post1' }, body: { userId: 'bob' } })
  assert.equal(anon.statusCode, 401)

  const spoof = await call(likes, { method: 'POST', headers: authHeader('bob'), query: { postId: 'post1' }, body: { userId: 'alice' } })
  assert.equal(spoof.statusCode, 403)

  const liked = await call(likes, { method: 'POST', headers: authHeader('bob'), query: { postId: 'post1' }, body: { userId: 'bob' } })
  assert.equal(liked.statusCode, 200)
  assert.equal(liked.body.liked, true)
  assert.deepEqual(read('posts', 'post1').likedBy, ['bob'])

  const [notification] = all('notifications')
  assert.equal(notification.type, 'like')
  assert.equal(notification.recipientId, 'alice')
  assert.equal(notification.actorId, 'bob')
  assert.equal(notification.actorName, 'Bob') // from Bob's profile, not the request
  assert.equal(notification.postAuthorName, 'alice')

  const unliked = await call(likes, { method: 'POST', headers: authHeader('bob'), query: { postId: 'post1' }, body: {} })
  assert.equal(unliked.body.liked, false)
  assert.equal(all('notifications').length, 1)
})

test('likes: liking your own post does not notify you', async () => {
  seed('posts', 'post1', { author: 'alice', title: 'Hi', slug: 'hi', published: true, likes: 0, likedBy: [] })
  await call(likes, { method: 'POST', headers: authHeader('alice'), query: { postId: 'post1' }, body: {} })
  assert.equal(all('notifications').length, 0)
})

test('follow: cannot make someone else follow a writer', async () => {
  const spoof = await call(follow, POST(authHeader('bob'), { targetUserId: 'alice', action: 'follow', currentUserId: 'carol' }))
  assert.equal(spoof.statusCode, 403)

  const ok = await call(follow, POST(authHeader('bob'), { targetUserId: 'alice', action: 'follow' }))
  assert.equal(ok.statusCode, 200)
  assert.deepEqual(read('users', 'alice').followers, ['bob'])
  assert.deepEqual(read('users', 'bob').following, ['alice'])
})

test('notifications: no public create, and you only see your own', async () => {
  const forged = await call(notifications, POST(authHeader('bob'), { recipientId: 'alice', type: 'follow', actorName: 'Admin' }))
  assert.equal(forged.statusCode, 405)
  assert.equal(all('notifications').length, 0)

  seed('notifications', 'n1', { recipientId: 'alice', type: 'like', read: false, createdAt: new Date() })
  seed('notifications', 'n2', { recipientId: 'bob', type: 'like', read: false, createdAt: new Date() })

  const other = await call(notifications, { method: 'GET', headers: authHeader('bob'), query: { userId: 'alice' } })
  assert.equal(other.statusCode, 403)

  const mine = await call(notifications, { method: 'GET', headers: authHeader('alice'), query: { userId: 'alice' } })
  assert.equal(mine.statusCode, 200)
  assert.deepEqual(mine.body.notifications.map(n => n.id), ['n1'])
  assert.equal(mine.body.unreadCount, 1)

  const markOther = await call(notifications, { method: 'PATCH', headers: authHeader('bob'), body: { userId: 'bob', notificationId: 'n1' } })
  assert.equal(markOther.statusCode, 403)
  assert.equal(read('notifications', 'n1').read, false)

  const markMine = await call(notifications, { method: 'PATCH', headers: authHeader('alice'), body: { userId: 'alice', notificationId: 'n1' } })
  assert.equal(markMine.statusCode, 200)
  assert.equal(read('notifications', 'n1').read, true)
})

// ---- Paid quotas and secrets ----

test('cloudinary-sign: signed-in writers only', async () => {
  const anon = await call(cloudinarySign, POST({}, {}))
  assert.equal(anon.statusCode, 401)
  const ok = await call(cloudinarySign, POST(authHeader('alice'), {}))
  assert.equal(ok.statusCode, 200)
  assert.match(ok.body.signature, /^[a-f0-9]{40}$/)
  assert.equal(ok.body.apiKey, '123')
})

test('transcribe: signed-in writers only', async () => {
  const res = await call(transcribe, POST({}, {}))
  assert.equal(res.statusCode, 401)
})

test('translate: only published posts, by id (no free-text proxy)', async () => {
  const freeText = await call(translate, POST({}, { title: 'x', content: 'translate my essay', targetLang: 'es' }))
  assert.equal(freeText.statusCode, 400)

  const draft = await call(translate, POST({}, { postId: 'post1', targetLang: 'es' }))
  assert.equal(draft.statusCode, 404)

  const missing = await call(translate, POST({}, { postId: 'nope', targetLang: 'es' }))
  assert.equal(missing.statusCode, 404)

  const badLang = await call(translate, POST({}, { postId: 'post1', targetLang: 'xx' }))
  assert.equal(badLang.statusCode, 400)
})

test('moderation endpoint refuses "Bearer undefined" when no secret is set', async () => {
  const res = await call(moderate, POST({ authorization: 'Bearer undefined' }, { postId: 'post1' }))
  assert.equal(res.statusCode, 401)
})

test('domain verify: cannot poke someone else’s domain', async () => {
  const res = await call(domainVerify, POST(authHeader('bob'), { userId: 'alice' }))
  assert.equal(res.statusCode, 403)
})

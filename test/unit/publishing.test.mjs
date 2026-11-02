// Publishing end to end through both doors: the dashboard route (Firebase
// sign-in) and the public API (bublr_sk_ keys). Both must run moderation,
// announce only once, and store real timestamps.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { installTestCerts, authHeader, call } from './helpers.mjs'
import { resetStore, seed, read, all, Timestamp } from './mocks/firebase.mjs'
import { sent, resetSent } from './mocks/resend.mjs'
import { calls as groqCalls, setModerationVerdict, resetGroq } from './mocks/groq.mjs'
import { toMillis } from '../../src/lib/timestamps.js'

process.env.GROQ_API_KEY = 'test-groq-key'

const api = async route => (await import(`../../src/pages/api/${route}.js`)).default
const publish = await api('posts/publish')
const keysCreate = await api('keys/create')
const v1Posts = await api('v1/posts/index')
const v1Post = await api('v1/posts/[slug]')

const LONG = '<p>' + 'A real essay about writing in public and why it matters to me. '.repeat(3) + '</p>'

let apiKey
beforeEach(async () => {
  installTestCerts()
  resetStore()
  resetSent()
  resetGroq()
  seed('users', 'alice', { name: 'alice', displayName: 'Alice', posts: [], followers: ['bob'], subscribers: [{ email: 'r@example.com' }] })
  seed('users', 'bob', { name: 'bob', displayName: 'Bob', following: ['alice'] })
  const created = await call(keysCreate, { method: 'POST', headers: authHeader('alice'), body: { name: 'Freewrite' } })
  apiKey = created.body.key
})

const v1 = (handler, { method = 'POST', body = {}, query = {} } = {}) =>
  call(handler, { method, headers: { authorization: `Bearer ${apiKey}` }, body, query })

test('API: a published post is moderated, announced once and has a real timestamp', async () => {
  const res = await v1(v1Posts, { body: { title: 'Writing in public', content: LONG, published: true } })
  assert.equal(res.statusCode, 201)
  assert.equal(res.body.post.published, true)
  assert.equal(groqCalls.length, 1, 'moderation ran')

  const post = all('posts')[0]
  assert.equal(post.published, true)
  assert.ok(post.lastEdited instanceof Timestamp, 'lastEdited is a Firestore Timestamp, not a { _seconds } map')
  assert.ok(post.announcedAt)
  assert.equal(all('notifications').filter(n => n.type === 'new_post').length, 1)
  assert.equal(sent.length, 1, 'newsletter went out')
  assert.deepEqual(read('users', 'alice').posts, [post.id])
})

test('API: spam caught by moderation stays a draft and is not announced', async () => {
  setModerationVerdict({ shouldUnpublish: true, reason: 'Gambling promotion', category: 'spam' })
  const res = await v1(v1Posts, { body: { title: 'Best online casino bonus', content: LONG, published: true } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.post.moderated, true)

  const post = all('posts')[0]
  assert.equal(post.published, false)
  assert.equal(post.moderationCategory, 'spam')
  assert.equal(all('notifications').length, 0)
  assert.equal(sent.length, 0)
})

test('API: publishing an existing draft moderates the updated content', async () => {
  const created = await v1(v1Posts, { body: { title: 'Draft', content: '<p>hi</p>', published: false } })
  assert.equal(created.body.post.published, false)
  assert.equal(groqCalls.length, 0)

  setModerationVerdict({ shouldUnpublish: true, reason: 'Spam', category: 'spam' })
  const res = await v1(v1Post, {
    method: 'PUT',
    query: { slug: created.body.post.slug },
    body: { content: LONG + '<p>buy now</p>', published: true },
  })
  assert.equal(res.body.moderated, true)
  assert.equal(groqCalls.length, 1)
  assert.match(groqCalls[0].messages[0].content, /buy now/, 'moderation saw the new content')
  assert.equal(all('posts')[0].published, false)
})

test('API: listing returns ISO dates for every timestamp shape', async () => {
  seed('posts', 'legacy', { author: 'alice', slug: 'legacy', title: 'Old', published: true, lastEdited: { _seconds: 1700000000, _nanoseconds: 0 } })
  seed('users', 'alice', { ...read('users', 'alice'), posts: ['legacy'] })
  const res = await v1(v1Posts, { method: 'GET' })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.posts[0].lastEdited, '2023-11-14T22:13:20.000Z')
})

test('dashboard: moderation verdict is returned and the post stays unpublished', async () => {
  seed('posts', 'p1', { author: 'alice', title: 'Casino', content: LONG, slug: 'casino', published: false })
  setModerationVerdict({ shouldUnpublish: true, reason: 'Gambling promotion', category: 'spam' })
  const res = await call(publish, { method: 'POST', headers: authHeader('alice'), body: { postId: 'p1', publish: true } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.moderated, true)
  assert.equal(read('posts', 'p1').published, false)
  assert.equal(sent.length, 0)
})

test('toMillis reads every stored timestamp shape', () => {
  const ms = Date.UTC(2026, 10, 2)
  assert.equal(toMillis(new Timestamp(ms)), ms)
  assert.equal(toMillis({ seconds: ms / 1000, nanoseconds: 5e6 }), ms + 5)
  assert.equal(toMillis({ _seconds: ms / 1000, _nanoseconds: 0 }), ms)
  assert.equal(toMillis(new Date(ms)), ms)
  assert.equal(toMillis(ms), ms)
  assert.equal(toMillis('2026-11-02T00:00:00.000Z'), ms)
  assert.equal(toMillis(null), null)
  assert.equal(toMillis('not a date'), null)
  assert.equal(toMillis({}), null)
})

// Deleting an account: who may do it, and that nothing of the writer is left
// behind while everyone else's data stays untouched.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { installTestCerts, authHeader, call } from './helpers.mjs'
import { resetStore, seed, read, all } from './mocks/firebase.mjs'
import { hashApiKey, authenticateApiKey } from '../../src/lib/api-auth.js'
import { hasRenewingSubscription, deleteAccountData } from '../../src/lib/delete-account.js'

const handler = (await import('../../src/pages/api/account/delete.js')).default

const KEY = `bublr_sk_${'a'.repeat(64)}`
const now = () => Math.floor(Date.now() / 1000)
const fresh = uid => authHeader(uid, { auth_time: now() - 30 })
const POST = (headers, body) => ({ method: 'POST', headers, body })
const CONFIRM = { confirm: 'delete my account' }

let fetchCalls

beforeEach(() => {
  installTestCerts()
  resetStore()
  fetchCalls = []
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url: String(url), options })
    return { ok: true, json: async () => ({}) }
  }
  delete process.env.VERCEL_TOKEN
  delete process.env.VERCEL_PROJECT_ID
  delete process.env.VERCEL_TEAM_ID

  seed('users', 'alice', {
    name: 'alice',
    displayName: 'Alice',
    email: 'alice@example.com',
    posts: ['a1', 'a2'],
    subscribers: [{ email: 'reader@example.com' }],
    followers: ['bob'],
    following: ['bob', 'ghost'],
    apiKeys: [{ id: 'k1', keyHash: hashApiKey(KEY) }],
    customDomain: { domain: 'alice.example.com', status: 'verified' },
  })
  seed('users', 'bob', { name: 'bob', displayName: 'Bob', posts: ['b1'], followers: ['alice', 'carol'], following: ['alice'] })
  seed('apiKeyLookup', hashApiKey(KEY), { userId: 'alice', keyId: 'k1' })
  seed('posts', 'a1', { author: 'alice', title: 'Published', slug: 'published', published: true, likes: 1, likedBy: ['bob'] })
  seed('posts', 'a2', { author: 'alice', title: 'Draft', slug: 'draft', published: false, shareToken: 'f'.repeat(48) })
  seed('posts', 'orphan', { author: 'alice', title: 'Not in her list', slug: 'orphan', published: true })
  seed('posts', 'b1', { author: 'bob', title: 'Bob writes', slug: 'bob-writes', published: true, likes: 2, likedBy: ['alice', 'carol'] })
  seed('users/alice/guestbook', 'g1', { name: 'Visitor', message: 'hi' })
  seed('users/bob/guestbook', 'g2', { name: 'Visitor', message: 'hi bob' })
  seed('notifications', 'n1', { recipientId: 'alice', actorId: 'bob', type: 'follow' })
  seed('notifications', 'n2', { recipientId: 'bob', actorId: 'alice', actorName: 'Alice', type: 'like' })
  seed('notifications', 'n3', { recipientId: 'bob', actorId: 'carol', type: 'like' })
})

test('delete account: needs a sign-in', async () => {
  const res = await call(handler, POST({}, CONFIRM))
  assert.equal(res.statusCode, 401)
  assert.ok(read('users', 'alice'))
  assert.equal(all('posts').length, 4)
})

test('delete account: only POST', async () => {
  const res = await call(handler, { method: 'GET', headers: fresh('alice'), body: CONFIRM })
  assert.equal(res.statusCode, 405)
  assert.ok(read('users', 'alice'))
})

test('delete account: a session that signed in long ago must sign in again', async () => {
  const res = await call(handler, POST(authHeader('alice', { auth_time: now() - 3600 }), CONFIRM))
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.code, 'RECENT_SIGN_IN_REQUIRED')
  assert.ok(read('users', 'alice'))
  assert.ok(read('posts', 'a1'))
})

test('delete account: a token with no sign-in time is not recent', async () => {
  const res = await call(handler, POST(authHeader('alice', { auth_time: undefined }), CONFIRM))
  assert.equal(res.statusCode, 401)
  assert.ok(read('users', 'alice'))
})

test('delete account: needs the confirmation phrase', async () => {
  for (const body of [{}, { confirm: true }, { confirm: 'yes' }, { confirm: 'delete' }, undefined]) {
    const res = await call(handler, POST(fresh('alice'), body))
    assert.equal(res.statusCode, 400)
    assert.equal(res.body.code, 'CONFIRMATION_REQUIRED')
  }
  assert.ok(read('users', 'alice'))
  assert.equal(all('posts').length, 4)
})

test('delete account: a userId in the body is ignored; you can only delete yourself', async () => {
  const res = await call(handler, POST(fresh('bob'), { ...CONFIRM, userId: 'alice', uid: 'alice' }))
  assert.equal(res.statusCode, 200)
  assert.ok(read('users', 'alice'))
  assert.ok(read('posts', 'a1'))
  assert.equal(read('users', 'bob'), undefined)
})

test('delete account: removes everything the writer made and nothing else', async () => {
  const res = await call(handler, POST(fresh('alice'), { confirm: '  Delete My Account ' }))
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { deleted: true, posts: 3 })

  // profile, subscribers, email: gone
  assert.equal(read('users', 'alice'), undefined)
  // posts, drafts (and their private link), and posts missing from her list
  assert.deepEqual(all('posts').map(p => p.id), ['b1'])
  // guest book
  assert.equal(all('users/alice/guestbook').length, 0)
  assert.equal(all('users/bob/guestbook').length, 1)
  // notifications to her and from her
  assert.deepEqual(all('notifications').map(n => n.id), ['n3'])
  // follows on both sides
  const bob = read('users', 'bob')
  assert.deepEqual(bob.followers, ['carol'])
  assert.deepEqual(bob.following, [])
  // her like on Bob's post
  const b1 = read('posts', 'b1')
  assert.deepEqual(b1.likedBy, ['carol'])
  assert.equal(b1.likes, 1)
  // API key
  assert.equal(read('apiKeyLookup', hashApiKey(KEY)), undefined)
  const auth = await authenticateApiKey(`Bearer ${KEY}`)
  assert.equal(auth.success, false)
})

test('delete account: an active subscription has to be cancelled first', async () => {
  seed('users', 'alice', { ...read('users', 'alice'), hasCustomDomainAccess: true, subscription: { id: 's1', status: 'active' } })
  const res = await call(handler, POST(fresh('alice'), CONFIRM))
  assert.equal(res.statusCode, 409)
  assert.equal(res.body.code, 'SUBSCRIPTION_ACTIVE')
  assert.ok(read('users', 'alice'))
  assert.equal(all('posts').length, 4)
})

test('delete account: a cancelled or ended subscription does not block', async () => {
  assert.equal(hasRenewingSubscription({ subscription: { status: 'active' } }), true)
  assert.equal(hasRenewingSubscription({ subscription: { status: 'trialing' } }), true)
  assert.equal(hasRenewingSubscription({ subscription: { status: 'active', cancelAtPeriodEnd: true } }), false)
  assert.equal(hasRenewingSubscription({ subscription: { status: 'canceled' } }), false)
  assert.equal(hasRenewingSubscription({ subscription: { status: 'revoked' } }), false)
  assert.equal(hasRenewingSubscription({}), false)
  assert.equal(hasRenewingSubscription(null), false)

  seed('users', 'alice', { ...read('users', 'alice'), subscription: { id: 's1', status: 'active', cancelAtPeriodEnd: true } })
  const res = await call(handler, POST(fresh('alice'), CONFIRM))
  assert.equal(res.statusCode, 200)
  assert.equal(read('users', 'alice'), undefined)
})

test('delete account: releases the custom domain at Vercel when configured', async () => {
  process.env.VERCEL_TOKEN = 'vt'
  process.env.VERCEL_PROJECT_ID = 'proj'
  const res = await call(handler, POST(fresh('alice'), CONFIRM))
  assert.equal(res.statusCode, 200)
  const vercel = fetchCalls.filter(c => c.url.includes('api.vercel.com'))
  assert.equal(vercel.length, 1)
  assert.equal(vercel[0].url, 'https://api.vercel.com/v9/projects/proj/domains/alice.example.com')
  assert.equal(vercel[0].options.method, 'DELETE')
})

test('delete account: a failing clean-up step does not keep the account alive', async () => {
  process.env.VERCEL_TOKEN = 'vt'
  process.env.VERCEL_PROJECT_ID = 'proj'
  globalThis.fetch = async () => {
    throw new Error('vercel is down')
  }
  const res = await call(handler, POST(fresh('alice'), CONFIRM))
  assert.equal(res.statusCode, 200)
  assert.equal(read('users', 'alice'), undefined)
  assert.deepEqual(all('posts').map(p => p.id), ['b1'])
})

test('delete account: running it twice is safe and finishes a half-done deletion', async () => {
  // As if an earlier attempt removed the profile but died before the posts
  resetStore()
  seed('posts', 'left', { author: 'alice', title: 'Left over', published: true })
  seed('posts', 'b1', { author: 'bob', title: 'Bob', published: true })

  const first = await call(handler, POST(fresh('alice'), CONFIRM))
  assert.equal(first.statusCode, 200)
  assert.deepEqual(all('posts').map(p => p.id), ['b1'])

  const second = await call(handler, POST(fresh('alice'), CONFIRM))
  assert.equal(second.statusCode, 200)
  assert.deepEqual(second.body, { deleted: true, posts: 0 })
})

test('delete account: odd profile data does not break it', async () => {
  seed('users', 'alice', { name: 'alice', following: 'nope', followers: [null, '', 'alice', 'missing-user'], apiKeys: [null, {}], posts: null })
  const result = await deleteAccountData('alice')
  assert.equal(result.hadProfile, true)
  assert.equal(read('users', 'alice'), undefined)
  await assert.rejects(() => deleteAccountData(''))
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { escapeHtml, safeJsonLd } from '../../src/lib/escape.js'
import { toPublicUser, toPublicPost, toPostAuthor } from '../../src/lib/public-user.js'
import { isReservedUsername, RESERVED_USERNAMES } from '../../src/lib/reserved-usernames.js'

test('safeJsonLd cannot close the surrounding <script> tag', () => {
  const data = { articleBody: 'Look: </script><script>alert(1)</script> & more', line: 'a\u2028b' }
  const out = safeJsonLd(data)
  assert.doesNotMatch(out, /<\/script/i)
  assert.doesNotMatch(out, /[<>&]/)
  assert.deepEqual(JSON.parse(out), data)
})

test('escapeHtml escapes markup and quotes', () => {
  assert.equal(escapeHtml(`<img src=x onerror="a">&'`), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;')
  assert.equal(escapeHtml(null), '')
})

const USER = {
  id: 'u1',
  name: 'ada',
  displayName: 'Ada',
  about: 'Writes things',
  photo: 'https://x/ada.png',
  email: 'ada@example.com',
  apiKeys: [{ id: 'k', keyHash: 'abc', keyPrefix: 'bublr_sk_123' }],
  newsletterTemplate: { html: '<p>secret template</p>' },
  readingList: ['p9'],
  subscription: { id: 'sub', customerId: 'cus_123', status: 'active' },
  subscribers: [{ email: 'reader@example.com', subscribedAt: '2026-01-01' }, 'old@example.com'],
  followers: ['u2', 'u3'],
  following: ['u4'],
  customDomain: { domain: 'ada.dev', status: 'verified', verification: [{ type: 'TXT', value: 'token' }] },
  socialLinks: { github: 'ada' },
  posts: [{ id: 'p1', title: 'Hello', likedBy: ['u2'], moderationReason: 'n/a', views: 3 }],
}

test('toPublicUser removes private data and keeps counts', () => {
  const pub = toPublicUser(USER)
  const json = JSON.stringify(pub)
  for (const secret of ['ada@example.com', 'reader@example.com', 'old@example.com', 'abc', 'cus_123', 'secret template', 'token', 'p9']) {
    assert.ok(!json.includes(secret), `leaked ${secret}`)
  }
  for (const field of ['email', 'apiKeys', 'newsletterTemplate', 'readingList', 'subscription', 'subscribers', 'followers', 'following']) {
    assert.equal(field in pub, false, `${field} should be removed`)
  }
  assert.equal(pub.followerCount, 2)
  assert.equal(pub.followingCount, 1)
  assert.equal(pub.subscriberCount, 2)
  assert.deepEqual(pub.customDomain, { domain: 'ada.dev', status: 'verified' })
  assert.equal(pub.posts[0].likedBy, undefined)
  assert.equal(pub.posts[0].views, 3)
  assert.equal(pub.socialLinks.github, 'ada')
  // The original object is untouched (server code may still need it)
  assert.equal(USER.subscribers.length, 2)
})

test('toPublicUser tolerates missing fields', () => {
  const pub = toPublicUser({ name: 'x' })
  assert.equal(pub.followerCount, 0)
  assert.equal(pub.subscriberCount, 0)
  assert.equal(toPublicUser(null), null)
})

test('toPostAuthor exposes only the byline', () => {
  assert.deepEqual(toPostAuthor(USER), { name: 'ada', displayName: 'Ada', photo: 'https://x/ada.png' })
  assert.deepEqual(Object.keys(toPostAuthor(undefined)), ['name', 'displayName', 'photo'])
})

test('toPublicPost drops liker ids and moderation bookkeeping', () => {
  const pub = toPublicPost({ id: 'p', likedBy: ['a'], newsletterSentAt: 'x', announcedAt: 'y', likes: 1 })
  assert.deepEqual(pub, { id: 'p', likes: 1 })
})

test('every top-level page name is a reserved username', () => {
  const pagesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/pages')
  const routes = fs
    .readdirSync(pagesDir)
    .filter(name => !name.startsWith('_') && !name.startsWith('['))
    .map(name => name.replace(/\.js$/, '').replace(/\.(xml|json)$/, ''))
    .filter(name => name !== 'index')
  for (const route of routes) {
    assert.ok(isReservedUsername(route), `"${route}" is a page, so it must be a reserved username`)
  }
})

test('reserved username check ignores case and whitespace', () => {
  assert.equal(isReservedUsername('Explore'), true)
  assert.equal(isReservedUsername(' about '), true)
  assert.equal(isReservedUsername('ada'), false)
  assert.ok(RESERVED_USERNAMES.has('dashboard'))
})

// Private draft links: who can turn them on, and what a link reveals.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { installTestCerts, authHeader, call } from './helpers.mjs'
import { resetStore, seed, read } from './mocks/firebase.mjs'
import { getSharedDraft, isShareToken, newShareToken } from '../../src/lib/draft-share.js'
import { toPublicPost } from '../../src/lib/public-user.js'

const share = (await import('../../src/pages/api/posts/share.js')).default
const POST = (headers, body) => ({ method: 'POST', headers, body })

beforeEach(() => {
  installTestCerts()
  resetStore()
  seed('users', 'alice', {
    name: 'alice',
    displayName: 'Alice',
    photo: 'a.png',
    email: 'alice@example.com',
    subscribers: [{ email: 'reader@example.com' }],
    posts: ['draft1'],
  })
  seed('users', 'bob', { name: 'bob', displayName: 'Bob', photo: 'b.png', posts: [] })
  seed('posts', 'draft1', {
    author: 'alice',
    title: 'Work in progress',
    content: '<p>Not ready yet</p>',
    slug: 'wip',
    published: false,
    lastEdited: new Date('2026-11-01T12:00:00Z'),
    likedBy: ['bob'],
  })
})

test('share tokens are long, random and well-formed', () => {
  const a = newShareToken()
  const b = newShareToken()
  assert.match(a, /^[a-f0-9]{48}$/)
  assert.notEqual(a, b)
  assert.ok(isShareToken(a))
  for (const bad of ['', 'abc', a.toUpperCase(), a + '0', a.slice(1), null, undefined, 42, { a }, [a]]) {
    assert.equal(isShareToken(bad), false)
  }
})

test('share: needs sign-in, the author, a real post and a clear on/off', async () => {
  assert.equal((await call(share, { method: 'GET' })).statusCode, 405)
  assert.equal((await call(share, POST({}, { postId: 'draft1', enabled: true }))).statusCode, 401)
  assert.equal((await call(share, POST(authHeader('bob'), { postId: 'draft1', enabled: true }))).statusCode, 403)
  assert.equal((await call(share, POST(authHeader('bob'), { postId: 'draft1', enabled: false }))).statusCode, 403)
  assert.equal((await call(share, POST(authHeader('alice'), { postId: 'nope', enabled: true }))).statusCode, 404)
  assert.equal((await call(share, POST(authHeader('alice'), { enabled: true }))).statusCode, 400)
  assert.equal((await call(share, POST(authHeader('alice'), { postId: 'draft1' }))).statusCode, 400)
  assert.equal((await call(share, POST(authHeader('alice'), { postId: 'draft1', enabled: 'yes' }))).statusCode, 400)
  assert.equal(read('posts', 'draft1').shareToken, undefined)
})

test('share: turning it on twice keeps the same link; off then on makes a new one', async () => {
  const first = await call(share, POST(authHeader('alice'), { postId: 'draft1', enabled: true }))
  assert.equal(first.statusCode, 200)
  assert.equal(first.body.shared, true)
  assert.ok(isShareToken(first.body.token))
  assert.equal(first.body.path, `/draft/${first.body.token}`)
  assert.equal(read('posts', 'draft1').shareToken, first.body.token)
  // Nothing else on the post changes
  assert.equal(read('posts', 'draft1').content, '<p>Not ready yet</p>')
  assert.equal(read('posts', 'draft1').published, false)

  const again = await call(share, POST(authHeader('alice'), { postId: 'draft1', enabled: true }))
  assert.equal(again.body.token, first.body.token)

  const off = await call(share, POST(authHeader('alice'), { postId: 'draft1', enabled: false }))
  assert.deepEqual(off.body, { shared: false })
  assert.equal('shareToken' in read('posts', 'draft1'), false)
  assert.equal(await getSharedDraft(first.body.token), null)

  // Turning it off when it is already off is fine
  assert.equal((await call(share, POST(authHeader('alice'), { postId: 'draft1', enabled: false }))).statusCode, 200)

  const fresh = await call(share, POST(authHeader('alice'), { postId: 'draft1', enabled: true }))
  assert.notEqual(fresh.body.token, first.body.token)
  assert.equal(await getSharedDraft(first.body.token), null)
  assert.ok(await getSharedDraft(fresh.body.token))
})

test('share: a malformed stored token is replaced, not handed out', async () => {
  seed('posts', 'draft1', { ...read('posts', 'draft1'), shareToken: 'guessable' })
  const res = await call(share, POST(authHeader('alice'), { postId: 'draft1', enabled: true }))
  assert.ok(isShareToken(res.body.token))
  assert.equal(await getSharedDraft('guessable'), null)
})

test('shared draft: the link shows the draft and nothing private', async () => {
  const { body } = await call(share, POST(authHeader('alice'), { postId: 'draft1', enabled: true }))
  const result = await getSharedDraft(body.token)

  assert.deepEqual(result.draft, {
    title: 'Work in progress',
    content: '<p>Not ready yet</p>',
    textDirection: 'auto',
    lastEdited: Date.parse('2026-11-01T12:00:00Z'),
    author: { name: 'alice', displayName: 'Alice', photo: 'a.png' },
  })
  assert.deepEqual(result.fontSettings, { headingFont: 'Inter', bodyFont: 'Inter', codeFont: 'JetBrains Mono' })
  assert.deepEqual(result.customFonts, [])

  const serialized = JSON.stringify(result)
  for (const secret of ['alice@example.com', 'reader@example.com', body.token, 'likedBy', 'subscribers']) {
    assert.equal(serialized.includes(secret), false, `${secret} must not reach the page`)
  }
  // Props must survive Next's JSON serialization (no undefined, no Timestamps)
  assert.deepEqual(JSON.parse(serialized), result)
})

test('shared draft: unknown, malformed and hostile tokens find nothing', async () => {
  await call(share, POST(authHeader('alice'), { postId: 'draft1', enabled: true }))
  for (const token of [newShareToken(), '', 'draft1', undefined, null, ['a'], { $ne: null }, '../dashboard']) {
    assert.equal(await getSharedDraft(token), null)
  }
})

test('shared draft: a draft that was never shared cannot be opened', async () => {
  // No shareToken field at all must not match an empty or missing token
  assert.equal(await getSharedDraft(undefined), null)
  assert.equal(await getSharedDraft('0'.repeat(48)), null)
})

test('shared draft: once published the link goes to the live post, and works again if unpublished', async () => {
  const { body } = await call(share, POST(authHeader('alice'), { postId: 'draft1', enabled: true }))
  seed('posts', 'draft1', { ...read('posts', 'draft1'), published: true })
  assert.deepEqual(await getSharedDraft(body.token), { redirect: '/alice/wip' })

  seed('posts', 'draft1', { ...read('posts', 'draft1'), published: false })
  assert.equal((await getSharedDraft(body.token)).draft.title, 'Work in progress')
})

test('shared draft: empty drafts, old date formats and a missing author are handled', async () => {
  const token = newShareToken()
  seed('posts', 'empty', { author: 'bob', published: false, shareToken: token, lastEdited: { _seconds: 1700000000 } })
  const result = await getSharedDraft(token)
  assert.equal(result.draft.title, '')
  assert.equal(result.draft.content, '')
  assert.equal(result.draft.lastEdited, 1700000000 * 1000)

  const orphan = newShareToken()
  seed('posts', 'orphan', { author: 'ghost', published: false, shareToken: orphan })
  assert.equal(await getSharedDraft(orphan), null)

  const undated = newShareToken()
  seed('posts', 'undated', { author: 'bob', published: false, shareToken: undated })
  assert.equal((await getSharedDraft(undated)).draft.lastEdited, null)
})

test('shared draft: custom fonts follow the writer and the post', async () => {
  const token = newShareToken()
  seed('users', 'bob', { ...read('users', 'bob'), fontSettings: { headingFont: 'Lora', bodyFont: 'Lora' } })
  seed('posts', 'styled', {
    author: 'bob',
    published: false,
    shareToken: token,
    fontOverrides: { bodyFont: 'Merriweather', codeFont: '"><script>alert(1)</script>' },
  })
  const result = await getSharedDraft(token)
  assert.equal(result.fontSettings.headingFont, 'Lora')
  assert.equal(result.fontSettings.bodyFont, 'Merriweather')
  assert.equal(result.fontSettings.codeFont, 'JetBrains Mono')
  assert.deepEqual(result.customFonts, ['Lora', 'Merriweather'])
})

test('the private link never rides along on a public post', () => {
  const pub = toPublicPost({ id: 'p', title: 'Live', shareToken: newShareToken() })
  assert.deepEqual(pub, { id: 'p', title: 'Live' })
})

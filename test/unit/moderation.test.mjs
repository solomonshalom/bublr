// Moderation takedowns and suspensions: the writer is emailed why, and a
// suspended account can't publish through either door.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { installTestCerts, authHeader, call } from './helpers.mjs'
import { resetStore, seed, read, all } from './mocks/firebase.mjs'
import { sent, resetSent } from './mocks/resend.mjs'
import { calls as groqCalls, setModerationVerdict, resetGroq } from './mocks/groq.mjs'
import { buildModerationEmail } from '../../src/lib/moderation-email.js'
import { toPublicUser } from '../../src/lib/public-user.js'

process.env.GROQ_API_KEY = 'test-groq-key'
process.env.MODERATION_SECRET_KEY = 'mod-secret'

const api = async route => (await import(`../../src/pages/api/${route}.js`)).default
const publish = await api('posts/publish')
const moderate = await api('moderate/index')
const moderateBatch = await api('moderate/batch')
const keysCreate = await api('keys/create')
const v1Posts = await api('v1/posts/index')

const LONG = '<p>' + 'Visit our casino for the best bonus codes and free spins today. '.repeat(3) + '</p>'
const SECRET = { authorization: 'Bearer mod-secret' }
const SUSPENSION = 'Promotional articles for one tour operator.'

beforeEach(() => {
  installTestCerts()
  resetStore()
  resetSent()
  resetGroq()
  seed('users', 'alice', { name: 'alice', displayName: 'Alice', email: 'alice@example.com', posts: ['live'], followers: [] })
  seed('users', 'spammer', { name: 'spammer', displayName: 'Spam Co', email: 'spam@example.com', posts: ['draft'], suspended: true, suspensionReason: SUSPENSION })
  seed('posts', 'live', { author: 'alice', title: '<b>Best casino</b> bonus', content: LONG, slug: 'casino', published: true })
  seed('posts', 'draft', { author: 'spammer', title: 'Nile cruise deals', content: LONG, slug: 'nile', published: false })
})

test('dashboard: a suspended writer cannot publish, and moderation is not even asked', async () => {
  const res = await call(publish, { method: 'POST', headers: authHeader('spammer'), body: { postId: 'draft', publish: true } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.published, false)
  assert.equal(res.body.moderated, true, 'the editor shows its moderation popup')
  assert.equal(res.body.suspended, true)
  assert.match(res.body.reason, /suspended/)
  assert.match(res.body.reason, /tour operator/)
  assert.equal(read('posts', 'draft').published, false)
  assert.equal(groqCalls.length, 0)
  assert.equal(all('notifications').length, 0)
})

test('API: a suspended writer’s new post stays a draft', async () => {
  const created = await call(keysCreate, { method: 'POST', headers: authHeader('spammer'), body: { name: 'bot' } })
  const res = await call(v1Posts, {
    method: 'POST',
    headers: { authorization: `Bearer ${created.body.key}` },
    body: { title: 'More cruise deals', content: LONG, published: true },
  })
  assert.equal(res.body.post.published, false)
  assert.equal(res.body.post.moderated, true)
  assert.ok(all('posts').filter(p => p.author === 'spammer').every(p => !p.published))
})

test('moderate: taking down a live post emails the writer why', async () => {
  setModerationVerdict({ shouldUnpublish: true, reason: 'Gambling promotion', category: 'spam' })
  const res = await call(moderate, { method: 'POST', headers: SECRET, body: { postId: 'live' } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.moderated, true)
  assert.equal(res.body.writerEmailed, true)
  assert.equal(read('posts', 'live').published, false)

  assert.equal(sent.length, 1)
  const [email] = sent
  assert.equal(email.kind, 'moderation')
  assert.equal(email.userEmail, 'alice@example.com')
  assert.equal(email.userName, 'Alice')
  assert.deepEqual(email.postTitles, ['<b>Best casino</b> bonus'])
  assert.equal(email.reason, 'Gambling promotion')
  assert.equal(email.unpublished, true)
  assert.ok(!email.suspended, 'automatic moderation never says the account is suspended')
})

test('moderate: a post that passes sends nothing', async () => {
  setModerationVerdict({ shouldUnpublish: false, reason: '', category: 'none' })
  const res = await call(moderate, { method: 'POST', headers: SECRET, body: { postId: 'live' } })
  assert.equal(res.body.moderated, false)
  assert.equal(read('posts', 'live').published, true)
  assert.equal(sent.length, 0)
})

test('moderate: a writer with no email on file still has the post taken down', async () => {
  seed('users', 'alice', { name: 'alice', displayName: 'Alice', posts: ['live'] })
  setModerationVerdict({ shouldUnpublish: true, reason: 'Spam', category: 'spam' })
  const res = await call(moderate, { method: 'POST', headers: SECRET, body: { postId: 'live' } })
  assert.equal(res.body.moderated, true)
  assert.equal(res.body.writerEmailed, false)
  assert.equal(read('posts', 'live').published, false)
  assert.equal(sent.length, 0)
})

test('moderate/batch: each takedown emails its writer', async () => {
  seed('posts', 'live2', { author: 'alice', title: 'Free spins', content: LONG, slug: 'spins', published: true })
  setModerationVerdict({ shouldUnpublish: true, reason: 'Gambling promotion', category: 'spam' })
  const res = await call(moderateBatch, { method: 'POST', headers: SECRET, body: { limit: 10 } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.results.unpublished, 2)
  assert.ok(res.body.results.details.every(d => d.writerEmailed === true))
  assert.equal(sent.filter(s => s.kind === 'moderation').length, 2)
})

test('moderation email: titles are plain text, names are escaped, long lists are cut short', () => {
  const titles = ['<b>Casino</b> &amp; bonus', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven']
  const email = buildModerationEmail({ userName: '<script>x</script>', postTitles: titles, reason: 'Ads & links' })
  assert.equal(email.subject, 'We removed 7 of your posts from Bublr')
  assert.ok(!email.html.includes('<script>x'), 'display name is escaped')
  assert.ok(email.html.includes('&lt;script&gt;x'))
  assert.ok(email.html.includes('Casino &amp; bonus'), 'title tags stripped, then escaped once')
  assert.ok(!email.html.includes('<b>Casino'))
  assert.ok(email.html.includes('and 2 more'))
  assert.ok(!email.html.includes('Six'))
  assert.ok(email.html.includes('Ads &amp; links'))
  assert.match(email.text, /Why: Ads & links/)
  assert.match(email.text, /\.\.\.and 2 more/)
  assert.match(email.text, /Your account is still active/)
})

test('moderation email: one post, suspension and draft wording', () => {
  const one = buildModerationEmail({ postTitles: ['Only'], reason: 'Spam' })
  assert.equal(one.subject, 'We removed your post from Bublr')
  assert.match(one.text, /^Your post was removed/)
  assert.match(one.text, /^Hi,$/m)

  const banned = buildModerationEmail({ userName: 'Spam Co', postTitles: ['A', 'B'], reason: 'Spam', suspended: true })
  assert.equal(banned.subject, 'Your Bublr account has been suspended')
  assert.match(banned.text, /can no longer publish/)
  assert.doesNotMatch(banned.text, /still active/)

  const draft = buildModerationEmail({ postTitles: ['Only'], reason: 'Spam', unpublished: true })
  assert.match(draft.text, /in your dashboard as a draft/)
  assert.doesNotMatch(one.text, /draft/)
})

test('suspension bookkeeping stays out of public profile props', () => {
  const pub = toPublicUser({ name: 'spammer', displayName: 'Spam Co', suspended: true, suspendedAt: 'now', suspensionReason: SUSPENSION, email: 'x@y.z' })
  for (const field of ['suspended', 'suspendedAt', 'suspensionReason', 'email']) assert.equal(pub[field], undefined, field)
  assert.equal(pub.name, 'spammer')
})

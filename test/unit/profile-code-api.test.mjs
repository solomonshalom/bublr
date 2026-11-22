// Profile HTML routes: the sandboxed frame, the preview shell, saving with
// history, the AI helper, account deletion and the security headers.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

import { installTestCerts, authHeader, call } from './helpers.mjs'
import { resetStore, seed, read, all, Timestamp } from './mocks/firebase.mjs'
import { calls as groqCalls, resetGroq, setModerationVerdict, queueCompletion } from './mocks/groq.mjs'
import { resetRateLimits } from '../../src/lib/rate-limit.js'
import { deleteAccountData } from '../../src/lib/delete-account.js'
import { FRAME_CSP, MAX_REVISIONS } from '../../src/lib/profile-code.js'
import { signProfileCode, hasValidSignature, trustedProfileCode, profileCodeHeaders } from '../../src/lib/profile-code-signature.js'
import { readFileSync } from 'node:fs'
import { parseAnswer, buildMessages, modelsToTry, _resetGroqClientForTesting } from '../../src/lib/profile-code-ai.js'

const frame = (await import('../../src/pages/api/profile-frame/[username].js')).default
const preview = (await import('../../src/pages/api/profile-preview.js')).default
const code = (await import('../../src/pages/api/profile/code.js')).default
const ai = (await import('../../src/pages/api/profile/code-ai.js')).default

const GET = (query = {}, headers = {}) => ({ method: 'GET', query, headers })
const POST = (headers, body) => ({ method: 'POST', headers, body })
const signed = (uid, code) => ({ ...code, sig: signProfileCode(uid, code) })
const IFRAME = { 'sec-fetch-dest': 'iframe' }
const PAGE = { html: '<h1>{{displayName}}</h1><bublr-posts></bublr-posts><bublr-guestbook></bublr-guestbook><bublr-friends users="bob">', css: 'h1{color:hotpink}', js: 'console.log(window.bublr.name)' }

beforeEach(() => {
  installTestCerts()
  resetStore()
  resetGroq()
  resetRateLimits()
  _resetGroqClientForTesting()
  process.env.GROQ_API_KEY = 'test-key'
  process.env.PROFILE_CODE_SECRET = 'test-profile-code-secret'
  delete process.env.GROQ_CODE_MODEL

  seed('users', 'alice', {
    name: 'alice',
    displayName: 'Alice',
    email: 'alice@example.com',
    photo: 'https://img.example/a.png',
    subscribers: [{ email: 'reader@example.com' }],
    posts: ['a1', 'a2'],
    profileCode: signed('alice', { ...PAGE, mode: 'page', placement: 'bottom', version: 3, updatedAt: Timestamp.now() }),
  })
  seed('users', 'bob', { name: 'bob', displayName: 'Bob B', photo: 'https://img.example/b.png', email: 'bob@example.com', posts: [] })
  seed('users', 'carol', { name: 'carol', displayName: 'Carol', posts: [], profileCode: signed('carol', { html: '<p>hidden</p>', css: '', js: '', mode: 'off', placement: 'bottom', version: 1 }) })
  seed('posts', 'a1', { author: 'alice', title: 'Published one', slug: 'one', published: true, lastEdited: new Date('2026-11-01'), views: 5 })
  seed('posts', 'a2', { author: 'alice', title: 'Private draft', slug: 'draft', published: false, lastEdited: new Date('2026-11-02') })
  seed('users/alice/guestbook', 'g1', { name: 'Visitor', message: 'Lovely page', moderationStatus: 'approved', createdAt: new Date('2026-11-03') })
  seed('users/alice/guestbook', 'g2', { name: 'Spammer', message: 'buy now', moderationStatus: 'rejected', createdAt: new Date('2026-11-04') })
})

// ---------------------------------------------------------------------------
// The frame

test('frame: serves the page inside a sandbox, with live data', async () => {
  const res = await call(frame, GET({ username: 'alice', embed: 'page', v: '3' }, IFRAME))
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['content-security-policy'], FRAME_CSP)
  assert.match(res.headers['content-security-policy'], /^sandbox allow-scripts /)
  assert.doesNotMatch(res.headers['content-security-policy'], /allow-same-origin/)
  assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN')
  assert.equal(res.headers['content-type'], 'text/html; charset=utf-8')
  assert.match(res.headers['cache-control'], /s-maxage=60/)
  const body = res.body
  assert.match(body, /<h1>Alice<\/h1>/)
  assert.match(body, /Published one/)
  assert.doesNotMatch(body, /Private draft/)
  assert.match(body, /Lovely page/)
  assert.doesNotMatch(body, /Spammer|buy now/)
  assert.match(body, /href="\/bob"/)
  assert.match(body, /Bob B/)
  assert.match(body, /h1\{color:hotpink\}/)
  assert.match(body, /console\.log\(window\.bublr\.name\)/)
  assert.match(body, /class="bublr-page"/)
  // nothing private reaches the page or its scripts
  for (const secret of ['alice@example.com', 'reader@example.com', 'bob@example.com']) assert.equal(body.includes(secret), false, secret)
})

test('frame: block embed, HEAD, and no request headers at all', async () => {
  const block = await call(frame, GET({ username: 'alice', embed: 'block', v: '3' }))
  assert.equal(block.statusCode, 200)
  assert.match(block.body, /class="bublr-block"/)
  const head = await call(frame, { method: 'HEAD', query: { username: 'alice', embed: 'page', v: '3' }, headers: {} })
  assert.equal(head.statusCode, 200)
  assert.equal(head.body, undefined)
})

test('frame: any other URL redirects to the one canonical, cacheable URL', async () => {
  for (const query of [{}, { v: '2', embed: 'page' }, { embed: 'page', v: '3', bust: 'x1' }, { embed: 'sideways', v: '3' }, { v: '3' }]) {
    const res = await call(frame, GET({ username: 'alice', ...query }, IFRAME))
    assert.equal(res.statusCode, 302, JSON.stringify(query))
    assert.match(res.headers.location, /^\/api\/profile-frame\/alice\?embed=(page|block)&v=3$/)
    assert.match(res.headers['content-security-policy'], /^sandbox /)
  }
})

test('frame: code that wasn’t saved through Bublr is never shown', async () => {
  // e.g. written straight into Firestore: unsigned, forged, or edited after signing
  const forged = { ...PAGE, html: '<h1>Fake sign-in</h1>', mode: 'page', placement: 'bottom', version: 9 }
  for (const profileCode of [forged, { ...forged, sig: 'f'.repeat(64) }, { ...signed('alice', forged), html: '<h1>changed</h1>' }, signed('bob', forged)]) {
    seed('users', 'alice', { ...read('users', 'alice'), profileCode })
    const res = await call(frame, GET({ username: 'alice', embed: 'page', v: '9' }, IFRAME))
    assert.equal(res.statusCode, 404)
    assert.equal(String(res.body).includes('Fake sign-in'), false)
  }
})

test('signatures cover every field that changes what visitors see', () => {
  const base = { html: '<p>a</p>', css: 'p{}', js: 'x()', mode: 'page', placement: 'top', version: 2 }
  const good = signed('alice', base)
  assert.equal(hasValidSignature('alice', good), true)
  assert.equal(hasValidSignature('bob', good), false)
  for (const [k, v] of Object.entries({ html: '<p>b</p>', css: 'q{}', js: 'y()', mode: 'block', placement: 'bottom', version: 3 })) {
    assert.equal(hasValidSignature('alice', { ...good, [k]: v }), false, k)
  }
  assert.equal(hasValidSignature('alice', { ...good, sig: 42 }), false)
  assert.equal(hasValidSignature('alice', null), false)
  assert.equal(trustedProfileCode('alice', good).mode, 'page')
  assert.equal(trustedProfileCode('alice', { ...good, sig: undefined }).mode, 'off')
  assert.equal(trustedProfileCode('alice', undefined), undefined)
  process.env.PROFILE_CODE_SECRET = 'rotated'
  assert.equal(hasValidSignature('alice', good), false, 'a new secret retires old signatures')
})

test('profile pages check signatures and cut pop-up links (COOP) when showing code', () => {
  const headers = {}
  const res = { setHeader: (k, v) => (headers[k] = v) }
  profileCodeHeaders(res, { mode: 'off' })
  profileCodeHeaders(res, undefined)
  assert.deepEqual(headers, {})
  profileCodeHeaders(res, { mode: 'page' })
  assert.equal(headers['Cross-Origin-Opener-Policy'], 'same-origin')
  // both places that render a profile must go through trustedProfileCode
  for (const file of ['src/pages/[username]/index.js', 'src/pages/index.js']) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
    assert.match(source, /user\.profileCode = trustedProfileCode\(user\.id, user\.profileCode\)/, file)
    assert.match(source, /profileCodeHeaders\(res, user\.profileCode\)/, file)
  }
})

test('frame: requests per visitor are limited', async () => {
  let last
  for (let i = 0; i < 241; i++) last = await call(frame, GET({ username: 'alice', embed: 'page', v: '3' }, { ...IFRAME, 'x-forwarded-for': '9.9.9.9' }))
  assert.equal(last.statusCode, 429)
  assert.match(last.headers['content-security-policy'], /^sandbox /)
  assert.equal((await call(frame, GET({ username: 'alice', embed: 'page', v: '3' }, { ...IFRAME, 'x-forwarded-for': '8.8.8.8' }))).statusCode, 200)
})

test('frame: opened as a page, it sends you to the profile', async () => {
  const res = await call(frame, GET({ username: 'alice' }, { 'sec-fetch-dest': 'document' }))
  assert.equal(res.statusCode, 302)
  assert.equal(res.headers.location, '/alice')
})

test('frame: unknown, switched-off and malformed profiles are 404s', async () => {
  for (const username of ['nobody', 'carol', '../etc', 'a'.repeat(65), '']) {
    const res = await call(frame, GET({ username }, { 'sec-fetch-dest': 'iframe' }))
    assert.equal(res.statusCode, 404, username)
    assert.match(res.headers['content-security-policy'], /^sandbox /)
    assert.equal(String(res.body).includes('hidden'), false)
  }
  assert.equal((await call(frame, POST({}, {}))).statusCode, 405)
})

test('preview shell: sandboxed, static, and never a top-level page', async () => {
  const res = await call(preview, GET({}, { 'sec-fetch-dest': 'iframe' }))
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['content-security-policy'], FRAME_CSP)
  assert.match(res.body, /bublr:render/)
  assert.match(res.body, /e\.source !== P/)
  const top = await call(preview, GET({}, { 'sec-fetch-dest': 'document' }))
  assert.equal(top.statusCode, 302)
  assert.equal((await call(preview, POST({}, {}))).statusCode, 405)
})

// ---------------------------------------------------------------------------
// Reading and saving

test('code API: sign-in required', async () => {
  assert.equal((await call(code, GET())).statusCode, 401)
  assert.equal((await call(code, POST({}, { html: 'x' }))).statusCode, 401)
  assert.equal((await call(code, { method: 'DELETE', headers: authHeader('alice') })).statusCode, 405)
})

test('code API: GET returns your own code, history and preview data', async () => {
  const res = await call(code, GET({}, authHeader('alice')))
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['cache-control'], 'private, no-store')
  assert.equal(res.body.code.html, PAGE.html)
  assert.equal(res.body.code.mode, 'page')
  assert.equal(res.body.code.version, 3)
  assert.ok(res.body.code.updatedAt)
  assert.deepEqual(res.body.revisions, [])
  assert.equal(res.body.data.name, 'alice')
  assert.deepEqual(res.body.data.posts.map(p => p.title), ['Published one'])
  assert.equal(res.body.data.friends.bob.displayName, 'Bob B')
  assert.equal(JSON.stringify(res.body).includes('reader@example.com'), false)

  const bob = await call(code, GET({}, authHeader('bob')))
  assert.equal(bob.body.code.html, '', 'Bob sees only his own (empty) code')
  assert.equal((await call(code, GET({}, authHeader('ghost')))).statusCode, 404)
})

test('code API: saving bumps the version, keeps history and goes live', async () => {
  const body = { html: '<p>v4 {{name}}</p>', css: '', js: '', mode: 'block', placement: 'top', baseVersion: 3 }
  const res = await call(code, POST(authHeader('alice'), body))
  assert.equal(res.statusCode, 200, JSON.stringify(res.body))
  assert.equal(res.body.version, 4)
  assert.equal(res.body.codeChanged, true)
  assert.equal(res.body.revisions.length, 1)
  assert.equal(res.body.revisions[0].version, 4)

  const stored = read('users', 'alice').profileCode
  assert.equal(stored.html, '<p>v4 {{name}}</p>')
  assert.equal(stored.mode, 'block')
  assert.equal(stored.placement, 'top')
  assert.equal(stored.version, 4)
  assert.ok(stored.updatedAt instanceof Timestamp)
  // everything else on the profile is untouched
  assert.equal(read('users', 'alice').email, 'alice@example.com')
  assert.deepEqual(read('users', 'alice').subscribers, [{ email: 'reader@example.com' }])

  assert.equal(hasValidSignature('alice', stored), true, 'saved code is signed')
  const live = await call(frame, GET({ username: 'alice', embed: 'block', v: '4' }, IFRAME))
  assert.equal(live.statusCode, 200)
  assert.match(live.body, /<p>v4 alice<\/p>/)
  const get = await call(code, GET({}, authHeader('alice')))
  assert.equal(get.body.code.trusted, true)

  // changing only the mode doesn't add a history entry
  const off = await call(code, POST(authHeader('alice'), { ...body, mode: 'off', baseVersion: 4 }))
  assert.equal(off.body.version, 5)
  assert.equal(off.body.codeChanged, false)
  assert.equal(all('users/alice/profileCodeRevisions').length, 1)
  assert.equal((await call(frame, GET({ username: 'alice', embed: 'page', v: '5' }, IFRAME))).statusCode, 404)
})

test('code API: a stale tab gets a conflict unless it chooses to overwrite', async () => {
  const stale = await call(code, POST(authHeader('alice'), { html: '<p>old tab</p>', mode: 'page', baseVersion: 2 }))
  assert.equal(stale.statusCode, 409)
  assert.equal(stale.body.error.code, 'VERSION_CONFLICT')
  assert.equal(stale.body.error.currentVersion, 3)
  assert.equal(read('users', 'alice').profileCode.html, PAGE.html)

  const forced = await call(code, POST(authHeader('alice'), { html: '<p>old tab</p>', mode: 'page', baseVersion: 2, force: true }))
  assert.equal(forced.statusCode, 200)
  assert.equal(read('users', 'alice').profileCode.html, '<p>old tab</p>')
})

test('code API: without a signing secret nothing can go live', async () => {
  delete process.env.PROFILE_CODE_SECRET
  delete process.env.UNSUBSCRIBE_SECRET
  delete process.env.RESEND_API_KEY
  delete process.env.MODERATION_SECRET_KEY
  assert.equal((await call(code, POST(authHeader('alice'), { html: '<p>x</p>', mode: 'page' }))).statusCode, 503)
  assert.equal((await call(code, POST(authHeader('alice'), { html: '<p>x</p>', mode: 'off' }))).statusCode, 200)
})

test('code API: the editor is told when stored code wasn’t saved through it', async () => {
  seed('users', 'alice', { ...read('users', 'alice'), profileCode: { ...PAGE, mode: 'page', version: 7 } })
  const res = await call(code, GET({}, authHeader('alice')))
  assert.equal(res.body.code.trusted, false)
  assert.equal((await call(code, GET({}, authHeader('bob')))).body.code.trusted, true, 'no code at all is fine')
})

test('code API: friend lookups are limited per writer', async () => {
  let last
  for (let i = 0; i < 61; i++) last = await call(code, GET({ friends: 'bob' }, authHeader('alice')))
  assert.equal(last.statusCode, 429)
})

test('code API: text drawn by scripts is moderated too', async () => {
  setModerationVerdict({ shouldUnpublish: true, reason: 'scam', category: 'scam' })
  const res = await call(code, POST(authHeader('alice'), { html: '<div id="x"></div>', js: "x.textContent = 'Send your wallet seed phrase to claim the prize from this page right now'", mode: 'page' }))
  assert.equal(res.statusCode, 422)
  const sent = groqCalls[groqCalls.length - 1].messages[0].content
  assert.match(sent, /wallet seed phrase/)
})

test('code API: invalid code is refused with a reason', async () => {
  const cases = [
    [{ html: 5 }, 'html'],
    [{ html: 'x', mode: 'banner' }, 'mode'],
    [{ html: '', mode: 'page' }, 'html'],
    [{ html: '<input type="password">', mode: 'page' }, 'html'],
    [{ html: 'a'.repeat(130 * 1024) }, 'html'],
  ]
  for (const [body, field] of cases) {
    const res = await call(code, POST(authHeader('alice'), body))
    assert.equal(res.statusCode, 400, JSON.stringify(body).slice(0, 60))
    assert.equal(res.body.error.field, field)
  }
  assert.equal(read('users', 'alice').profileCode.version, 3)
})

test('code API: shown pages are moderated like posts; hidden drafts aren’t', async () => {
  setModerationVerdict({ shouldUnpublish: true, reason: 'spam links', category: 'spam' })
  const text = `<p>${'Buy cheap followers now at my site. '.repeat(4)}</p>`
  const res = await call(code, POST(authHeader('alice'), { html: text, mode: 'page' }))
  assert.equal(res.statusCode, 422)
  assert.match(res.body.error.message, /spam links/)
  assert.equal(res.body.error.category, 'spam')
  assert.equal(read('users', 'alice').profileCode.version, 3, 'nothing saved')

  const callsBefore = groqCalls.length
  const draft = await call(code, POST(authHeader('alice'), { html: text, mode: 'off' }))
  assert.equal(draft.statusCode, 200)
  assert.equal(groqCalls.length, callsBefore, 'no moderation call for a hidden draft')
})

test('code API: history is capped, versions can be read back, friends looked up', async () => {
  for (let i = 0; i < MAX_REVISIONS + 3; i++) {
    seed('users/alice/profileCodeRevisions', `r${i}`, { html: `<p>${i}</p>`, css: '', js: '', mode: 'page', version: i, size: 8, savedAt: new Timestamp(1000 + i) })
  }
  const saved = await call(code, POST(authHeader('alice'), { html: '<p>newest</p>', mode: 'page' }))
  assert.equal(saved.statusCode, 200)
  assert.equal(all('users/alice/profileCodeRevisions').length, MAX_REVISIONS)
  assert.equal(saved.body.revisions.length, MAX_REVISIONS)
  assert.equal(saved.body.revisions[0].version, 4)
  assert.equal(read('users/alice/profileCodeRevisions', 'r0'), undefined, 'oldest dropped')

  const one = await call(code, GET({ revision: 'r22' }, authHeader('alice')))
  assert.equal(one.statusCode, 200)
  assert.equal(one.body.revision.html, '<p>22</p>')
  assert.equal((await call(code, GET({ revision: 'r22' }, authHeader('bob')))).statusCode, 404, 'history is per writer')
  assert.equal((await call(code, GET({ revision: '../../x' }, authHeader('alice')))).statusCode, 404)

  const friends = await call(code, GET({ friends: 'bob, ghost, BOB, ../x' }, authHeader('alice')))
  assert.deepEqual(Object.keys(friends.body.friends), ['bob'])
  assert.equal(friends.body.friends.bob.photo, 'https://img.example/b.png')
})

test('code API: saves are rate limited per writer', async () => {
  let last
  for (let i = 0; i < 31; i++) last = await call(code, POST(authHeader('alice'), { html: `<p>${i}</p>`, mode: 'off' }))
  assert.equal(last.statusCode, 429)
  assert.equal((await call(code, POST(authHeader('bob'), { html: '<p>b</p>', mode: 'off' }))).statusCode, 200)
})

// ---------------------------------------------------------------------------
// The AI helper

test('AI: sign-in, configuration and prompt checks', async () => {
  assert.equal((await call(ai, POST({}, { prompt: 'make it pink' }))).statusCode, 401)
  assert.equal((await call(ai, GET({}, authHeader('alice')))).statusCode, 405)
  delete process.env.GROQ_API_KEY
  assert.equal((await call(ai, POST(authHeader('alice'), { prompt: 'make it pink' }))).statusCode, 503)
  process.env.GROQ_API_KEY = 'test-key'
  assert.equal((await call(ai, POST(authHeader('alice'), { prompt: ' ' }))).statusCode, 400)
  assert.equal((await call(ai, POST(authHeader('alice'), { prompt: 'x'.repeat(2001) }))).statusCode, 400)
  assert.equal(groqCalls.length, 0)
})

test('AI: returns usable code and sends the current code along', async () => {
  queueCompletion(JSON.stringify({ html: '<h1>{{displayName}}</h1>', css: 'h1{color:pink}', js: '', summary: 'Made it pink.' }))
  const res = await call(ai, POST(authHeader('alice'), { prompt: 'make it pink', html: '<p>old</p>', css: '', js: '' }))
  assert.equal(res.statusCode, 200, JSON.stringify(res.body))
  assert.deepEqual(res.body, { html: '<h1>{{displayName}}</h1>', css: 'h1{color:pink}', js: '', summary: 'Made it pink.' })
  assert.equal(groqCalls.length, 1)
  assert.equal(groqCalls[0].model, 'openai/gpt-oss-120b')
  assert.deepEqual(groqCalls[0].response_format, { type: 'json_object' })
  assert.match(groqCalls[0].messages[1].content, /<p>old<\/p>/)
  assert.match(groqCalls[0].messages[1].content, /make it pink/)
  assert.match(groqCalls[0].messages[0].content, /<bublr-posts>/)
  assert.equal(read('users', 'alice').profileCode.html, PAGE.html, 'nothing is saved by the AI route')
})

test('AI: falls back to the next model when one is missing', async () => {
  queueCompletion(Object.assign(new Error('The model `openai/gpt-oss-120b` does not exist'), { status: 404 }))
  queueCompletion(JSON.stringify({ html: '<p>ok</p>' }))
  const res = await call(ai, POST(authHeader('alice'), { prompt: 'hello there' }))
  assert.equal(res.statusCode, 200)
  assert.equal(groqCalls.length, 2)
  assert.equal(groqCalls[1].model, 'llama-3.3-70b-versatile')

  // JSON mode failing retries the same model without it
  queueCompletion(Object.assign(new Error('json_validate_failed: Failed to generate JSON'), { status: 400 }))
  queueCompletion('{"html":"<p>plain</p>"}')
  const retry = await call(ai, POST(authHeader('alice'), { prompt: 'hello again' }))
  assert.equal(retry.statusCode, 200)
  assert.equal(groqCalls[2].model, 'openai/gpt-oss-120b')
  assert.equal(groqCalls[3].model, 'openai/gpt-oss-120b')
  assert.equal(groqCalls[3].response_format, undefined)

  process.env.GROQ_CODE_MODEL = 'custom/model'
  assert.deepEqual(modelsToTry(), ['custom/model', 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile'])
})

test('AI: unreadable, unsafe or failed answers are errors, not pages', async () => {
  queueCompletion('Sorry, I can’t help with that.')
  assert.equal((await call(ai, POST(authHeader('alice'), { prompt: 'something' }))).statusCode, 502)

  queueCompletion(JSON.stringify({ html: '<form><input type="password"></form>' }))
  const pw = await call(ai, POST(authHeader('alice'), { prompt: 'a login box' }))
  assert.equal(pw.statusCode, 502)
  assert.match(pw.body.error.message, /Password/)

  queueCompletion(Object.assign(new Error('rate limited'), { status: 429 }))
  assert.equal((await call(ai, POST(authHeader('alice'), { prompt: 'something' }))).statusCode, 429)

  queueCompletion(Object.assign(new Error('boom'), { status: 500 }))
  assert.equal((await call(ai, POST(authHeader('alice'), { prompt: 'something' }))).statusCode, 502)
})

test('AI: limited per writer per hour', async () => {
  for (let i = 0; i < 15; i++) queueCompletion(JSON.stringify({ html: '<p>x</p>' }))
  for (let i = 0; i < 15; i++) assert.equal((await call(ai, POST(authHeader('alice'), { prompt: 'again please' }))).statusCode, 200)
  assert.equal((await call(ai, POST(authHeader('alice'), { prompt: 'again please' }))).statusCode, 429)
})

test('AI: answers in other shapes are still read', () => {
  assert.equal(parseAnswer('```json\n{"html":"<p>a</p>","css":"x"}\n```').css, 'x')
  assert.equal(parseAnswer('Here you go: {"html":"<b>b</b>"} enjoy').html, '<b>b</b>')
  const fenced = parseAnswer('```html\n<p>c</p>\n```\n```css\np{}\n```\n```js\nx()\n```')
  assert.deepEqual(fenced, { html: '<p>c</p>\n', css: 'p{}\n', js: 'x()\n', summary: '' })
  assert.equal(parseAnswer('no code here'), null)
  assert.equal(parseAnswer('{"css":"only css"}'), null)
  const long = buildMessages({ prompt: 'p', html: 'h'.repeat(30000) })
  assert.match(long[1].content, /cut off for length/)
  assert.match(buildMessages({ prompt: 'p' })[1].content, /start from scratch/)
})

// ---------------------------------------------------------------------------
// Account deletion and headers

test('deleting an account removes the code and its whole history', async () => {
  seed('users/alice/profileCodeRevisions', 'r1', { html: '<p>1</p>', savedAt: new Timestamp(1) })
  seed('users/bob/profileCodeRevisions', 'r1', { html: '<p>bob</p>', savedAt: new Timestamp(1) })
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })
  await deleteAccountData('alice')
  assert.equal(read('users', 'alice'), undefined)
  assert.deepEqual(all('users/alice/profileCodeRevisions'), [])
  assert.equal(all('users/bob/profileCodeRevisions').length, 1)
})

test('headers: the site-wide CSP and DENY never reach the frame routes', async () => {
  const require = createRequire(import.meta.url)
  const config = require('../../next.config.js')
  const { pathToRegexp } = require('next/dist/compiled/path-to-regexp')
  const rules = await config.headers()
  const matching = path => rules.filter(r => pathToRegexp(r.source, [], { strict: true, sensitive: false, delimiter: '/' }).test(path))
  const keysFor = path => matching(path).flatMap(r => r.headers.map(h => `${h.key}: ${h.value}`))

  for (const path of ['/api/profile-frame/alice', '/api/profile-preview']) {
    const headers = keysFor(path)
    assert.ok(headers.includes('X-Frame-Options: SAMEORIGIN'), path)
    assert.equal(headers.some(h => h.startsWith('Content-Security-Policy')), false, `${path} must not get the site CSP`)
    assert.equal(headers.some(h => h === 'X-Frame-Options: DENY'), false, path)
    assert.ok(headers.includes('X-Content-Type-Options: nosniff'))
  }
  for (const path of ['/', '/alice', '/dashboard/settings/html', '/api/profile/code', '/api/profile-framer', '/api/profile-previewX', '/api/profile-preview/x', '/explore']) {
    const headers = keysFor(path)
    assert.ok(headers.includes('X-Frame-Options: DENY'), path)
    assert.ok(headers.some(h => h.startsWith('Content-Security-Policy') && /frame-ancestors 'none'/.test(h)), path)
  }
})

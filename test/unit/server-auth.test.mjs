import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import {
  verifyIdToken,
  requireAuth,
  requireSelf,
  hasSharedSecret,
  getBearerToken,
} from '../../src/lib/server-auth.js'
import { installTestCerts, makeToken, wrongKey, authHeader, mockReq, mockRes, certFetchCount, PROJECT_ID } from './helpers.mjs'

beforeEach(() => installTestCerts())

test('accepts a valid token and returns the uid', async () => {
  const decoded = await verifyIdToken(makeToken('alice'))
  assert.equal(decoded.uid, 'alice')
  assert.equal(decoded.aud, PROJECT_ID)
})

test('caches certificates between verifications', async () => {
  await verifyIdToken(makeToken('alice'))
  await verifyIdToken(makeToken('bob'))
  assert.equal(certFetchCount(), 1)
})

const rejects = (token, pattern) => assert.rejects(() => verifyIdToken(token), pattern)

test('rejects a missing or malformed token', async () => {
  await rejects(undefined, /Missing/)
  await rejects('', /Missing/)
  await rejects('abc', /Malformed/)
  await rejects('a.b.c', /Malformed/)
})

test('rejects tokens for another project or issuer', async () => {
  await rejects(makeToken('alice', { aud: 'someone-else' }), /different project/)
  await rejects(makeToken('alice', { iss: 'https://securetoken.google.com/someone-else' }), /issuer/)
})

test('rejects expired and future-dated tokens', async () => {
  const now = Math.floor(Date.now() / 1000)
  await rejects(makeToken('alice', { exp: now - 3600, iat: now - 7200 }), /expired/)
  await rejects(makeToken('alice', { iat: now + 3600 }), /future/)
})

test('rejects a token with no subject', async () => {
  await rejects(makeToken('alice', { sub: '' }), /no user/)
})

test('rejects a token signed with a different key', async () => {
  await rejects(makeToken('alice', {}, { signWith: wrongKey }), /signature/)
})

test('rejects an unknown key id after refetching once', async () => {
  await rejects(makeToken('alice', {}, { kid: 'nope' }), /unknown key/)
  assert.equal(certFetchCount(), 2) // initial fetch + one forced refresh
})

test('rejects alg=none and other algorithms', async () => {
  const [, payload] = makeToken('alice').split('.')
  const header = Buffer.from(JSON.stringify({ alg: 'none', kid: 'test-key-1' })).toString('base64url')
  await rejects(`${header}.${payload}.`, /algorithm/)
  await rejects(makeToken('alice', {}, { alg: 'HS256' }), /algorithm/)
})

test('rejects a tampered payload', async () => {
  const [header, , signature] = makeToken('alice').split('.')
  const forged = Buffer.from(JSON.stringify({
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    sub: 'mallory',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url')
  await rejects(`${header}.${forged}.${signature}`, /signature/)
})

test('getBearerToken reads the Authorization header', () => {
  assert.equal(getBearerToken({ headers: { authorization: 'Bearer abc.def.ghi' } }), 'abc.def.ghi')
  assert.equal(getBearerToken({ headers: { authorization: 'bearer   xyz ' } }), 'xyz')
  assert.equal(getBearerToken({ headers: { authorization: 'Basic abc' } }), null)
  assert.equal(getBearerToken({ headers: {} }), null)
})

test('requireAuth answers 401 without a valid token', async () => {
  const res = mockRes()
  assert.equal(await requireAuth(mockReq(), res), null)
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.code, 'UNAUTHENTICATED')
})

test('requireSelf allows the same user and answers 403 for someone else', async () => {
  const ok = mockRes()
  assert.equal(await requireSelf(mockReq({ headers: authHeader('alice') }), ok, 'alice'), 'alice')

  const noClaim = mockRes()
  assert.equal(await requireSelf(mockReq({ headers: authHeader('alice') }), noClaim, undefined), 'alice')

  const res = mockRes()
  assert.equal(await requireSelf(mockReq({ headers: authHeader('alice') }), res, 'bob'), null)
  assert.equal(res.statusCode, 403)
})

test('hasSharedSecret fails closed when the secret is unset', () => {
  const req = secret => ({ headers: { authorization: `Bearer ${secret}` } })
  // The old check compared against `Bearer ${undefined}`, so this got in
  assert.equal(hasSharedSecret(req('undefined'), undefined), false)
  assert.equal(hasSharedSecret(req(''), ''), false)
  assert.equal(hasSharedSecret(req('s3cret'), 's3cret'), true)
  assert.equal(hasSharedSecret(req('s3cre'), 's3cret'), false)
  assert.equal(hasSharedSecret({ headers: {} }, 's3cret'), false)
})

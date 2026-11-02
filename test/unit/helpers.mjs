// Shared test helpers: signed Firebase-style ID tokens and fake req/res.
import crypto from 'node:crypto'
import { _setCertFetcherForTesting } from '../../src/lib/server-auth.js'

export const PROJECT_ID = 'jrle-216c1' // matches src/lib/firebase-config.js

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const otherKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
export const KID = 'test-key-1'

let certFetches = 0
export function certFetchCount() {
  return certFetches
}

export function installTestCerts() {
  certFetches = 0
  _setCertFetcherForTesting(async () => {
    certFetches++
    return {
      certs: { [KID]: publicKey.export({ type: 'spki', format: 'pem' }) },
      maxAge: 3600,
    }
  })
}

const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url')

export function makeToken(uid, overrides = {}, { kid = KID, signWith = privateKey, alg = 'RS256' } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg, kid, typ: 'JWT' }
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    auth_time: now - 60,
    user_id: uid,
    sub: uid,
    iat: now - 30,
    exp: now + 3600,
    ...overrides,
  }
  const unsigned = `${b64(header)}.${b64(payload)}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), signWith).toString('base64url')
  return `${unsigned}.${signature}`
}

export const wrongKey = otherKeys.privateKey

export function authHeader(uid, overrides, options) {
  return { authorization: `Bearer ${makeToken(uid, overrides, options)}` }
}

export function mockReq({ method = 'GET', headers = {}, body = {}, query = {} } = {}) {
  return { method, headers, body, query }
}

export function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) {
      res.statusCode = code
      return res
    },
    json(payload) {
      res.body = payload
      return res
    },
    send(payload) {
      res.body = payload
      return res
    },
    setHeader(key, value) {
      res.headers[key.toLowerCase()] = value
      return res
    },
    end(payload) {
      if (payload !== undefined) res.body = payload
      return res
    },
  }
  return res
}

export async function call(handler, reqInit) {
  const res = mockRes()
  await handler(mockReq(reqInit), res)
  return res
}

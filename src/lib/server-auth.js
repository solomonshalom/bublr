import crypto from 'crypto'
import FIREBASE_CONFIG from './firebase-config'

/**
 * Server-side Firebase ID token verification for API routes.
 *
 * API routes used to trust whatever `userId` the request body claimed, so
 * anyone could act as any writer (create API keys for them, publish their
 * posts, change their domain, email their subscribers...). Now the browser
 * sends the signed-in user's Firebase ID token (see lib/authed-fetch.js) and
 * the route checks it here before doing anything on that user's behalf.
 *
 * This follows Firebase's documented manual verification: an RS256 JWT signed
 * by one of Google's securetoken certificates, issued for this project, not
 * expired, with a non-empty subject (the uid). No service account needed.
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

// Allow a little clock drift between Google and our servers.
const CLOCK_SKEW_SECONDS = 60

const projectId = () => process.env.FIREBASE_PROJECT_ID || FIREBASE_CONFIG.projectId

let certCache = { certs: null, expiresAt: 0 }

async function fetchGoogleCerts() {
  const res = await fetch(CERTS_URL)
  if (!res.ok) throw new Error(`Could not fetch token certificates (HTTP ${res.status})`)
  const certs = await res.json()
  const cacheControl = res.headers.get('cache-control') || ''
  const maxAge = Number((cacheControl.match(/max-age=(\d+)/) || [])[1]) || 3600
  return { certs, maxAge }
}

let certFetcher = fetchGoogleCerts

// Tests swap in their own signing certificates.
export function _setCertFetcherForTesting(fetcher) {
  certFetcher = fetcher || fetchGoogleCerts
  certCache = { certs: null, expiresAt: 0 }
}

async function getCerts(forceRefresh = false) {
  if (!forceRefresh && certCache.certs && Date.now() < certCache.expiresAt) {
    return certCache.certs
  }
  const { certs, maxAge } = await certFetcher()
  certCache = { certs, expiresAt: Date.now() + maxAge * 1000 }
  return certs
}

function decodeSegment(segment) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
}

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

/**
 * Verify a Firebase ID token and return its decoded claims ({ uid, ... }).
 * Throws AuthError when the token is missing, malformed, expired, signed by an
 * unknown key, or issued for a different project.
 */
export async function verifyIdToken(token, { now = Date.now() } = {}) {
  if (!token || typeof token !== 'string') throw new AuthError('Missing sign-in token')

  const parts = token.split('.')
  if (parts.length !== 3) throw new AuthError('Malformed sign-in token')

  let header
  let payload
  try {
    header = decodeSegment(parts[0])
    payload = decodeSegment(parts[1])
  } catch (_) {
    throw new AuthError('Malformed sign-in token')
  }

  if (header.alg !== 'RS256' || !header.kid) throw new AuthError('Unexpected token algorithm')

  const pid = projectId()
  const nowSeconds = Math.floor(now / 1000)

  if (payload.aud !== pid) throw new AuthError('Token was issued for a different project')
  if (payload.iss !== `https://securetoken.google.com/${pid}`) throw new AuthError('Unexpected token issuer')
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) {
    throw new AuthError('Token has no user')
  }
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_SECONDS < nowSeconds) {
    throw new AuthError('Sign-in token expired — please refresh and try again')
  }
  if (typeof payload.iat !== 'number' || payload.iat - CLOCK_SKEW_SECONDS > nowSeconds) {
    throw new AuthError('Token issued in the future')
  }
  if (typeof payload.auth_time === 'number' && payload.auth_time - CLOCK_SKEW_SECONDS > nowSeconds) {
    throw new AuthError('Token auth time is in the future')
  }

  let certs = await getCerts()
  if (!certs[header.kid]) {
    // Google rotates keys; refetch once before giving up.
    certs = await getCerts(true)
  }
  const cert = certs[header.kid]
  if (!cert) throw new AuthError('Token signed by an unknown key')

  let valid = false
  try {
    valid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      crypto.createPublicKey(cert),
      Buffer.from(parts[2], 'base64url')
    )
  } catch (_) {
    valid = false
  }
  if (!valid) throw new AuthError('Invalid token signature')

  return { ...payload, uid: payload.sub }
}

export function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim())
  return match ? match[1].trim() : null
}

/**
 * Resolve the signed-in user's uid for an API route, or answer 401 and return
 * null. Usage:
 *   const uid = await requireAuth(req, res)
 *   if (!uid) return
 */
export async function requireAuth(req, res) {
  try {
    const decoded = await verifyIdToken(getBearerToken(req))
    return decoded.uid
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 401
    res.status(status).json({ error: 'Please sign in again to continue.', code: 'UNAUTHENTICATED' })
    return null
  }
}

/**
 * Like requireAuth, but also checks the uid matches the user the request is
 * about (the `userId` the client sent). Answers 403 on a mismatch.
 */
export async function requireSelf(req, res, claimedUserId) {
  const uid = await requireAuth(req, res)
  if (!uid) return null
  if (claimedUserId && claimedUserId !== uid) {
    res.status(403).json({ error: 'You can only do that for your own account.', code: 'FORBIDDEN' })
    return null
  }
  return uid
}

/**
 * Constant-time check of a shared-secret bearer header (used by the
 * moderation endpoints). Fails closed when the secret isn't configured —
 * previously an unset secret meant `Bearer undefined` was accepted.
 */
export function hasSharedSecret(req, secret) {
  if (!secret) return false
  const provided = getBearerToken(req)
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

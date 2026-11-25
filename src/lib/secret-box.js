import crypto from 'crypto'

/**
 * Encryption for the secrets writers hand Bublr: their Spotify app's client
 * secret and refresh token, and the API key of their own Stripe or Creem
 * account (shop payments go straight to them).
 *
 * API routes run the Firebase client SDK without admin credentials, and user
 * documents can be read by anyone who knows the project config. So a secret
 * stored in a user document is sealed here first (AES-256-GCM with a key that
 * only the server has, INTEGRATIONS_SECRET) and is useless to whoever reads
 * the document.
 *
 * Every sealed value is bound to a context string (the writer's uid plus what
 * the value is). A ciphertext copied into someone else's document, or into a
 * different field, does not open.
 */

const VERSION = 'v1'

export class SecretBoxError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SecretBoxError'
  }
}

function masterSecret() {
  const secret = process.env.INTEGRATIONS_SECRET
  if (!secret || secret.length < 32) {
    throw new SecretBoxError('INTEGRATIONS_SECRET is not configured (needs at least 32 characters)')
  }
  return secret
}

// Separate keys for sealing and for signing OAuth state, both derived from the
// one environment variable.
function derivedKey(purpose) {
  return crypto.createHmac('sha256', masterSecret()).update(`bublr:${purpose}`).digest()
}

/** Whether secrets can be stored on this deployment. */
export function canSeal() {
  try {
    masterSecret()
    return true
  } catch (_) {
    return false
  }
}

export function seal(plaintext, context) {
  if (typeof plaintext !== 'string' || !plaintext) throw new SecretBoxError('Nothing to seal')
  if (!context) throw new SecretBoxError('A context is required')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey('seal'), iv)
  cipher.setAAD(Buffer.from(String(context)))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.')
}

/** Returns the plaintext, or null when the value is missing, tampered with or sealed for another context. */
export function open(sealed, context) {
  if (typeof sealed !== 'string' || !sealed) return null
  const parts = sealed.split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) return null
  try {
    const [, iv, tag, ciphertext] = parts
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey('seal'), Buffer.from(iv, 'base64url'))
    decipher.setAAD(Buffer.from(String(context)))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8')
  } catch (error) {
    if (error instanceof SecretBoxError) throw error
    return null
  }
}

/**
 * A signed, expiring token for an OAuth `state` parameter, so the callback
 * knows which writer started the flow and that Bublr started it.
 */
export function signState(payload, { now = Date.now() } = {}) {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now })).toString('base64url')
  const mac = crypto.createHmac('sha256', derivedKey('state')).update(body).digest('base64url')
  return `${body}.${mac}`
}

export function verifyState(token, { maxAgeMs = 15 * 60 * 1000, now = Date.now() } = {}) {
  if (typeof token !== 'string') return null
  const [body, mac] = token.split('.')
  if (!body || !mac) return null
  const expected = crypto.createHmac('sha256', derivedKey('state')).update(body).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (typeof payload.iat !== 'number' || now - payload.iat > maxAgeMs || payload.iat - now > 60 * 1000) return null
    return payload
  } catch (_) {
    return null
  }
}

/** "sk_live_…a1b2": enough of a key to recognise it, never enough to use it. */
export function keyHint(key) {
  const value = String(key || '')
  if (value.length < 12) return '••••'
  const prefix = value.match(/^(sk_live_|sk_test_|rk_live_|rk_test_|creem_test_|creem_)/)?.[0] || ''
  return `${prefix}…${value.slice(-4)}`
}

/**
 * HMAC over a list of values, for things that must stay readable but can't be
 * trusted from a world-writable document: the shop catalogue, the shop plan
 * grant, cached Creem product IDs. Anyone can read them; only the server can
 * produce a signature that matches.
 */
export function signValues(purpose, values) {
  const mac = crypto.createHmac('sha256', derivedKey(`sign:${purpose}`))
  for (const value of values) mac.update(`${String(value ?? '')}\u0000`)
  return mac.digest('base64url')
}

export function verifyValues(purpose, values, signature) {
  if (typeof signature !== 'string' || !signature) return false
  let expected
  try {
    expected = signValues(purpose, values)
  } catch (_) {
    return false
  }
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Stable hash for IDs that must be matched but not revealed (checkout IDs). */
export function hashId(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('base64url')
}

import crypto from 'crypto'

/**
 * Proof that a writer's Profile HTML was saved through /api/profile/code.
 *
 * The API routes write Firestore with the client SDK, so the database rules
 * can't tell our server from anyone else. Without this, writing a page
 * straight into someone's user document would skip sign-in, moderation and
 * every check, and put any page on bublr.life/<them>. The save route signs
 * the exact code with a server-only secret; pages only show code whose
 * signature matches. Server-only (Node crypto).
 */

function secret() {
  return (
    process.env.PROFILE_CODE_SECRET ||
    process.env.UNSUBSCRIBE_SECRET ||
    process.env.RESEND_API_KEY ||
    process.env.MODERATION_SECRET_KEY ||
    ''
  )
}

export function canSignProfileCode() {
  return !!secret()
}

const digest = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex')

function payload(uid, code) {
  return [
    'bublr-profile-code-v1',
    uid,
    String(code.version),
    String(code.mode),
    String(code.placement),
    digest(code.html),
    digest(code.css),
    digest(code.js),
  ].join('\n')
}

/** Hex HMAC over everything that decides what visitors see, or null with no secret. */
export function signProfileCode(uid, code) {
  const key = secret()
  if (!key || !uid || !code) return null
  return crypto.createHmac('sha256', key).update(payload(uid, code)).digest('hex')
}

export function hasValidSignature(uid, code) {
  if (!code || typeof code !== 'object' || typeof code.sig !== 'string') return false
  const expected = signProfileCode(uid, code)
  if (!expected || code.sig.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(code.sig), Buffer.from(expected))
}

/**
 * Response headers for a profile page that shows Profile HTML. The frame may
 * open pop-ups (links with target="_blank"); COOP cuts their link back to
 * this tab, so a page opened from a writer's code can't later swap the
 * visitor's Bublr tab for a look-alike. The profile page never needs a
 * pop-up of its own (sign-in pop-ups live on /signup).
 */
export function profileCodeHeaders(res, code) {
  const mode = code && typeof code === 'object' ? code.mode : 'off'
  if (res && (mode === 'block' || mode === 'page')) res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
}

/** The code as pages may show it: anything unsigned is treated as switched off. */
export function trustedProfileCode(uid, code) {
  if (!code || typeof code !== 'object') return code
  if (hasValidSignature(uid, code)) return code
  return { ...code, mode: 'off' }
}

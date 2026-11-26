import { signToken, verifyToken } from './secret-box'

/**
 * Readers of paid posts don't have Bublr accounts: they're newsletter
 * subscribers, known by their email address. To read a paid post on the web
 * they sign in with a link sent to that address (or the one in every paid
 * post's email), which sets a signed, HttpOnly cookie in their browser.
 *
 * A session made from an email link proves the address, so it opens every
 * writer that address pays for. A session made straight after paying (the
 * checkout return page) proves only that this browser paid that one writer,
 * so it is limited to them: knowing someone's address and paying a writer
 * must not open the other writers they subscribe to.
 *
 *   cookie bublr_reader = signToken('reader-session', { e, v?, w? })
 *     e  the email address
 *     v  1 when the address was proven by an email link
 *     w  writer uids this browser paid, when it wasn't
 */

export const READER_COOKIE = 'bublr_reader'
export const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000
export const LOGIN_LINK_TTL_MS = 60 * 60 * 1000 // a link someone asked for
export const EMAIL_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000 // the link in a paid post's email

const norm = email => String(email || '').trim().toLowerCase()
const MAX_WRITERS = 20

function parseCookies(req) {
  if (req?.cookies && typeof req.cookies === 'object') return req.cookies
  const out = {}
  for (const part of String(req?.headers?.cookie || '').split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    const key = part.slice(0, index).trim()
    if (!key) continue
    try {
      out[key] = decodeURIComponent(part.slice(index + 1).trim())
    } catch (_) {
      out[key] = part.slice(index + 1).trim()
    }
  }
  return out
}

/** The reader signed in on this request, or null: { email, verified, writers }. */
export function readerFromRequest(req, { now = Date.now() } = {}) {
  const token = parseCookies(req)[READER_COOKIE]
  const payload = token ? verifyToken('reader-session', token, { now }) : null
  if (!payload || typeof payload.e !== 'string' || !payload.e.includes('@')) return null
  return {
    email: norm(payload.e),
    verified: payload.v === 1,
    writers: Array.isArray(payload.w) ? payload.w.filter(id => typeof id === 'string').slice(0, MAX_WRITERS) : [],
  }
}

/** Whether this session may stand for its email address with this writer. */
export const sessionCovers = (session, writerId) => Boolean(session) && (session.verified || session.writers.includes(writerId))

function cookieHeader(value, maxAgeSeconds) {
  return `${READER_COOKIE}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`
}

/** Set-Cookie for a session proven by an email link. */
export function verifiedSessionCookie(email, { now = Date.now() } = {}) {
  const token = signToken('reader-session', { e: norm(email), v: 1 }, { now, ttlMs: SESSION_TTL_MS })
  return cookieHeader(token, Math.floor(SESSION_TTL_MS / 1000))
}

/**
 * Set-Cookie after paying one writer. Keeps what the current session already
 * covers when it's for the same address.
 */
export function paidSessionCookie(req, email, writerId, { now = Date.now() } = {}) {
  const current = readerFromRequest(req, { now })
  const address = norm(email)
  if (current && current.email === address && current.verified) return null // already covers everything
  const writers = current && current.email === address ? current.writers : []
  const next = [writerId, ...writers.filter(id => id !== writerId)].slice(0, MAX_WRITERS)
  const token = signToken('reader-session', { e: address, w: next }, { now, ttlMs: SESSION_TTL_MS })
  return cookieHeader(token, Math.floor(SESSION_TTL_MS / 1000))
}

export const clearedSessionCookie = () => cookieHeader('', 0)

// ------------------------------------------------------------ links

/**
 * Links that go out by email always point at Bublr's own address, never a
 * writer's custom domain: `customDomain` sits in a world-writable document,
 * so a link built from it could be sent somewhere else, with a sign-in token
 * in it.
 */
export const emailOrigin = () => String(process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life').replace(/\/+$/, '')

/** A sign-in link: opens /api/newsletter/paid/session, which sets the cookie and goes to `next`. */
export function loginUrl(origin, email, { next = '/', ttlMs = LOGIN_LINK_TTL_MS, now = Date.now() } = {}) {
  const token = signToken('reader-login', { e: norm(email), n: safeNext(next) }, { now, ttlMs })
  return `${origin.replace(/\/$/, '')}/api/newsletter/paid/session?token=${encodeURIComponent(token)}`
}

export function verifyLoginToken(token, { now = Date.now() } = {}) {
  const payload = verifyToken('reader-login', token, { now })
  if (!payload || typeof payload.e !== 'string' || !payload.e.includes('@')) return null
  return { email: norm(payload.e), next: safeNext(payload.n) }
}

/** A link to manage one paid subscription (status, cancel, card). It doesn't expire, like unsubscribe links. */
export function manageUrl(origin, email, writerId) {
  const token = signToken('paid-manage', { e: norm(email), u: writerId })
  return `${origin.replace(/\/$/, '')}/api/newsletter/paid/manage?token=${encodeURIComponent(token)}`
}

export function verifyManageToken(token) {
  const payload = verifyToken('paid-manage', token)
  if (!payload || typeof payload.e !== 'string' || typeof payload.u !== 'string') return null
  return { email: norm(payload.e), writerId: payload.u }
}

/** Only paths on this site: "/name/slug", never "//elsewhere" or a full URL. */
export function safeNext(value) {
  const path = typeof value === 'string' ? value : ''
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\') || path.length > 500) return '/'
  if (/[\u0000-\u001F\u007F]/.test(path)) return '/'
  return path
}

/** "jo***@example.com" */
export function maskEmail(email) {
  const [local, domain] = norm(email).split('@')
  if (!domain) return '***'
  return `${local.slice(0, Math.min(3, Math.max(1, local.length - 1)))}***@${domain}`
}

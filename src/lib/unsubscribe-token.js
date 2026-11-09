import crypto from 'crypto'

// Unsubscribe links used to be just ?email=&author=, so anyone who knew an
// address could unsubscribe it. Links now carry an HMAC of both values that
// only the server can produce.

function secret() {
  return (
    process.env.UNSUBSCRIBE_SECRET ||
    process.env.RESEND_API_KEY ||
    process.env.MODERATION_SECRET_KEY ||
    ''
  )
}

const norm = v => String(v || '').trim().toLowerCase()

export function signUnsubscribe(email, author) {
  const key = secret()
  if (!key) return ''
  return crypto
    .createHmac('sha256', key)
    .update(`unsubscribe:${norm(email)}:${norm(author)}`)
    .digest('hex')
    .slice(0, 32)
}

export function verifyUnsubscribe(email, author, token) {
  const expected = signUnsubscribe(email, author)
  if (!expected || typeof token !== 'string' || token.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}

export function unsubscribeUrl(email, author, base = 'https://bublr.life') {
  const t = signUnsubscribe(email, author)
  return `${base}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&author=${encodeURIComponent(author)}&token=${t}`
}

// Confirmation links (double opt-in) use a different prefix so an unsubscribe
// token can never be replayed as a confirmation, or the other way round.
export function signConfirm(email, author) {
  const key = secret()
  if (!key) return ''
  return crypto
    .createHmac('sha256', key)
    .update(`confirm:${norm(email)}:${norm(author)}`)
    .digest('hex')
    .slice(0, 32)
}

export function verifyConfirm(email, author, token) {
  const expected = signConfirm(email, author)
  if (!expected || typeof token !== 'string' || token.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}

export function confirmUrl(email, author, base = 'https://bublr.life') {
  const t = signConfirm(email, author)
  return `${base}/api/newsletter/confirm?email=${encodeURIComponent(email)}&author=${encodeURIComponent(author)}&token=${t}`
}

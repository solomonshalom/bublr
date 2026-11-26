import crypto from 'crypto'

/**
 * HTTP Signatures as the fediverse uses them (draft-cavage-http-signatures-12,
 * the flavour Mastodon, GoToSocial, Misskey and friends speak), with a SHA-256
 * Digest of the body on POSTs.
 */

export const MAX_CLOCK_SKEW_MS = 12 * 60 * 60 * 1000

export class SignatureError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SignatureError'
  }
}

export function digestHeader(body) {
  return `SHA-256=${crypto.createHash('sha256').update(body).digest('base64')}`
}

/**
 * Headers for a signed request from one of our actors. `host` is left out of
 * the returned headers (fetch sets it from the URL, which is what's signed).
 */
export function signRequest({ method, url, body = null, keyId, privateKeyPem, contentType, accept, now = Date.now() }) {
  const target = new URL(url)
  const headers = {
    host: target.host,
    date: new Date(now).toUTCString(),
  }
  if (body !== null && body !== undefined) {
    headers.digest = digestHeader(body)
    headers['content-type'] = contentType
  }
  const names = ['(request-target)', 'host', 'date', ...(headers.digest ? ['digest', 'content-type'] : [])]
  const signingString = names
    .map(name =>
      name === '(request-target)'
        ? `(request-target): ${method.toLowerCase()} ${target.pathname}${target.search}`
        : `${name}: ${headers[name]}`
    )
    .join('\n')
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingString), privateKeyPem).toString('base64')
  const out = { ...headers }
  delete out.host
  if (accept) out.accept = accept
  out.signature = `keyId="${keyId}",algorithm="rsa-sha256",headers="${names.join(' ')}",signature="${signature}"`
  return out
}

export function parseSignatureHeader(value) {
  const header = String(value || '')
  if (!header || header.length > 8192) return null
  const out = {}
  const re = /([a-zA-Z]+)="((?:[^"\\]|\\.)*)"/g
  let match
  while ((match = re.exec(header))) out[match[1].toLowerCase()] = match[2]
  if (!out.keyid || !out.signature) return null
  return {
    keyId: out.keyid,
    algorithm: (out.algorithm || 'hs2019').toLowerCase(),
    headers: (out.headers || 'date').toLowerCase().split(/\s+/).filter(Boolean),
    signature: out.signature,
    created: out.created ? Number(out.created) : null,
    expires: out.expires ? Number(out.expires) : null,
  }
}

const headerValue = (headers, name) => {
  const value = headers[name]
  if (value === undefined || value === null) return null
  return Array.isArray(value) ? value.join(', ') : String(value)
}

/**
 * Check a request's signature against the sender's public key.
 *
 * `paths` are the request targets to try (a rewrite or proxy may hand the
 * route a different path from the one the sender signed). Throws
 * SignatureError when it doesn't hold.
 */
export function verifyRequestSignature({ method, paths, headers, rawBody = null, parsed, publicKeyPem, now = Date.now() }) {
  if (!parsed) throw new SignatureError('No signature')
  const names = parsed.headers
  if (!names.includes('(request-target)')) throw new SignatureError('The request target isn’t signed')
  if (!names.includes('date') && !names.includes('(created)')) throw new SignatureError('The date isn’t signed')

  // Fresh enough
  const sentAt = names.includes('date') ? Date.parse(headerValue(headers, 'date') || '') : (parsed.created || 0) * 1000
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > MAX_CLOCK_SKEW_MS) throw new SignatureError('The request is too old or from the future')
  if (parsed.expires && parsed.expires * 1000 < now) throw new SignatureError('The signature has expired')

  // The body is the one that was signed
  if (rawBody !== null) {
    if (!names.includes('digest')) throw new SignatureError('The body isn’t signed')
    const digest = headerValue(headers, 'digest') || ''
    const expected = digestHeader(rawBody)
    const offered = digest.split(',').map(part => part.trim())
    if (!offered.some(part => part.toLowerCase().startsWith('sha-256=') && part.slice(8) === expected.slice(8))) {
      throw new SignatureError('The body doesn’t match its digest')
    }
  }

  const signature = Buffer.from(parsed.signature, 'base64')
  let key
  try {
    key = crypto.createPublicKey(publicKeyPem)
  } catch (_) {
    throw new SignatureError('The sender’s key can’t be read')
  }
  const algorithms = parsed.algorithm === 'rsa-sha512' ? ['RSA-SHA512'] : parsed.algorithm === 'rsa-sha256' ? ['RSA-SHA256'] : ['RSA-SHA256', 'RSA-SHA512']

  for (const path of paths) {
    const lines = []
    for (const name of names) {
      if (name === '(request-target)') lines.push(`(request-target): ${method.toLowerCase()} ${path}`)
      else if (name === '(created)') lines.push(`(created): ${parsed.created}`)
      else if (name === '(expires)') lines.push(`(expires): ${parsed.expires}`)
      else {
        const value = headerValue(headers, name)
        if (value === null) throw new SignatureError(`Signed header ${name} is missing`)
        lines.push(`${name}: ${value}`)
      }
    }
    const data = Buffer.from(lines.join('\n'))
    for (const algorithm of algorithms) {
      try {
        if (crypto.verify(algorithm, data, key, signature)) return true
      } catch (_) {
        // try the next one
      }
    }
  }
  throw new SignatureError('The signature doesn’t match')
}

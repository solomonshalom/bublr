import dns from 'dns'
import net from 'net'
import { AP_ACCEPT, AP_CONTENT_TYPE } from './config'
import { signRequest } from './signatures'

/**
 * Talking to other fediverse servers. Every URL here comes from someone else
 * (a key id, an actor, an inbox), so before fetching it must be https, on the
 * public internet (no private, loopback or link-local addresses, by name or
 * after DNS), and answers are size- and time-limited. Redirects are followed
 * by hand so each hop is checked too. fetch() resolves the name again, so a
 * host that answers DNS differently the second time (rebinding) isn't caught;
 * on Vercel's functions there's no private network behind it to reach.
 */

const MAX_BYTES = 1024 * 1024
const TIMEOUT_MS = 8000
const MAX_REDIRECTS = 3
const USER_AGENT = 'Bublr (+https://bublr.life)'

export class RemoteError extends Error {
  constructor(message, status = null) {
    super(message)
    this.name = 'RemoteError'
    this.status = status
  }
}

function privateV4(address) {
  const [a, b] = address.split('.').map(Number)
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  )
}

export function isPrivateAddress(address) {
  const value = String(address || '').toLowerCase().replace(/^\[|\]$/g, '')
  if (net.isIPv4(value)) return privateV4(value)
  if (net.isIPv6(value)) {
    if (value === '::' || value === '::1') return true
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return privateV4(mapped[1])
    if (/^::ffff:/.test(value) || /^64:ff9b:/.test(value)) return true
    return /^f[cd]/.test(value) || /^fe[89ab]/.test(value) || /^ff/.test(value)
  }
  return false
}

let lookup = async hostname => (await dns.promises.lookup(hostname, { all: true })).map(entry => entry.address)

// Tests resolve hosts themselves.
export function _setLookupForTesting(fn) {
  lookup = fn || (async hostname => (await dns.promises.lookup(hostname, { all: true })).map(entry => entry.address))
}

/** Throws RemoteError unless the URL is one Bublr may fetch. */
export async function assertPublicUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch (_) {
    throw new RemoteError('Not a URL')
  }
  if (url.protocol !== 'https:') throw new RemoteError('Only https URLs')
  if (url.username || url.password) throw new RemoteError('No credentials in URLs')
  if (url.port && url.port !== '443') throw new RemoteError('Only the standard port')
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new RemoteError('Not a public address')
    return url
  }
  if (!host.includes('.') || host === 'localhost' || /\.(localhost|local|internal|lan|home|corp)$/.test(host)) {
    throw new RemoteError('Not a public host')
  }
  let addresses
  try {
    addresses = await lookup(host)
  } catch (_) {
    throw new RemoteError('Host not found')
  }
  if (!addresses.length || addresses.some(isPrivateAddress)) throw new RemoteError('Not a public address')
  return url
}

async function readLimited(response) {
  const length = Number(response.headers?.get?.('content-length'))
  if (Number.isFinite(length) && length > MAX_BYTES) throw new RemoteError('Answer too large')
  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader()
    const chunks = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) {
        reader.cancel().catch(() => {})
        throw new RemoteError('Answer too large')
      }
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks).toString('utf8')
  }
  const text = await response.text()
  if (text.length > MAX_BYTES) throw new RemoteError('Answer too large')
  return text
}

async function request(url, init, { signer = null, body = null, accept = AP_ACCEPT } = {}) {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current)
    const headers = signer
      ? signRequest({
          method: init.method,
          url: current,
          body,
          keyId: signer.keyId,
          privateKeyPem: signer.privateKeyPem,
          contentType: AP_CONTENT_TYPE,
          accept: init.method === 'GET' ? accept : undefined,
        })
      : { ...(init.method === 'GET' ? { accept } : {}), ...(body ? { 'content-type': AP_CONTENT_TYPE } : {}) }
    headers['user-agent'] = USER_AGENT
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null
    let response
    try {
      response = await fetch(current, { ...init, headers, body: body ?? undefined, redirect: 'manual', signal: controller?.signal })
    } catch (error) {
      throw new RemoteError(error?.name === 'AbortError' ? 'Timed out' : 'Could not connect')
    } finally {
      if (timer) clearTimeout(timer)
    }
    const location = response.headers?.get?.('location')
    if ([301, 302, 303, 307, 308].includes(response.status) && location && init.method === 'GET') {
      current = new URL(location, current).toString()
      continue
    }
    return response
  }
  throw new RemoteError('Too many redirects')
}

/** GET an ActivityPub document (signed when a signer is given). */
export async function fetchActivityJson(url, { signer = null } = {}) {
  const response = await request(url, { method: 'GET' }, { signer })
  if (!response.ok) throw new RemoteError(`Answered ${response.status}`, response.status)
  const text = await readLimited(response)
  try {
    const json = JSON.parse(text)
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('not an object')
    return json
  } catch (_) {
    throw new RemoteError('Not JSON')
  }
}

/** POST an activity to an inbox, signed. Returns the HTTP status. */
export async function postActivity(inbox, activity, { signer }) {
  const body = JSON.stringify(activity)
  const response = await request(inbox, { method: 'POST' }, { signer, body })
  return response.status
}

import { isPlatformHost } from './domain-utils'

/** The public site address, without a trailing slash. */
export function baseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life').replace(/\/+$/, '')
}

/**
 * Where to send someone back to after checkout or the billing portal: the
 * Bublr host they're on (production, a preview deployment, localhost), or the
 * public site address for anything else.
 */
export function requestOrigin(req) {
  const headers = req?.headers || {}
  const host = String(headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim()
  if (!host || !isPlatformHost(host)) return baseUrl()
  const local = /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(host)
  const proto = String(headers['x-forwarded-proto'] || '').split(',')[0].trim() || (local ? 'http' : 'https')
  return `${proto === 'http' ? 'http' : 'https'}://${host}`
}

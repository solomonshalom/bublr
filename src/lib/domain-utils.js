// Domain helpers shared by the browser and the server (no Node-only APIs).
import { isReservedUsername } from './reserved-usernames'
//
// Tells apart "example.com" (needs an A record) from "blog.example.com"
// (needs a CNAME). Counting dots isn't enough: "example.co.uk" has three
// labels but is still a root domain. We avoid a full public-suffix dependency
// and list the common two-part endings instead.

const TWO_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk', 'ltd.uk', 'plc.uk', 'net.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'id.au',
  'co.nz', 'org.nz', 'net.nz', 'ac.nz',
  'co.in', 'net.in', 'org.in', 'firm.in', 'gen.in', 'ind.in', 'ac.in',
  'co.za', 'org.za', 'net.za', 'web.za',
  'co.jp', 'or.jp', 'ne.jp', 'ac.jp',
  'co.kr', 'or.kr', 'ne.kr',
  'com.br', 'net.br', 'org.br',
  'com.mx', 'org.mx', 'com.ar', 'com.co', 'com.pe', 'com.ve',
  'com.cn', 'net.cn', 'org.cn',
  'com.hk', 'com.tw', 'com.sg', 'com.my', 'com.ph', 'com.vn',
  'com.tr', 'com.ua', 'com.pl', 'com.ng', 'com.eg', 'com.pk', 'com.bd',
  'co.id', 'co.il', 'co.th', 'co.ke', 'co.ug', 'co.tz', 'co.zw',
])

export const PLATFORM_DOMAIN = 'bublr.life'

export function normalizeDomain(domain) {
  return String(domain || '').trim().toLowerCase().replace(/\.$/, '')
}

// Number of labels that make up the registrable domain: 3 for example.co.uk, 2 for example.com.
function registrableLabelCount(labels) {
  const lastTwo = labels.slice(-2).join('.')
  return TWO_PART_SUFFIXES.has(lastTwo) ? 3 : 2
}

export function isSubdomain(domain) {
  const labels = normalizeDomain(domain).split('.').filter(Boolean)
  return labels.length > registrableLabelCount(labels)
}

// "blog.example.com" -> "blog", "a.b.example.co.uk" -> "a.b", "example.com" -> ""
export function subdomainLabel(domain) {
  const labels = normalizeDomain(domain).split('.').filter(Boolean)
  return labels.slice(0, Math.max(0, labels.length - registrableLabelCount(labels))).join('.')
}

// "blog.example.co.uk" -> "example.co.uk"
export function apexDomain(domain) {
  const labels = normalizeDomain(domain).split('.').filter(Boolean)
  return labels.slice(-registrableLabelCount(labels)).join('.')
}

/**
 * The name to type into a registrar's DNS form for a record on `fqdn`, which
 * most registrars want relative to the zone: "_vercel.example.com" -> "_vercel",
 * "example.com" -> "@".
 */
export function relativeRecordName(fqdn, apex) {
  const name = normalizeDomain(fqdn)
  const zone = normalizeDomain(apex || apexDomain(name))
  if (!zone || name === zone) return '@'
  if (name.endsWith(`.${zone}`)) return name.slice(0, -(zone.length + 1))
  return name
}

/**
 * The other half of an apex/www pair, which we point at the writer's domain
 * so both spellings work: "example.com" <-> "www.example.com". Other
 * subdomains ("blog.example.com") have no companion.
 */
export function companionDomain(domain) {
  const d = normalizeDomain(domain)
  if (!d) return null
  if (!isSubdomain(d)) return `www.${d}`
  if (d.startsWith('www.') && !isSubdomain(d.slice(4))) return d.slice(4)
  return null
}

/** Lowercased host without port or trailing dot: "Blog.Example.com:443." -> "blog.example.com" */
export function normalizeHost(host) {
  let h = String(host || '').trim().toLowerCase()
  if (h.startsWith('[')) {
    // IPv6 literal, maybe with a port: [::1]:3000
    const end = h.indexOf(']')
    return end === -1 ? h : h.slice(0, end + 1)
  }
  return h.replace(/\.$/, '').replace(/:\d*$/, '').replace(/\.$/, '')
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

function baseUrlHost() {
  try {
    return normalizeHost(new URL(process.env.NEXT_PUBLIC_BASE_URL || `https://${PLATFORM_DOMAIN}`).host)
  } catch (_) {
    return PLATFORM_DOMAIN
  }
}

function sameOrSubdomainOf(host, parent) {
  return host === parent || host.endsWith(`.${parent}`)
}

// Other domains Bublr itself serves from this Vercel project (aliases, old
// names), comma-separated in RESERVED_DOMAINS. They can never be claimed or
// detached by a writer. Read on the server; the browser doesn't need them.
function reservedDomains() {
  const raw = typeof process !== 'undefined' && process.env ? process.env.RESERVED_DOMAINS : ''
  return String(raw || '')
    .split(',')
    .map(d => normalizeHost(d))
    .filter(Boolean)
}

/**
 * Can a post with this slug be reached at <writer's domain>/<slug>? Not when
 * the slug matches one of Bublr's own pages (/about, /explore...): that page
 * wins. Link to the post on bublr.life instead.
 */
export function slugServedOnCustomDomain(slug) {
  return Boolean(slug) && !isReservedUsername(slug)
}

/**
 * Hosts that are Bublr itself rather than a writer's domain: bublr.life, the
 * configured base URL, Vercel deployment URLs, and local/dev addresses.
 */
export function isPlatformHost(rawHost) {
  const host = normalizeHost(rawHost)
  if (!host) return true
  if (host.startsWith('[') || IPV4.test(host)) return true
  if (sameOrSubdomainOf(host, PLATFORM_DOMAIN)) return true
  const base = baseUrlHost()
  if (base && sameOrSubdomainOf(host, base)) return true
  if (sameOrSubdomainOf(host, 'vercel.app')) return true
  if (reservedDomains().some(domain => sameOrSubdomainOf(host, domain))) return true
  if (sameOrSubdomainOf(host, 'localhost')) return true
  if (/\.(local|internal|test|lan|home|ngrok\.io|ngrok-free\.app)$/.test(host)) return true
  return !host.includes('.')
}

// Domains a writer can never claim: ours, Vercel's, and reserved names.
const FORBIDDEN_PARENTS = [PLATFORM_DOMAIN, 'vercel.app', 'vercel.com', 'vercel-dns.com', 'now.sh']
const FORBIDDEN_TLDS = new Set(['local', 'localhost', 'internal', 'test', 'example', 'invalid', 'lan', 'home', 'onion', 'arpa'])

// 1-63 letters, digits or hyphens, not starting or ending with a hyphen.
// (No lookbehind: older Safari can't parse it and this module ships to the browser.)
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * Turn whatever a writer typed or pasted into a bare domain, or explain what's
 * wrong. Accepts "https://Blog.Example.com/about", "example.com.", unicode
 * names (converted to punycode) and so on.
 *
 * @returns {{ domain: string } | { error: string }}
 */
export function parseDomainInput(raw) {
  let value = String(raw || '').trim().toLowerCase()
  if (!value) return { error: 'Enter a domain, like yourname.com or blog.yourname.com.' }
  if (value.length > 300) return { error: 'That domain is too long.' }

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '') // scheme
  value = value.replace(/[/?#].*$/, '') // path, query, fragment
  if (value.includes('@')) return { error: 'Enter just the domain, without an email or username.' }
  if (value.includes('*')) return { error: 'Wildcard domains are not supported. Enter one domain.' }
  value = value.replace(/:\d*$/, '').replace(/\.+$/, '')

  // Unicode domains -> punycode, the way browsers and DNS see them
  let domain = value
  try {
    domain = new URL(`http://${value}`).hostname
  } catch (_) {
    return { error: 'That doesn’t look like a domain. Try something like yourname.com.' }
  }
  domain = domain.replace(/\.$/, '')

  if (IPV4.test(domain) || domain.startsWith('[')) {
    return { error: 'Use a domain name, not an IP address.' }
  }
  const labels = domain.split('.')
  if (labels.length < 2) return { error: 'Include the ending, like yourname.com.' }
  if (domain.length > 253 || !labels.every(label => LABEL.test(label))) {
    return { error: 'That doesn’t look like a domain. Use letters, numbers and hyphens, like yourname.com.' }
  }
  const tld = labels[labels.length - 1]
  if (/^\d+$/.test(tld) || FORBIDDEN_TLDS.has(tld)) {
    return { error: 'That domain ending can’t be used on the public internet.' }
  }
  if (FORBIDDEN_PARENTS.some(parent => sameOrSubdomainOf(domain, parent)) || isPlatformHost(domain)) {
    return { error: 'That domain belongs to Bublr or our host. Use a domain you own.' }
  }
  return { domain }
}

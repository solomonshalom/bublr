import { firestore } from './firebase'
import {
  addProjectDomain,
  getDomainConfig,
  getProjectDomain,
  removeProjectDomain,
  vercelErrorMessage,
} from './vercel'
import {
  apexDomain,
  isPlatformHost,
  isSubdomain,
  normalizeHost,
  parseDomainInput,
  relativeRecordName,
  subdomainLabel,
} from './domain-utils'
import { hasActiveAccess } from './subscription'

/**
 * Writers' own domains, server side: attaching them to the Vercel project,
 * telling the writer which DNS records to add, and working out which writer a
 * request's Host header belongs to.
 *
 * Stored on the user document:
 *   customDomain: {
 *     domain, companion,           // e.g. "example.com" and "www.example.com"
 *     status: 'pending' | 'verified',
 *     records: [{ type, name, value, host, purpose, required }],
 *     message, addedAt, verifiedAt, lastCheckedAt
 *   }
 */

// Vercel's long-standing defaults, used when the API doesn't recommend values
export const DEFAULT_A_RECORD = '76.76.21.21'
export const DEFAULT_CNAME_RECORD = 'cname.vercel-dns.com'

const users = () => firestore.collection('users')
const stripDot = value => String(value || '').replace(/\.$/, '')

/** Writers whose domain or www/apex companion is `domain`. */
export async function findDomainClaims(domain) {
  const [primary, companion] = await Promise.all([
    users().where('customDomain.domain', '==', domain).limit(5).get(),
    users().where('customDomain.companion', '==', domain).limit(5).get(),
  ])
  return [
    ...primary.docs.map(doc => ({ id: doc.id, as: 'domain' })),
    ...companion.docs.map(doc => ({ id: doc.id, as: 'companion' })),
  ]
}

export async function domainClaimedByOther(domain, userId) {
  const claims = await findDomainClaims(domain)
  return claims.some(claim => claim.id !== userId)
}

function preferred(list) {
  if (!Array.isArray(list) || list.length === 0) return null
  return [...list].sort((a, b) => (a?.rank ?? 99) - (b?.rank ?? 99))[0]?.value ?? null
}

/** The A and CNAME targets Vercel recommends for this project. */
export function recommendedTargets(config) {
  const ipv4 = preferred(config?.recommendedIPv4)
  const cname = preferred(config?.recommendedCNAME)
  return {
    a: (Array.isArray(ipv4) ? ipv4[0] : ipv4) || DEFAULT_A_RECORD,
    cname: stripDot(cname) || DEFAULT_CNAME_RECORD,
  }
}

function routingRecord(domain, targets, { required = true, purpose = 'routing' } = {}) {
  return isSubdomain(domain)
    ? { type: 'CNAME', name: subdomainLabel(domain), value: targets.cname, host: domain, purpose, required }
    : { type: 'A', name: '@', value: targets.a, host: domain, purpose, required }
}

/**
 * The DNS records the writer needs: the A/CNAME that routes the domain to us,
 * any TXT record Vercel wants as proof of ownership, and the optional record
 * for the www/apex companion.
 */
export function buildDnsRecords({ domain, companion = null, projectDomain = null, config = null }) {
  const targets = recommendedTargets(config)
  const apex = projectDomain?.apexName || apexDomain(domain)
  const records = [routingRecord(domain, targets)]

  if (projectDomain && projectDomain.verified === false && Array.isArray(projectDomain.verification)) {
    for (const challenge of projectDomain.verification) {
      if (!challenge?.type || !challenge?.domain || !challenge?.value) continue
      records.push({
        type: String(challenge.type).toUpperCase(),
        name: relativeRecordName(challenge.domain, apex),
        value: String(challenge.value),
        host: stripDot(challenge.domain),
        purpose: 'ownership',
        required: true,
      })
    }
  }

  if (companion) records.push(routingRecord(companion, targets, { required: false, purpose: 'companion' }))
  return records
}

function inspectionMessage({ verified, dnsConfigured, ownershipVerified, domain }) {
  if (verified) return 'Your domain is live.'
  const routing = isSubdomain(domain) ? 'CNAME' : 'A'
  if (!dnsConfigured && !ownershipVerified) {
    return `Add the ${routing} and TXT records below at your domain registrar. We’ll keep checking.`
  }
  if (!ownershipVerified) {
    return 'Your domain points to us. Add the TXT record below so we can confirm it’s yours.'
  }
  return `We can’t see the ${routing} record yet. DNS changes usually show up within minutes, but can take up to 48 hours.`
}

/**
 * Ask Vercel where a domain stands.
 * @returns {Promise<{ onProject, ownershipVerified, dnsConfigured, verified, records, message, projectDomain }>}
 */
export async function inspectDomain(domain, { companion = null } = {}) {
  const [project, config] = await Promise.all([getProjectDomain(domain), getDomainConfig(domain)])
  const projectDomain = project.ok ? project.data : null
  const onProject = Boolean(projectDomain)
  const ownershipVerified = onProject && projectDomain.verified !== false
  const dnsConfigured = Boolean(config.ok && config.data && config.data.misconfigured === false)
  const verified = onProject && ownershipVerified && dnsConfigured

  return {
    onProject,
    ownershipVerified,
    dnsConfigured,
    verified,
    projectDomain,
    records: buildDnsRecords({ domain, companion, projectDomain, config: config.ok ? config.data : null }),
    message: inspectionMessage({ verified, dnsConfigured, ownershipVerified, domain }),
  }
}

/** Human message + HTTP status for a failed attach. */
function attachError(result) {
  switch (result.status) {
    case 409:
      return {
        status: 409,
        error: 'This domain is connected to another Vercel project or account. Remove it there first, then try again.',
        code: 'DOMAIN_IN_USE_ELSEWHERE',
      }
    case 402:
      return { status: 503, error: 'Bublr can’t take on more custom domains right now. Please contact support.', code: 'DOMAIN_LIMIT' }
    case 403:
      return { status: 409, error: 'Our host won’t accept this domain. It may be locked by another account.', code: 'DOMAIN_FORBIDDEN' }
    case 400:
      return { status: 400, error: `Our host couldn’t add this domain: ${vercelErrorMessage(result)}`, code: 'DOMAIN_INVALID' }
    case 429:
      return { status: 429, error: 'Too many domain changes right now. Please try again in a minute.', code: 'RATE_LIMITED' }
    default:
      return { status: 502, error: 'We couldn’t reach our host. Please try again in a moment.', code: 'HOST_UNAVAILABLE' }
  }
}

/**
 * Attach `domain` to the project. Already attached is fine (Vercel answers 400
 * for that); attached to another project/account is not (409).
 */
export async function attachDomain(domain) {
  const added = await addProjectDomain(domain)
  if (added.ok) return { ok: true, created: true }

  const existing = await getProjectDomain(domain)
  if (existing.ok) {
    // Left over as someone's www/apex redirect: make it a domain of its own
    if (existing.data?.redirect) {
      await removeProjectDomain(domain)
      const again = await addProjectDomain(domain)
      if (!again.ok) return { ok: false, ...attachError(again) }
      return { ok: true, created: true }
    }
    return { ok: true, created: false }
  }
  return { ok: false, ...attachError(added) }
}

/**
 * Point the www/apex companion at the writer's domain. Best effort: returns
 * the companion if it's ours to manage, otherwise null.
 */
export async function attachCompanion(primary, companion, userId) {
  if (!companion || companion === primary) return null
  if (!parseDomainInput(companion).domain) return null
  if (await domainClaimedByOther(companion, userId)) return null

  const added = await addProjectDomain(companion, { redirect: primary })
  if (added.ok) return companion
  const existing = await getProjectDomain(companion)
  if (existing.ok && stripDot(existing.data?.redirect) === primary) return companion
  return null
}

/**
 * Detach a domain from the project, unless it's one of ours or another writer
 * still uses it. Never throws.
 */
export async function detachDomain(domain, userId) {
  if (!domain || !parseDomainInput(domain).domain) return false
  try {
    if (await domainClaimedByOther(domain, userId)) return false
    const result = await removeProjectDomain(domain)
    if (!result.ok && result.status !== 404) {
      console.warn(`Could not detach ${domain} from Vercel:`, vercelErrorMessage(result))
      return false
    }
    return true
  } catch (error) {
    console.warn(`Could not detach ${domain}:`, error.message)
    return false
  }
}

/**
 * The writer's domain if it should be serving their pages right now: the
 * canonical address for their profile and posts.
 */
export function liveCustomDomain(userData) {
  const domain = userData?.customDomain
  if (!domain?.domain || domain.status !== 'verified') return null
  return hasActiveAccess(userData) ? domain.domain : null
}

/**
 * Which writer (if any) a request's Host belongs to.
 *
 *   { kind: 'platform' }                   bublr.life, previews, localhost
 *   { kind: 'live', user, viaCompanion }   serve the writer's pages
 *   { kind: 'inactive', user }             Pro lapsed: send readers to bublr.life
 *   { kind: 'unknown' }                    not a domain we know
 */
export async function resolveHost(rawHost) {
  const host = normalizeHost(rawHost)
  if (!host || isPlatformHost(host)) return { kind: 'platform', host }

  let snap = await users().where('customDomain.domain', '==', host).limit(1).get()
  let viaCompanion = false
  if (snap.empty) {
    snap = await users().where('customDomain.companion', '==', host).limit(1).get()
    viaCompanion = !snap.empty
  }
  if (snap.empty) return { kind: 'unknown', host }

  const doc = snap.docs[0]
  const user = { id: doc.id, ...doc.data() }
  const status = user.customDomain?.status
  // A request can only reach us on this host once Vercel and DNS agree, so a
  // domain still marked pending is already working: serve it.
  const live = (status === 'verified' || status === 'pending') && hasActiveAccess(user)
  return {
    kind: live ? 'live' : 'inactive',
    host,
    user,
    primary: user.customDomain.domain,
    viaCompanion,
  }
}

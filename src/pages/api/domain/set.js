import { firestore } from '../../../lib/firebase'
import { requireSelf } from '../../../lib/server-auth'
import { parseDomainInput, companionDomain } from '../../../lib/domain-utils'
import { hasActiveAccess } from '../../../lib/subscription'
import { isVercelConfigured } from '../../../lib/vercel'
import {
  attachCompanion,
  attachDomain,
  detachDomain,
  domainClaimedByOther,
  inspectDomain,
} from '../../../lib/custom-domains'

/**
 * Connect (or switch to) a custom domain.
 * body: { userId, domain }  — "domain" can be anything the writer pasted,
 * e.g. "https://Blog.Example.com/".
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireSelf(req, res, req.body?.userId)
  if (!userId) return

  const parsed = parseDomainInput(req.body?.domain)
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error, code: 'INVALID_DOMAIN' })
  }
  const domain = parsed.domain

  if (!isVercelConfigured()) {
    return res.status(503).json({
      error: 'Custom domains aren’t available right now. Please try again later.',
      code: 'DOMAINS_NOT_CONFIGURED',
    })
  }

  try {
    const ref = firestore.collection('users').doc(userId)
    const userDoc = await ref.get()
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userData = userDoc.data()
    if (!hasActiveAccess(userData)) {
      return res.status(403).json({ error: 'Custom domains are part of Bublr Pro.', code: 'PRO_REQUIRED' })
    }

    if (await domainClaimedByOther(domain, userId)) {
      return res.status(409).json({ error: 'Another Bublr writer is already using this domain.', code: 'DOMAIN_TAKEN' })
    }

    const attached = await attachDomain(domain)
    if (!attached.ok) {
      return res.status(attached.status).json({ error: attached.error, code: attached.code })
    }

    // Switching domains: let go of the old one (and its www/apex partner)
    const current = userData.customDomain || null
    const sameDomain = current?.domain === domain
    if (current?.domain && !sameDomain) {
      await detachDomain(current.domain, userId)
      if (current.companion && current.companion !== domain) await detachDomain(current.companion, userId)
    }

    const companion = sameDomain && current.companion
      ? current.companion
      : await attachCompanion(domain, companionDomain(domain), userId)

    const inspection = await inspectDomain(domain, { companion })
    const now = new Date().toISOString()
    const customDomain = {
      domain,
      companion: companion || null,
      status: inspection.verified ? 'verified' : 'pending',
      records: inspection.records,
      message: inspection.message,
      addedAt: sameDomain && current.addedAt ? current.addedAt : now,
      verifiedAt: inspection.verified ? (sameDomain && current.verifiedAt ? current.verifiedAt : now) : null,
      lastCheckedAt: now,
    }
    await ref.update({ customDomain })

    return res.status(200).json({
      success: true,
      domain,
      companion: customDomain.companion,
      status: customDomain.status,
      verified: inspection.verified,
      records: customDomain.records,
      message: inspection.verified
        ? 'Your domain is connected and live!'
        : 'Domain added. Add the DNS records below and we’ll take it from there.',
    })
  } catch (error) {
    console.error('Error setting domain:', error)
    return res.status(500).json({ error: 'Something went wrong connecting your domain. Please try again.' })
  }
}

import { firestore } from '../../../lib/firebase'
import { requireSelf } from '../../../lib/server-auth'
import { getProjectDomain, isVercelConfigured, verifyProjectDomain } from '../../../lib/vercel'
import { attachDomain, inspectDomain } from '../../../lib/custom-domains'
import { hasActiveAccess } from '../../../lib/subscription'

/**
 * Re-check the writer's domain with Vercel and store the result. The settings
 * page calls this on a timer while the domain is pending, and from the
 * "Check now" button.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireSelf(req, res, req.body?.userId)
  if (!userId) return

  try {
    const ref = firestore.collection('users').doc(userId)
    const userDoc = await ref.get()
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userData = userDoc.data()
    const current = userData.customDomain
    const domain = current?.domain
    if (!domain) {
      return res.status(400).json({ error: 'No domain configured' })
    }

    if (!isVercelConfigured()) {
      return res.status(503).json({ error: 'Custom domains aren’t available right now.', code: 'DOMAINS_NOT_CONFIGURED' })
    }

    // Removed from the Vercel dashboard by hand? Put it back.
    const onProject = await getProjectDomain(domain)
    if (!onProject.ok && onProject.status === 404) {
      if (!hasActiveAccess(userData)) {
        return res.status(403).json({ error: 'Custom domains are part of Bublr Pro.', code: 'PRO_REQUIRED' })
      }
      const attached = await attachDomain(domain)
      if (!attached.ok) {
        return res.status(attached.status).json({ error: attached.error, code: attached.code })
      }
    }

    // Nudge Vercel to look for the ownership TXT record now. A 400 just
    // means it isn't there yet; inspectDomain reports the details.
    await verifyProjectDomain(domain)

    const inspection = await inspectDomain(domain, { companion: current.companion || null })
    const now = new Date().toISOString()
    const status = inspection.verified ? 'verified' : 'pending'

    await ref.update({
      'customDomain.status': status,
      'customDomain.records': inspection.records,
      'customDomain.message': inspection.message,
      'customDomain.lastCheckedAt': now,
      'customDomain.verifiedAt': inspection.verified ? current.verifiedAt || now : null,
    })

    return res.status(200).json({
      success: true,
      verified: inspection.verified,
      status,
      ownershipVerified: inspection.ownershipVerified,
      dnsConfigured: inspection.dnsConfigured,
      records: inspection.records,
      message: inspection.message,
    })
  } catch (error) {
    console.error('Error verifying domain:', error)
    return res.status(500).json({ error: 'We couldn’t check your domain just now. Please try again.' })
  }
}

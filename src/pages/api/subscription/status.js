import { firestore } from '../../../lib/firebase'
import { requireSelf } from '../../../lib/server-auth'
import { refreshSubscription, reconcileAccess, statusPayload } from '../../../lib/billing'
import { hasActiveAccess } from '../../../lib/subscription'
import { isVercelConfigured } from '../../../lib/vercel'

// The writer's Pro plan and custom domain, for the dashboard
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireSelf(req, res, req.query?.userId)
  if (!userId) return

  res.setHeader('Cache-Control', 'no-store')

  try {
    const ref = firestore.collection('users').doc(userId)
    let doc = await ref.get()
    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }
    let userData = doc.data()

    // Catch up on anything a missed webhook would have told us
    const refreshed = await refreshSubscription(userId, userData)
    if (refreshed?.applied) {
      doc = await ref.get()
      userData = doc.data()
    }

    // A paid or grace period ran out quietly: switch the flag off (and email once)
    if (userData.hasCustomDomainAccess && !hasActiveAccess(userData)) {
      await reconcileAccess(userId)
      doc = await ref.get()
      userData = doc.data()
    }

    return res.status(200).json(statusPayload(userData, { domainsConfigured: isVercelConfigured() }))
  } catch (error) {
    console.error('Error fetching subscription status:', error)
    return res.status(500).json({ error: 'Failed to fetch subscription status' })
  }
}

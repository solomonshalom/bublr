import { firestore } from '../../../lib/firebase'
import { checkSubscriptionAccess } from '../../../lib/subscription'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { domain } = req.query

    if (!domain) {
      return res.status(400).json({ error: 'Missing domain parameter' })
    }

    // Look up user by custom domain
    const usersSnapshot = await firestore
      .collection('users')
      .where('customDomain.domain', '==', domain.toLowerCase())
      .where('customDomain.status', '==', 'verified')
      .limit(1)
      .get()

    if (usersSnapshot.empty) {
      return res.status(404).json({ error: 'Domain not found' })
    }

    const userDoc = usersSnapshot.docs[0]
    const userData = userDoc.data()

    // Check if user still has active subscription (with grace period support)
    const hasAccess = await checkSubscriptionAccess(userData, userDoc.id, true)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Custom domain subscription not active' })
    }

    return res.status(200).json({
      userId: userDoc.id,
      userName: userData.name,
      displayName: userData.displayName,
      customBranding: userData.customBranding || null,
    })
  } catch (error) {
    console.error('Error looking up domain:', error)
    return res.status(500).json({ error: 'Failed to look up domain' })
  }
}

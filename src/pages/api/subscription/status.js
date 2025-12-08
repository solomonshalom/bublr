import { firestore } from '../../../lib/firebase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' })
    }

    const userDoc = await firestore.collection('users').doc(userId).get()

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userData = userDoc.data()

    return res.status(200).json({
      hasSubscription: !!userData.subscription,
      hasCustomDomainAccess: userData.hasCustomDomainAccess || false,
      subscription: userData.subscription || null,
      customDomain: userData.customDomain || null,
      customBranding: userData.customBranding || null,
      newsletterTemplate: userData.newsletterTemplate || null,
    })
  } catch (error) {
    console.error('Error fetching subscription status:', error)
    return res.status(500).json({ error: 'Failed to fetch subscription status' })
  }
}

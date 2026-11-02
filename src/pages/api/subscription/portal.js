import polar from '../../../lib/polar'
import { firestore } from '../../../lib/firebase'
import { requireSelf } from '../../../lib/server-auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireSelf(req, res, req.body?.userId)
  if (!userId) return

  try {

    // Get user's subscription data
    const userDoc = await firestore.collection('users').doc(userId).get()

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userData = userDoc.data()
    const customerId = userData.subscription?.customerId

    if (!customerId) {
      return res.status(400).json({ error: 'No active subscription found' })
    }

    // Create customer portal session with Polar
    const session = await polar.customerSessions.create({
      customerId: customerId,
    })

    return res.status(200).json({
      portalUrl: session.customerPortalUrl,
    })
  } catch (error) {
    console.error('Error creating portal session:', error)
    return res.status(500).json({ error: 'Failed to create billing portal session' })
  }
}

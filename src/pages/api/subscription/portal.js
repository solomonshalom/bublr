import { firestore } from '../../../lib/firebase'
import { requireSelf } from '../../../lib/server-auth'
import { createCustomerPortalSession, isBillingConfigured } from '../../../lib/dodo'
import { requestOrigin } from '../../../lib/app-url'

// A link to Dodo's customer portal: payment method, invoices, cancellation
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireSelf(req, res, req.body?.userId)
  if (!userId) return

  if (!isBillingConfigured()) {
    return res.status(503).json({ error: 'Payments aren’t set up yet.', code: 'BILLING_NOT_CONFIGURED' })
  }

  try {
    const userDoc = await firestore.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }

    const subscription = userDoc.data().subscription
    if (subscription?.provider !== 'dodo' || !subscription.customerId) {
      return res.status(400).json({ error: 'There’s no billing account to manage yet.', code: 'NO_BILLING_ACCOUNT' })
    }

    const session = await createCustomerPortalSession(subscription.customerId, {
      returnUrl: `${requestOrigin(req)}/dashboard/settings/domain`,
    })
    if (!session?.link) throw new Error('Dodo Payments returned no portal link')

    return res.status(200).json({ portalUrl: session.link })
  } catch (error) {
    console.error('Error creating portal session:', error)
    return res.status(502).json({ error: 'We couldn’t open the billing portal. Please try again in a moment.' })
  }
}

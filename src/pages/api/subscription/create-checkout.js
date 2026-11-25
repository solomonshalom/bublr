import { createCheckout, customDomainProductId, shopProductId } from '../../../lib/creem'
import { requireSelf } from '../../../lib/server-auth'
import { firestore } from '../../../lib/firebase'
import { hasActiveAccess } from '../../../lib/subscription'

// Plans a writer can start a checkout for. "shop" is Pro + Shop: the custom
// domain plan plus a shop on their profile ($2 + $1 a month).
const PLANS = {
  pro: customDomainProductId,
  shop: shopProductId,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireSelf(req, res, req.body?.userId)
  if (!userId) return

  try {
    const { userEmail, userName } = req.body
    const plan = req.body?.plan || 'pro'

    if (!userEmail) {
      return res.status(400).json({ error: 'Missing userId or userEmail' })
    }

    if (!Object.prototype.hasOwnProperty.call(PLANS, plan)) {
      return res.status(400).json({ error: 'Unknown plan' })
    }

    // A second checkout would start a second subscription and bill twice.
    const snapshot = await firestore.collection('users').doc(userId).get()
    const current = snapshot.exists ? snapshot.data() : null
    if (
      current?.subscription?.id &&
      ['active', 'trialing'].includes(current.subscription.status) &&
      !current.subscription.cancelAtPeriodEnd &&
      hasActiveAccess(current)
    ) {
      return res.status(409).json({
        error: plan === 'shop'
          ? 'You already have a plan. Use “Add the shop” to switch it to Pro + Shop.'
          : 'You already have a plan.',
        code: 'ALREADY_SUBSCRIBED',
      })
    }

    const productId = PLANS[plan]()
    if (!productId) {
      return res.status(500).json({ error: `The ${plan} plan is not configured` })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life'
    // Create checkout session with Creem. The metadata comes back on the
    // subscription in every webhook: it's how the payment finds this writer.
    const checkout = await createCheckout({
      productId,
      email: userEmail,
      successUrl: plan === 'shop'
        ? `${baseUrl}/dashboard/settings/shop?subscription=success`
        : `${baseUrl}/dashboard?subscription=success`,
      metadata: {
        userId: userId,
        userName: userName || '',
        plan,
      },
    })

    return res.status(200).json({
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
    })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
}

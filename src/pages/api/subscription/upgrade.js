import { firestore } from '../../../lib/firebase'
import { CreemError, customDomainProductId, isShopProduct, shopProductId, upgradeSubscription } from '../../../lib/creem'
import { hasActiveAccess } from '../../../lib/subscription'
import { requireAuth } from '../../../lib/server-auth'

/**
 * Add the shop to a writer who already pays for Pro: their subscription moves
 * to the Pro + Shop plan and Creem charges the prorated difference now.
 * Starting a second checkout would bill them for two subscriptions.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireAuth(req, res)
  if (!userId) return

  const productId = shopProductId()
  if (!productId) {
    return res.status(500).json({ error: 'The shop plan is not configured' })
  }

  try {
    const snapshot = await firestore.collection('users').doc(userId).get()
    if (!snapshot.exists) return res.status(404).json({ error: 'User not found' })

    const user = snapshot.data()
    const subscription = user.subscription

    if (isShopProduct(subscription?.productId) && hasActiveAccess(user)) {
      return res.status(200).json({ upgraded: true, alreadyOnPlan: true })
    }

    // Only a live, renewing subscription can change plans. A cancelled one
    // runs out at the end of its period; the writer starts a new checkout.
    const renewing =
      subscription?.id &&
      ['active', 'trialing'].includes(subscription.status) &&
      !subscription.cancelAtPeriodEnd &&
      hasActiveAccess(user)

    if (!renewing) {
      return res.status(409).json({
        error: 'There is no renewing subscription to change. Start the Pro + Shop plan instead.',
        code: 'NO_RENEWING_SUBSCRIPTION',
      })
    }

    // Only the monthly Pro plan moves to the monthly Pro + Shop plan. A yearly
    // plan would be swapped for a monthly one mid-year.
    if (subscription.productId && subscription.productId !== customDomainProductId()) {
      return res.status(409).json({
        error: 'Your yearly plan can’t switch to the monthly shop plan. Start Pro + Shop when it ends, or contact support.',
        code: 'NOT_MONTHLY_PRO',
      })
    }

    await upgradeSubscription(subscription.id, productId)

    // Creem charges the difference and confirms with subscription.update; the
    // webhook opens the shop then, so a failed charge never opens it.
    return res.status(200).json({ upgraded: true, pending: true })
  } catch (error) {
    console.error('Error upgrading subscription:', error)
    if (error instanceof CreemError && error.status && error.status < 500) {
      return res.status(502).json({
        error: 'Creem could not change the plan. Please try again, or contact support.',
        traceId: error.traceId || null,
      })
    }
    return res.status(500).json({ error: 'Failed to change the plan' })
  }
}

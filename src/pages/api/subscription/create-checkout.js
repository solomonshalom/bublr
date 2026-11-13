import polar, { customDomainProductId, availablePlanIntervals } from '../../../lib/polar'
import { firestore } from '../../../lib/firebase'
import { requireSelf } from '../../../lib/server-auth'
import { DEFAULT_INTERVAL, isPlanInterval } from '../../../lib/plans'
import { hasLiveSubscription } from '../../../lib/subscription'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireSelf(req, res, req.body?.userId)
  if (!userId) return

  try {
    const { userEmail, userName } = req.body
    const interval = req.body.interval === undefined ? DEFAULT_INTERVAL : req.body.interval

    if (!userEmail) {
      return res.status(400).json({ error: 'Missing userId or userEmail' })
    }

    if (!isPlanInterval(interval)) {
      return res.status(400).json({ error: 'Choose monthly or yearly billing.', code: 'INVALID_INTERVAL' })
    }

    const productId = customDomainProductId(interval)
    if (!productId) {
      console.error(`Polar product for the ${interval}ly custom domain plan is not configured`)
      return res.status(500).json({
        error:
          interval === 'year'
            ? 'Yearly billing isn’t available right now. Please choose monthly.'
            : 'Subscriptions aren’t available right now. Please try again later.',
        code: 'PLAN_UNAVAILABLE',
      })
    }

    // A second checkout while one subscription is live would bill them twice.
    const userDoc = await firestore.collection('users').doc(userId).get()
    if (userDoc.exists && hasLiveSubscription(userDoc.data())) {
      return res.status(409).json({
        error: 'You already have an active subscription. Use Manage Billing to change your plan.',
        code: 'ALREADY_SUBSCRIBED',
      })
    }

    // The chosen plan goes first, so it's the one selected on Polar's checkout
    // page. The other stays available there in case they change their mind.
    const products = [
      productId,
      ...availablePlanIntervals()
        .filter(other => other !== interval)
        .map(customDomainProductId),
    ]

    // Create checkout session with Polar
    const checkout = await polar.checkouts.create({
      products,
      customerEmail: userEmail,
      successUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life'}/dashboard?subscription=success`,
      metadata: {
        userId: userId,
        userName: userName || '',
        interval,
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

import { firestore } from '../../../lib/firebase'
import { requireSelfClaims } from '../../../lib/server-auth'
import { createCheckoutSession, isBillingConfigured } from '../../../lib/dodo'
import { proProductIds } from '../../../lib/billing'
import { describeSubscription } from '../../../lib/subscription'
import { requestOrigin } from '../../../lib/app-url'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const validEmail = value => typeof value === 'string' && value.length <= 254 && EMAIL.test(value.trim())

// Starts a Dodo Payments checkout for Bublr Pro and answers with its URL.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const claims = await requireSelfClaims(req, res, req.body?.userId)
  if (!claims) return
  const userId = claims.uid

  if (!isBillingConfigured()) {
    return res.status(503).json({
      error: 'Payments aren’t set up yet. Please try again a little later.',
      code: 'BILLING_NOT_CONFIGURED',
    })
  }

  try {
    const ref = firestore.collection('users').doc(userId)
    const doc = await ref.get()
    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }
    const userData = doc.data()

    // Don't sell a second subscription to someone who already has one
    const { state } = describeSubscription(userData)
    if (state === 'active') {
      return res.status(409).json({ error: 'You already have Bublr Pro.', code: 'ALREADY_SUBSCRIBED' })
    }
    if (state === 'canceling' && userData.subscription?.provider === 'dodo' && userData.subscription?.status === 'active') {
      return res.status(409).json({
        error: 'Your subscription is still running. Resume it instead of paying again.',
        code: 'CAN_RESUME',
      })
    }
    if (state === 'past_due') {
      return res.status(409).json({
        error: 'Your last payment didn’t go through. Update your payment method to keep your subscription.',
        code: 'PAYMENT_ISSUE',
      })
    }

    // Prefer the address Google/Firebase verified; fall back to what they typed.
    // Without either, Dodo's checkout asks for one.
    const email = validEmail(claims.email)
      ? claims.email.trim()
      : validEmail(req.body?.userEmail)
        ? req.body.userEmail.trim()
        : null

    const page = `${requestOrigin(req)}/dashboard/settings/domain`
    const session = await createCheckoutSession({
      productId: proProductIds()[0],
      email,
      name: userData.displayName || userData.name || undefined,
      returnUrl: `${page}?checkout=success`,
      cancelUrl: `${page}?checkout=cancelled`,
      metadata: { userId, username: String(userData.name || '') },
    })

    if (!session?.checkout_url) {
      throw new Error('Dodo Payments returned no checkout URL')
    }

    // Lets us match the subscription to this writer even if Dodo doesn't
    // echo our metadata back
    await ref.update({
      pendingCheckout: {
        sessionId: session.session_id || null,
        email: email ? email.toLowerCase() : null,
        createdAt: new Date().toISOString(),
      },
    })

    return res.status(200).json({ checkoutUrl: session.checkout_url, sessionId: session.session_id || null })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return res.status(502).json({ error: 'We couldn’t start checkout. Please try again in a moment.' })
  }
}

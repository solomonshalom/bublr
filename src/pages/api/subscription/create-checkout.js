import { createCheckout, customDomainProductId } from '../../../lib/creem'
import { requireSelf } from '../../../lib/server-auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireSelf(req, res, req.body?.userId)
  if (!userId) return

  try {
    const { userEmail, userName } = req.body

    if (!userEmail) {
      return res.status(400).json({ error: 'Missing userId or userEmail' })
    }

    const productId = customDomainProductId()
    if (!productId) {
      return res.status(500).json({ error: 'CREEM_CUSTOM_DOMAIN_PRODUCT_ID not configured' })
    }

    // Create checkout session with Creem. The metadata comes back on the
    // subscription in every webhook: it's how the payment finds this writer.
    const checkout = await createCheckout({
      productId,
      email: userEmail,
      successUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life'}/dashboard?subscription=success`,
      metadata: {
        userId: userId,
        userName: userName || '',
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

import polar, { CUSTOM_DOMAIN_PRODUCT_ID } from '../../../lib/polar'
import { firestore } from '../../../lib/firebase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, userEmail, userName } = req.body

    if (!userId || !userEmail) {
      return res.status(400).json({ error: 'Missing userId or userEmail' })
    }

    if (!CUSTOM_DOMAIN_PRODUCT_ID) {
      return res.status(500).json({ error: 'POLAR_CUSTOM_DOMAIN_PRODUCT_ID not configured' })
    }

    // Create checkout session with Polar
    const checkout = await polar.checkouts.create({
      products: [CUSTOM_DOMAIN_PRODUCT_ID],
      customerEmail: userEmail,
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

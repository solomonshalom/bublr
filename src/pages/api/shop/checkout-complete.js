import { firestore } from '../../../lib/firebase'
import { orderTotal } from '../../../lib/shop'
import { retrieveProviderCheckout, PaymentProviderError } from '../../../lib/shop-payments'
import { MAX_ORDERS, buyerContext, findUserByName, openDelivery, paymentKey } from '../../../lib/shop-server'
import { trustedProducts } from '../../../lib/shop-trust'
import { hashId, seal } from '../../../lib/secret-box'
import { sendShopOrderEmail } from '../../../lib/resend'
import { clientIp, isRateLimited } from '../../../lib/rate-limit'

/**
 * Confirm a payment after the buyer comes back from Stripe/Creem (the product
 * page calls this with the id the provider put in the return URL). Asks the
 * writer's payment account whether it was paid, and how much, records the
 * order once, tells the writer, and hands a digital item's download link to
 * the buyer.
 *
 * The checkout id works like a receipt, so it is never stored where others
 * can read it: orders keep only its hash, and the id itself is sealed.
 *
 * GET ?user=<username>&checkout_id=<id>   (Stripe's session_id works too)
 */
const ID_RE = /^[A-Za-z0-9_-]{6,200}$/

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (isRateLimited(`shop-complete:${clientIp(req)}`, { max: 30, windowMs: 10 * 60 * 1000 })) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  const checkoutId = String(req.query.checkout_id || req.query.session_id || '')
  if (!ID_RE.test(checkoutId)) return res.status(400).json({ error: 'Missing checkout id' })

  try {
    const user = await findUserByName(String(req.query.user || ''))
    const apiKey = user ? paymentKey(user) : null
    const provider = user?.integrations?.payments?.provider
    if (!user || !apiKey) return res.status(404).json({ error: 'Order not found' })

    const checkout = await retrieveProviderCheckout(provider, { apiKey, checkoutId })
    const meta = checkout.metadata || {}
    if (meta.bublr_user !== user.id) return res.status(404).json({ error: 'Order not found' })
    if (!checkout.paid) {
      return res.status(202).json({ paid: false, message: 'Your payment is still being processed.' })
    }

    const product = trustedProducts(user).find(p => p && p.id === meta.bublr_product) || null

    // What was paid has to be what the item cost when the checkout started.
    const expected = Number(meta.bublr_amount ?? (product ? orderTotal(product) : NaN))
    const expectedCurrency = String(meta.bublr_currency || product?.currency || '').toLowerCase()
    const amountOk =
      Number.isFinite(expected) &&
      Number.isFinite(checkout.amount) &&
      checkout.amount >= expected &&
      (!expectedCurrency || String(checkout.currency || '').toLowerCase() === expectedCurrency)
    if (!amountOk) {
      console.error('Shop checkout-complete: amount mismatch for', user.id, meta.bublr_product, checkout.amount, checkout.currency)
      return res.status(409).json({
        paid: true,
        error: 'This payment doesn’t match the price, so it couldn’t be confirmed here. The writer has been paid; please contact them.',
      })
    }

    const orderId = meta.bublr_order || hashId(checkoutId).slice(0, 16)
    const delivery = product?.kind === 'digital' ? openDelivery(user.id, product) : null

    const buyer = {
      name: checkout.shipping?.name || checkout.name || meta.bublr_buyer || '',
      email: checkout.email || '',
      phone: checkout.shipping?.phone || '',
      address: checkout.shipping?.address || null,
    }

    const checkoutHash = hashId(checkoutId)
    const order = {
      id: orderId,
      provider,
      checkoutHash,
      mode: user.integrations.payments.mode || 'live',
      productId: meta.bublr_product || null,
      productTitle: product?.title || 'Deleted product',
      variant: meta.bublr_variant || '',
      kind: product?.kind || null,
      amount: checkout.amount,
      currency: checkout.currency || product?.currency || null,
      paidAt: Date.now(),
      // Buyer details and the checkout id (the writer's reference in Stripe/Creem).
      buyerSealed: seal(JSON.stringify({ ...buyer, checkoutId }), buyerContext(user.id, orderId)),
    }

    // Record it once: the buyer may reload the page, and two tabs may ask at
    // once. A failure here must not cost the buyer what they paid for.
    let isNew = false
    try {
      const userRef = firestore.collection('users').doc(user.id)
      isNew = await firestore.runTransaction(async transaction => {
        const snapshot = await transaction.get(userRef)
        const orders = Array.isArray(snapshot.data()?.shopOrders) ? snapshot.data().shopOrders : []
        if (orders.some(o => o?.id === orderId || o?.checkoutHash === checkoutHash)) return false
        transaction.update(userRef, { shopOrders: [order, ...orders].slice(0, MAX_ORDERS) })
        return true
      })
    } catch (error) {
      console.error('Shop checkout-complete: recording the order failed:', error)
    }

    if (isNew && user.email) {
      await sendShopOrderEmail({
        writerEmail: user.email,
        writerName: user.displayName || user.name,
        order: { ...order, checkoutId },
        buyer,
      }).catch(error => console.error('Shop order email failed:', error))
    }

    return res.status(200).json({ paid: true, orderId, kind: product?.kind || null, delivery })
  } catch (error) {
    if (error instanceof PaymentProviderError) {
      console.error('Shop checkout-complete: provider error', error.status, error.message)
      if (error.status === 404) return res.status(404).json({ error: 'Order not found' })
      return res.status(502).json({ error: 'We couldn’t confirm the payment yet. Refresh in a moment.' })
    }
    console.error('Shop checkout-complete failed:', error)
    return res.status(500).json({ error: 'We couldn’t confirm the payment yet. Refresh in a moment.' })
  }
}

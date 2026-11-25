import { firestore } from '../../../lib/firebase'
import {
  PROVIDERS,
  ShopValidationError,
  cleanBuyer,
  getAddressError,
  newId,
  orderTotal,
  resolveVariant,
} from '../../../lib/shop'
import { createCreemProduct, createProviderCheckout, PaymentProviderError } from '../../../lib/shop-payments'
import { findUserByName, paymentKey, productPath, shopOrigin } from '../../../lib/shop-server'
import { hasVerifiedShopAccess, signCreemProduct, trustedProducts, verifyCreemProduct } from '../../../lib/shop-trust'
import { getBearerToken, verifyIdToken } from '../../../lib/server-auth'
import { clientIp, isRateLimited } from '../../../lib/rate-limit'

/**
 * Start a checkout for one item in a writer's shop. Public: buyers aren't
 * signed in. The price comes from the saved (server-signed) product, never
 * from the request, and the checkout is created on the writer's own
 * Stripe/Creem account, so the money goes straight to them.
 *
 * POST { username, productId, colorId?, sizeId?, buyer }
 */
async function signedInUid(req) {
  const token = getBearerToken(req)
  if (!token) return null
  try {
    return (await verifyIdToken(token)).uid
  } catch (_) {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (isRateLimited(`shop-checkout:${clientIp(req)}`, { max: 12, windowMs: 10 * 60 * 1000 })) {
    return res.status(429).json({ error: 'Too many checkout attempts. Please wait a few minutes.' })
  }

  const { username, productId, colorId = null, sizeId = null, buyer: rawBuyer } = req.body || {}

  try {
    const user = await findUserByName(username)
    const product = user ? trustedProducts(user).find(p => p && p.id === productId) || null : null
    if (!user || !product || product.active === false) {
      return res.status(404).json({ error: 'This product is no longer available.' })
    }
    if (!hasVerifiedShopAccess(user)) {
      return res.status(403).json({ error: 'This shop is closed right now.' })
    }

    const payments = user.integrations?.payments
    const apiKey = paymentKey(user)
    const provider = payments?.provider
    if (!apiKey || !PROVIDERS[provider]) {
      return res.status(409).json({ error: 'This shop isn’t taking payments yet.' })
    }

    // With a test key, only the writer can buy (to try their shop out). A
    // visitor paying with a test card must never get a real download.
    if (payments.mode === 'test' && (await signedInUid(req)) !== user.id) {
      return res.status(403).json({ error: 'This shop is in test mode, so it isn’t selling yet.' })
    }

    const physical = product.kind === 'physical'
    if (physical && !PROVIDERS[provider].physical) {
      return res.status(409).json({ error: 'This item can’t be bought online right now.' })
    }
    if (!PROVIDERS[provider].currencies.includes(product.currency)) {
      return res.status(409).json({ error: 'This item can’t be bought online right now.' })
    }

    const variant = resolveVariant(product, { colorId, sizeId })
    const addressError = getAddressError(rawBuyer, { physical })
    if (addressError) throw new ShopValidationError(addressError)
    const buyer = cleanBuyer(rawBuyer, { physical })

    const orderId = newId(16)
    const { origin, onCustomDomain } = shopOrigin(req, user)
    const returnUrl = `${origin}${productPath(user, product.id, { onCustomDomain })}`

    // Shown in the writer's Stripe/Creem dashboard next to the payment. The
    // expected amount is checked against what was actually paid afterwards.
    const metadata = {
      bublr_user: user.id,
      bublr_product: product.id,
      bublr_order: orderId,
      bublr_variant: variant.title || '',
      bublr_amount: String(orderTotal(product)),
      bublr_currency: product.currency,
      bublr_buyer: `${buyer.first_name} ${buyer.last_name}`.trim().slice(0, 200),
    }

    let creemProductId = null
    if (provider === 'creem') {
      // Creem sells existing products only: reuse the one made for this item
      // at this price (if the server's signature on it holds), or create it.
      const cacheKey = `${product.id}_${product.price}_${product.currency}`
      creemProductId = verifyCreemProduct(user.id, cacheKey, payments.creemProducts?.[cacheKey])
      if (!creemProductId) {
        creemProductId = await createCreemProduct({ apiKey, product })
        await firestore.collection('users').doc(user.id).update({
          [`integrations.payments.creemProducts.${cacheKey}`]: {
            id: creemProductId,
            sig: signCreemProduct(user.id, cacheKey, creemProductId),
          },
        })
      }
    }

    const checkout = await createProviderCheckout(provider, {
      apiKey,
      product,
      variantTitle: variant.title,
      buyer,
      orderId,
      creemProductId,
      successUrl: returnUrl,
      cancelUrl: returnUrl,
      metadata,
    })

    return res.status(200).json({ checkoutUrl: checkout.url })
  } catch (error) {
    if (error instanceof ShopValidationError) return res.status(400).json({ error: error.message })
    if (error instanceof PaymentProviderError) {
      console.error('Shop checkout: provider error', error.status, error.code, error.message)
      return res.status(502).json({ error: 'The payment page couldn’t be opened. Please try again in a moment.' })
    }
    console.error('Shop checkout failed:', error)
    return res.status(500).json({ error: 'Checkout is unavailable right now' })
  }
}

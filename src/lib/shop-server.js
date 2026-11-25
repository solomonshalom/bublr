import { firestore } from './firebase'
import { requireAuth } from './server-auth'
import { open, seal } from './secret-box'
import { hasVerifiedShopAccess } from './shop-trust'

/**
 * Server-side helpers shared by the /api/shop routes.
 *
 * What lives on the writer's user document (all written by these routes, never
 * by the profile editor):
 *   shop.products           the catalogue (lib/shop.js)
 *   integrations.payments   { provider, keySealed, keyHint, mode, accountName,
 *                             connectedAt, creemProducts }
 *   shopOrders              paid orders, newest first; buyer details sealed
 */

export const MAX_ORDERS = 200

export const paymentKeyContext = uid => `${uid}:payments`
export const deliveryContext = (uid, productId) => `${uid}:shop-delivery:${productId}`
export const buyerContext = (uid, orderId) => `${uid}:shop-order:${orderId}`

export async function loadUser(uid) {
  const snapshot = await firestore.collection('users').doc(uid).get()
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null
}

export async function findUserByName(name) {
  if (typeof name !== 'string' || !name || name.length > 64) return null
  const snapshot = await firestore.collection('users').where('name', '==', name).limit(1).get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return { id: doc.id, ...doc.data() }
}

/**
 * The signed-in writer, if their shop plan is active. Answers 401/402 and
 * returns null otherwise.
 */
export async function requireShopOwner(req, res, { allowWithoutPlan = false } = {}) {
  const uid = await requireAuth(req, res)
  if (!uid) return null
  const user = await loadUser(uid)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return null
  }
  if (!allowWithoutPlan && !hasVerifiedShopAccess(user)) {
    res.status(402).json({
      error: 'The shop is part of the Pro + Shop plan ($3/month).',
      code: 'SHOP_PLAN_REQUIRED',
    })
    return null
  }
  return user
}

/** The writer's own payment API key, unsealed, or null if none is connected. */
export function paymentKey(user) {
  const payments = user?.integrations?.payments
  if (!payments?.keySealed) return null
  return open(payments.keySealed, paymentKeyContext(user.id))
}

/** What the dashboard may show about the connected payment account. */
export function paymentStatus(user) {
  const payments = user?.integrations?.payments
  if (!payments?.provider || !payments?.keySealed) return null
  return {
    provider: payments.provider,
    keyHint: payments.keyHint || null,
    mode: payments.mode || 'live',
    accountName: payments.accountName || null,
    connectedAt: payments.connectedAt || null,
  }
}

export function sealDelivery(uid, productId, url) {
  return seal(url, deliveryContext(uid, productId))
}

export function openDelivery(uid, product) {
  if (!product?.deliverySealed) return null
  return open(product.deliverySealed, deliveryContext(uid, product.id))
}

/** Where a buyer comes back to: the writer's verified custom domain if they shopped there, otherwise Bublr. */
export function shopOrigin(req, user) {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life').replace(/\/$/, '')
  const host = String(req.headers?.host || '').toLowerCase().split(':')[0]
  const domain = user?.customDomain?.status === 'verified' ? String(user.customDomain.domain || '').toLowerCase() : ''
  if (domain && host === domain) return { origin: `https://${domain}`, onCustomDomain: true }
  return { origin: base, onCustomDomain: false }
}

export function productPath(user, productId, { onCustomDomain = false } = {}) {
  return onCustomDomain ? `/shop/${productId}` : `/${user.name}/shop/${productId}`
}

export function errorStatus(error) {
  if (error?.name === 'ShopValidationError') return 400
  if (error?.name === 'PaymentProviderError') {
    if (error.status === 401) return 400
    return 502
  }
  return 500
}

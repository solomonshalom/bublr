import { canSeal, signValues, verifyValues } from './secret-box'
import { hasActiveShopAccess } from './subscription'

/**
 * User documents can be written without signing in (API routes use the
 * client SDK with no admin credentials, so the Firestore rules have to allow
 * it). So the server signs the two things the shop must be able to trust:
 *
 *   - `shopGrant`: the Pro + Shop plan, signed by the subscription webhook
 *     over the subscription it saw. Setting `hasShopAccess: true` by hand
 *     opens nothing.
 *   - `shop.sig`: the catalogue as last saved through /api/shop/products, so
 *     prices and photos edited straight in Firestore are ignored.
 */

const toMillis = value => {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value.toMillis === 'function') return value.toMillis()
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : ''
}

function grantValues(uid, subscription) {
  const s = subscription || {}
  return [uid, s.id, s.productId, toMillis(s.currentPeriodEnd), s.cancelAtPeriodEnd === true]
}

/** Signature for the webhook to store as `shopGrant`, or null if it can't sign. */
export function signShopGrant(uid, subscription) {
  if (!canSeal()) return null
  return signValues('shop-grant', grantValues(uid, subscription))
}

/** Server-side: the plan is active and the server granted it. */
export function hasVerifiedShopAccess(user) {
  if (!user?.id || !hasActiveShopAccess(user)) return false
  return verifyValues('shop-grant', grantValues(user.id, user.subscription), user.shopGrant)
}

// Same JSON whatever order Firestore hands the keys back in.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    if (typeof value.toMillis === 'function') return JSON.stringify(value.toMillis())
    return `{${Object.keys(value)
      .filter(k => value[k] !== undefined)
      .sort()
      .map(k => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value === undefined ? null : value)
}

export function signCatalogue(uid, products) {
  return signValues('shop-catalogue', [uid, canonical(products)])
}

/** The saved products, if they are the ones the server saved; otherwise none. */
export function trustedProducts(user) {
  const products = Array.isArray(user?.shop?.products) ? user.shop.products : []
  if (!products.length || !user?.id) return []
  return verifyValues('shop-catalogue', [user.id, canonical(products)], user.shop.sig) ? products : []
}

export function signCreemProduct(uid, cacheKey, creemProductId) {
  return signValues('creem-product', [uid, cacheKey, creemProductId])
}

export function verifyCreemProduct(uid, cacheKey, entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') return null
  return verifyValues('creem-product', [uid, cacheKey, entry.id], entry.sig) ? entry.id : null
}

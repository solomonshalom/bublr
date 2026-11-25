import { PROVIDERS, toPublicProduct } from './shop'
import { findUserByName } from './shop-server'
import { hasVerifiedShopAccess, trustedProducts } from './shop-trust'

/**
 * Props for a product page (bublr.life/<user>/shop/<id>, or <domain>/shop/<id>
 * on a writer's custom domain). Everything returned here is public.
 */
export async function loadProductPageProps({ username, productId, onCustomDomain = false }) {
  const user = await findUserByName(username)
  if (!user || !hasVerifiedShopAccess(user)) return null
  const product = trustedProducts(user).find(p => p && p.id === productId) || null
  if (!product || product.active === false) return null

  const payments = user.integrations?.payments
  const provider = PROVIDERS[payments?.provider]
  const paymentsReady = Boolean(
    payments?.keySealed &&
      provider &&
      provider.currencies.includes(product.currency) &&
      (product.kind !== 'physical' || provider.physical)
  )

  return {
    product: toPublicProduct(product),
    username: user.name,
    writer: {
      name: user.name,
      displayName: user.displayName || user.name,
      photo: user.photo || '',
    },
    paymentsReady,
    // A test key: only the writer can buy (the page lets them try it out).
    testMode: paymentsReady && payments.mode === 'test',
    ownerId: user.id,
    onCustomDomain,
  }
}

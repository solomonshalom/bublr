import { firestore } from '../../../lib/firebase'
import { isHttpsUrl, normalizeProducts, toPublicProduct, ShopValidationError } from '../../../lib/shop'
import { requireShopOwner, sealDelivery } from '../../../lib/shop-server'
import { canSeal } from '../../../lib/secret-box'
import { signCatalogue, trustedProducts } from '../../../lib/shop-trust'

/**
 * Save the writer's shop catalogue.
 *
 * PUT { products, deliveryLinks? }
 *   products       the full list, in display order (lib/shop.js checks it)
 *   deliveryLinks  { [productId]: "https://…" | "" } for digital products: the
 *                  link a buyer gets after paying. Sealed before it's stored,
 *                  because user documents are readable by anyone.
 */
export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await requireShopOwner(req, res)
  if (!user) return

  try {
    // Only what the server saved last time can carry sealed links forward.
    const previous = trustedProducts(user)
    const products = normalizeProducts(req.body?.products, previous)

    const links = req.body?.deliveryLinks && typeof req.body.deliveryLinks === 'object' ? req.body.deliveryLinks : {}
    for (const product of products) {
      if (!Object.prototype.hasOwnProperty.call(links, product.id)) continue
      const link = String(links[product.id] || '').trim()
      if (!link) {
        delete product.deliverySealed
        continue
      }
      if (product.kind !== 'digital') continue
      if (!isHttpsUrl(link)) throw new ShopValidationError(`The download link for “${product.title}” must start with https://`)
      if (!canSeal()) {
        return res.status(500).json({ error: 'Download links cannot be stored on this server yet (INTEGRATIONS_SECRET missing).' })
      }
      product.deliverySealed = sealDelivery(user.id, product.id, link)
    }

    if (!canSeal()) {
      return res.status(500).json({ error: 'The shop can’t be saved on this server yet (INTEGRATIONS_SECRET missing).' })
    }
    await firestore.collection('users').doc(user.id).update({
      'shop.products': products,
      'shop.sig': signCatalogue(user.id, products),
      'shop.updatedAt': Date.now(),
    })

    return res.status(200).json({ products: products.map(toPublicProduct) })
  } catch (error) {
    if (error instanceof ShopValidationError) return res.status(400).json({ error: error.message })
    console.error('Saving shop products failed:', error)
    return res.status(500).json({ error: 'Could not save your products' })
  }
}

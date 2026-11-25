import { open } from '../../../lib/secret-box'
import { buyerContext, requireShopOwner } from '../../../lib/shop-server'

/** The writer's paid orders, newest first, with buyer details unsealed. */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Past orders stay readable after the plan ends.
  const user = await requireShopOwner(req, res, { allowWithoutPlan: true })
  if (!user) return

  const orders = (Array.isArray(user.shopOrders) ? user.shopOrders : []).map(order => {
    const { buyerSealed, ...rest } = order || {}
    let buyer = null
    try {
      const plain = open(buyerSealed, buyerContext(user.id, rest.id))
      buyer = plain ? JSON.parse(plain) : null
    } catch (_) {
      buyer = null
    }
    const { checkoutId = null, ...details } = buyer || {}
    return { ...rest, checkoutId, buyer: buyer ? details : null }
  })

  return res.status(200).json({ orders })
}

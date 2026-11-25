import firebase, { firestore } from '../../../lib/firebase'
import { detectProvider, keyMode, verifyKey, PaymentProviderError } from '../../../lib/shop-payments'
import { paymentKeyContext, paymentStatus, requireShopOwner } from '../../../lib/shop-server'
import { canSeal, keyHint, seal } from '../../../lib/secret-box'

/**
 * Connect the writer's own payment account to their shop. Buyers pay that
 * account directly; Bublr only keeps the key (sealed) to start checkouts.
 *
 *   GET     what is connected (provider, key hint, live/test)
 *   POST    { apiKey }  a Stripe secret/restricted key or a Creem API key
 *   DELETE  disconnect
 */
export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Disconnecting and checking stay possible after the plan ends.
  const user = await requireShopOwner(req, res, { allowWithoutPlan: req.method !== 'POST' })
  if (!user) return
  const userRef = firestore.collection('users').doc(user.id)

  if (req.method === 'GET') {
    return res.status(200).json({ payments: paymentStatus(user) })
  }

  if (req.method === 'DELETE') {
    await userRef.update({ 'integrations.payments': firebase.firestore.FieldValue.delete() })
    return res.status(200).json({ payments: null })
  }

  const apiKey = String(req.body?.apiKey || '').trim()
  const provider = detectProvider(apiKey)
  if (!provider) {
    return res.status(400).json({
      error: 'That doesn’t look like a Stripe key (sk_… or rk_…) or a Creem API key (creem_…).',
    })
  }
  // A restricted key can only do what the shop needs. A full secret key could
  // also refund and pay out, so it isn't kept.
  if (provider === 'stripe' && !apiKey.startsWith('rk_')) {
    return res.status(400).json({
      error: 'Use a Stripe restricted key (rk_…) with “Checkout Sessions: Write”, not your secret key. Create one under Developers → API keys.',
    })
  }
  if (!canSeal()) {
    return res.status(500).json({ error: 'Payment keys cannot be stored on this server yet (INTEGRATIONS_SECRET missing).' })
  }

  try {
    const { accountName } = await verifyKey(provider, apiKey)
    const payments = {
      provider,
      keySealed: seal(apiKey, paymentKeyContext(user.id)),
      keyHint: keyHint(apiKey),
      mode: keyMode(apiKey),
      accountName: accountName || null,
      connectedAt: Date.now(),
      // Creem products made for this shop, keyed by item + price. A new key
      // may point at another store, so start fresh.
      creemProducts: {},
    }
    await userRef.update({ 'integrations.payments': payments })
    return res.status(200).json({ payments: paymentStatus({ id: user.id, integrations: { payments } }) })
  } catch (error) {
    if (error instanceof PaymentProviderError) {
      const status = error.status
      const message = status === 401
        ? `${provider === 'stripe' ? 'Stripe' : 'Creem'} didn’t accept that key.`
        : status === 403
          ? provider === 'stripe'
            ? 'That key can’t create checkouts. Give it “Checkout Sessions: Write” permission.'
            : 'That key is missing permissions. It needs Products and Checkouts (read and write).'
          : `Couldn’t reach ${provider === 'stripe' ? 'Stripe' : 'Creem'}: ${error.message}`
      return res.status(400).json({ error: message })
    }
    console.error('Connecting payments failed:', error)
    return res.status(500).json({ error: 'Could not connect the payment account' })
  }
}

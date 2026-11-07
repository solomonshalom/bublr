import { firestore } from '../../../lib/firebase'
import { requireSelf } from '../../../lib/server-auth'
import { DodoError, getSubscription, isBillingConfigured } from '../../../lib/dodo'
import { applyDodoSubscription, statusPayload, subscriptionBelongsTo } from '../../../lib/billing'
import { isVercelConfigured } from '../../../lib/vercel'

const SUBSCRIPTION_ID = /^[A-Za-z0-9_-]{1,100}$/

/**
 * Pull a subscription straight from Dodo. The dashboard calls this when the
 * writer comes back from checkout (Dodo adds ?subscription_id=... to the
 * return URL), so Pro switches on without waiting for the webhook.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireSelf(req, res, req.body?.userId)
  if (!userId) return

  if (!isBillingConfigured()) {
    return res.status(503).json({ error: 'Payments aren’t set up yet.', code: 'BILLING_NOT_CONFIGURED' })
  }

  try {
    const ref = firestore.collection('users').doc(userId)
    const doc = await ref.get()
    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }
    const userData = doc.data()

    const requested = req.body?.subscriptionId
    const stored = userData.subscription?.provider === 'dodo' ? userData.subscription.id : null
    const subscriptionId = requested || stored
    const domainsConfigured = isVercelConfigured()

    if (!subscriptionId) {
      return res.status(200).json(statusPayload(userData, { domainsConfigured }))
    }
    if (typeof subscriptionId !== 'string' || !SUBSCRIPTION_ID.test(subscriptionId)) {
      return res.status(400).json({ error: 'That subscription ID doesn’t look right.' })
    }

    let subscription
    try {
      subscription = await getSubscription(subscriptionId)
    } catch (error) {
      if (error instanceof DodoError && (error.status === 404 || error.status === 422)) {
        return res.status(404).json({ error: 'We couldn’t find that subscription.' })
      }
      throw error
    }

    if (!subscriptionBelongsTo(subscription, userId, userData)) {
      return res.status(403).json({ error: 'That subscription belongs to a different account.', code: 'FORBIDDEN' })
    }

    await applyDodoSubscription(subscription, { userId, source: 'sync' })
    const updated = await ref.get()
    return res.status(200).json(statusPayload(updated.data(), { domainsConfigured }))
  } catch (error) {
    console.error('Error syncing subscription:', error)
    return res.status(502).json({ error: 'We couldn’t reach the payment provider. Please try again in a moment.' })
  }
}

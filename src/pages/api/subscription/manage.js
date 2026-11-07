import { firestore } from '../../../lib/firebase'
import { requireSelf } from '../../../lib/server-auth'
import { getSubscription, isBillingConfigured, updateSubscription } from '../../../lib/dodo'
import { applyDodoSubscription, statusPayload } from '../../../lib/billing'
import { isVercelConfigured } from '../../../lib/vercel'

/**
 * Cancel at the end of the paid period, or undo that, without leaving Bublr.
 * body: { userId, action: 'cancel' | 'resume' }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireSelf(req, res, req.body?.userId)
  if (!userId) return

  const action = req.body?.action
  if (action !== 'cancel' && action !== 'resume') {
    return res.status(400).json({ error: 'Unknown action' })
  }

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
    const sub = userData.subscription
    const domainsConfigured = isVercelConfigured()

    if (sub?.provider !== 'dodo' || !sub.id) {
      return res.status(400).json({ error: 'There’s no subscription to change.', code: 'NO_SUBSCRIPTION' })
    }

    if (action === 'cancel') {
      if (sub.status !== 'active') {
        return res.status(409).json({ error: 'Only an active subscription can be cancelled.' })
      }
      if (sub.cancelAtPeriodEnd) {
        return res.status(200).json(statusPayload(userData, { domainsConfigured }))
      }
    } else if (sub.status !== 'active' || !sub.cancelAtPeriodEnd) {
      return res.status(409).json({
        error: sub.status === 'active'
          ? 'Your subscription isn’t set to cancel.'
          : 'This subscription has ended. Subscribe again to get Pro back.',
      })
    }

    const snapshotAt = Date.now()
    let updated = await updateSubscription(sub.id, { cancel_at_next_billing_date: action === 'cancel' })
    if (!updated?.subscription_id) updated = await getSubscription(sub.id)
    await applyDodoSubscription(updated, { userId, source: `manage:${action}`, snapshotAt })

    const fresh = await ref.get()
    return res.status(200).json(statusPayload(fresh.data(), { domainsConfigured }))
  } catch (error) {
    console.error(`Error trying to ${action} subscription:`, error)
    return res.status(502).json({ error: 'We couldn’t update your subscription. Please try again in a moment.' })
  }
}

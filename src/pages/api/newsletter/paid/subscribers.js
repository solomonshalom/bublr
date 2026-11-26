import { firestore } from '../../../../lib/firebase'
import { PaymentProviderError } from '../../../../lib/shop-payments'
import { requireShopOwner } from '../../../../lib/shop-server'
import {
  PaidNewsletterError,
  paidSubscribers,
  refreshPaidSubscriber,
  refreshStaleRecords,
  renewingPaidSubscribers,
  setPaidRenewal,
} from '../../../../lib/paid-newsletter'

/**
 * The writer's actions on their paid subscribers (Subscribers page and
 * Settings → Newsletter). Statuses are read from the user document; these
 * change them through the writer's own Stripe/Creem account.
 *
 * POST { action: 'refresh' }               ask the provider about everyone
 * POST { action: 'cancel', email }         stop one subscriber renewing
 * POST { action: 'cancel-all' }            stop everyone renewing (before
 *                                          deleting the account, for one)
 */
async function inBatches(items, size, fn) {
  const results = []
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  }
  return results
}

async function reload(uid) {
  const snapshot = await firestore.collection('users').doc(uid).get()
  return { id: snapshot.id, ...snapshot.data() }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  // Cancelling must stay possible after the plan ends.
  const user = await requireShopOwner(req, res, { allowWithoutPlan: true })
  if (!user) return

  const { action, email } = req.body || {}
  try {
    if (action === 'refresh') {
      const list = paidSubscribers(user)
      await inBatches(list, 5, ({ email: address }) => refreshPaidSubscriber(user, address).catch(() => null))
      return res.status(200).json({ checked: list.length })
    }

    if (action === 'cancel') {
      if (typeof email !== 'string' || !email.includes('@')) return res.status(400).json({ error: 'Which subscriber?' })
      const paid = await setPaidRenewal(user, email, { renew: false })
      return res.status(200).json({ cancelled: 1, status: paid.status, cancelAtPeriodEnd: paid.cancelAtPeriodEnd })
    }

    if (action === 'cancel-all') {
      // Anything that could still charge, after asking the provider about stale records
      const current = await refreshStaleRecords(user)
      const renewing = renewingPaidSubscribers(current, { strict: true })
      const outcomes = await inBatches(renewing, 3, async ({ email: address }) => {
        try {
          await setPaidRenewal(current, address, { renew: false })
          return true
        } catch (error) {
          console.error('Paid cancel-all: one failed:', error?.status, error?.message)
          return false
        }
      })
      const latest = await reload(user.id)
      const failed = outcomes.filter(ok => !ok).length
      return res.status(failed ? 207 : 200).json({
        cancelled: outcomes.length - failed,
        failed,
        stillRenewing: renewingPaidSubscribers(latest, { strict: true }).length,
      })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (error) {
    if (error instanceof PaidNewsletterError) return res.status(error.status).json({ error: error.message, code: error.code })
    if (error instanceof PaymentProviderError) {
      console.error('Paid subscribers: provider error', error.status, error.message)
      return res.status(502).json({ error: 'Your payment provider didn’t answer. Nothing was changed; please try again.' })
    }
    console.error('Paid subscribers action failed:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
}

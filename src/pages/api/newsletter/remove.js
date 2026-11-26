import { firestore } from '../../../lib/firebase'
import { requireAuth } from '../../../lib/server-auth'
import { subscriberEmail } from '../../../lib/subscribers'
import { PaidNewsletterError, couldStillCharge, findSubscriber, setPaidRenewal, verifiedPaid } from '../../../lib/paid-newsletter'

/**
 * The writer removes someone from their newsletter. A paid subscriber's
 * payment is stopped first; if it can't be, nothing is removed (the record is
 * the only way left to find and cancel it). Read and written in a
 * transaction, so nothing that changed meanwhile is overwritten.
 *
 * POST { email }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const uid = await requireAuth(req, res)
  if (!uid) return
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!email.includes('@')) return res.status(400).json({ error: 'Which subscriber?' })

  try {
    const ref = firestore.collection('users').doc(uid)
    const snapshot = await ref.get()
    if (!snapshot.exists) return res.status(404).json({ error: 'User not found' })
    const user = { id: uid, ...snapshot.data() }
    const paid = verifiedPaid(uid, findSubscriber(user, email))
    if (paid && couldStillCharge(paid)) {
      try {
        await setPaidRenewal(user, email, { renew: false })
      } catch (error) {
        const message = error instanceof PaidNewsletterError ? error.message : 'Your payment provider didn’t answer.'
        return res.status(409).json({ error: `${message} Their payment wasn’t stopped, so they weren’t removed.` })
      }
    }
    await firestore.runTransaction(async transaction => {
      const current = await transaction.get(ref)
      const list = Array.isArray(current.data()?.subscribers) ? current.data().subscribers : []
      transaction.update(ref, { subscribers: list.filter(sub => subscriberEmail(sub) !== email) })
    })
    return res.status(200).json({ removed: true, paymentStopped: Boolean(paid && couldStillCharge(paid)) })
  } catch (error) {
    console.error('Remove subscriber failed:', error)
    return res.status(500).json({ error: 'Could not remove the subscriber' })
  }
}

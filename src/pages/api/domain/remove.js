import firebase, { firestore } from '../../../lib/firebase'
import { requireSelf } from '../../../lib/server-auth'
import { isVercelConfigured } from '../../../lib/vercel'
import { detachDomain } from '../../../lib/custom-domains'

// Disconnect the writer's custom domain (and its www/apex partner)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireSelf(req, res, req.body?.userId)
  if (!userId) return

  try {
    const ref = firestore.collection('users').doc(userId)
    const userDoc = await ref.get()
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }

    const current = userDoc.data().customDomain
    if (!current?.domain) {
      return res.status(400).json({ error: 'No domain configured' })
    }

    // detachDomain refuses Bublr's own domains and ones another writer uses
    if (isVercelConfigured()) {
      await detachDomain(current.domain, userId)
      if (current.companion) await detachDomain(current.companion, userId)
    }

    await ref.update({ customDomain: firebase.firestore.FieldValue.delete() })

    return res.status(200).json({ success: true, message: 'Your domain has been disconnected.' })
  } catch (error) {
    console.error('Error removing domain:', error)
    return res.status(500).json({ error: 'Failed to remove domain' })
  }
}

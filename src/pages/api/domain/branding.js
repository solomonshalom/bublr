import { firestore } from '../../../lib/firebase'
import { requireSelf } from '../../../lib/server-auth'
import { hasActiveAccess } from '../../../lib/subscription'

// Pro: replace (or hide) the "Made with Bublr" footer line
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireSelf(req, res, req.body?.userId)
  if (!userId) return

  const { footerText = '' } = req.body || {}
  if (typeof footerText !== 'string') {
    return res.status(400).json({ error: 'Footer text must be text' })
  }
  const text = footerText.trim()
  if (text.length > 100) {
    return res.status(400).json({ error: 'Footer text must be 100 characters or less' })
  }

  try {
    const userDoc = await firestore.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (!hasActiveAccess(userDoc.data())) {
      return res.status(403).json({ error: 'Custom branding is part of Bublr Pro.', code: 'PRO_REQUIRED' })
    }

    await firestore.collection('users').doc(userId).update({
      customBranding: {
        footerText: text,
        updatedAt: new Date().toISOString(),
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Custom branding updated successfully.',
    })
  } catch (error) {
    console.error('Error updating branding:', error)
    return res.status(500).json({ error: 'Failed to update branding' })
  }
}

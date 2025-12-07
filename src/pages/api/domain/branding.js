import { firestore } from '../../../lib/firebase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, footerText } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' })
    }

    // Check if user has subscription access
    const userDoc = await firestore.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userData = userDoc.data()
    if (!userData.hasCustomDomainAccess) {
      return res.status(403).json({ error: 'Custom branding requires an active subscription' })
    }

    // Validate footer text (max 100 characters)
    if (footerText && footerText.length > 100) {
      return res.status(400).json({ error: 'Footer text must be 100 characters or less' })
    }

    // Update custom branding
    await firestore.collection('users').doc(userId).update({
      customBranding: {
        footerText: footerText || '',
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

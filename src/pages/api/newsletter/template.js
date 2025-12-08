import { firestore } from '../../../lib/firebase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, htmlTemplate } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' })
  }

  try {
    // Get user data to verify subscription
    const userDoc = await firestore.collection('users').doc(userId).get()

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userData = userDoc.data()

    // Check if user has custom domain access (paid subscription)
    if (!userData.hasCustomDomainAccess) {
      return res.status(403).json({ error: 'Custom newsletter templates require an active subscription' })
    }

    // Validate template if provided
    if (htmlTemplate !== null && htmlTemplate !== undefined) {
      // Check template length (max 50KB)
      if (htmlTemplate.length > 50000) {
        return res.status(400).json({ error: 'Template is too large (max 50KB)' })
      }

      // Validate that required placeholders are present if template is not empty
      if (htmlTemplate.trim()) {
        // Check for unsubscribe placeholder - this is mandatory for compliance
        if (!htmlTemplate.includes('{{unsubscribeUrl}}') && !htmlTemplate.includes('{{unsubscribe_url}}')) {
          return res.status(400).json({
            error: 'Template must include {{unsubscribeUrl}} placeholder for email compliance'
          })
        }
      }
    }

    // Update the user's newsletter template
    const updateData = {
      newsletterTemplate: htmlTemplate ? {
        html: htmlTemplate,
        updatedAt: new Date().toISOString(),
      } : null, // Allow clearing template by passing null/empty
    }

    await firestore.collection('users').doc(userId).update(updateData)

    return res.status(200).json({
      success: true,
      message: htmlTemplate ? 'Newsletter template saved successfully' : 'Newsletter template reset to default',
    })
  } catch (error) {
    console.error('Newsletter template update error:', error)
    return res.status(500).json({ error: 'Failed to update newsletter template' })
  }
}

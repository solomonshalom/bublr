import firebase, { firestore } from '../../../lib/firebase'

// Vercel API configuration
const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' })
    }

    // Get user's domain configuration
    const userDoc = await firestore.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userData = userDoc.data()
    const domain = userData.customDomain?.domain

    if (!domain) {
      return res.status(400).json({ error: 'No domain configured' })
    }

    // Remove domain from Vercel project
    if (VERCEL_TOKEN && VERCEL_PROJECT_ID) {
      try {
        const url = VERCEL_TEAM_ID
          ? `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}?teamId=${VERCEL_TEAM_ID}`
          : `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}`

        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${VERCEL_TOKEN}`,
          },
        })

        if (!response.ok && response.status !== 404) {
          const errorData = await response.json()
          console.error('Vercel API error:', errorData)
          // Don't fail the operation, just log the error
        }
      } catch (vercelError) {
        console.error('Vercel API error:', vercelError)
        // Don't fail the operation, just log the error
      }
    }

    // Remove domain configuration from user document
    await firestore.collection('users').doc(userId).update({
      customDomain: firebase.firestore.FieldValue.delete(),
    })

    return res.status(200).json({
      success: true,
      message: 'Domain has been removed successfully.',
    })
  } catch (error) {
    console.error('Error removing domain:', error)
    return res.status(500).json({ error: 'Failed to remove domain' })
  }
}

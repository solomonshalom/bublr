import { firestore } from '../../../lib/firebase'

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

    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      return res.status(500).json({ error: 'Vercel API not configured' })
    }

    // Call Vercel API to verify domain
    const url = VERCEL_TEAM_ID
      ? `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}/verify?teamId=${VERCEL_TEAM_ID}`
      : `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}/verify`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    const vercelResponse = await response.json()

    if (response.ok && vercelResponse.verified) {
      // Domain is verified! Update user document
      await firestore.collection('users').doc(userId).update({
        'customDomain.status': 'verified',
        'customDomain.verification': [],
        'customDomain.verifiedAt': new Date().toISOString(),
      })

      return res.status(200).json({
        success: true,
        verified: true,
        message: 'Domain has been verified successfully!',
      })
    }

    // Domain not yet verified, return verification requirements
    // Fetch current domain status to get updated verification info
    const statusUrl = VERCEL_TEAM_ID
      ? `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}?teamId=${VERCEL_TEAM_ID}`
      : `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}`

    const statusResponse = await fetch(statusUrl, {
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
      },
    })

    const domainStatus = await statusResponse.json()

    // Update verification info in database
    if (domainStatus.verification) {
      await firestore.collection('users').doc(userId).update({
        'customDomain.verification': domainStatus.verification,
      })
    }

    return res.status(200).json({
      success: true,
      verified: false,
      verification: domainStatus.verification || [],
      message: 'Domain is not yet verified. Please check your DNS configuration.',
    })
  } catch (error) {
    console.error('Error verifying domain:', error)
    return res.status(500).json({ error: 'Failed to verify domain' })
  }
}

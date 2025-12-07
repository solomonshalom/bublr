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
    const { userId, domain } = req.body

    if (!userId || !domain) {
      return res.status(400).json({ error: 'Missing userId or domain' })
    }

    // Validate domain format
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i
    if (!domainRegex.test(domain)) {
      return res.status(400).json({ error: 'Invalid domain format' })
    }

    // Check if user has subscription access
    const userDoc = await firestore.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userData = userDoc.data()
    if (!userData.hasCustomDomainAccess) {
      return res.status(403).json({ error: 'Custom domain feature requires an active subscription' })
    }

    // Check if domain is already in use by another user
    const existingDomainQuery = await firestore
      .collection('users')
      .where('customDomain.domain', '==', domain.toLowerCase())
      .limit(1)
      .get()

    if (!existingDomainQuery.empty && existingDomainQuery.docs[0].id !== userId) {
      return res.status(409).json({ error: 'Domain is already in use by another user' })
    }

    // Add domain to Vercel project (if configured)
    let vercelResponse = null
    let verification = []
    let isVerified = false

    if (VERCEL_TOKEN && VERCEL_PROJECT_ID) {
      try {
        const url = VERCEL_TEAM_ID
          ? `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains?teamId=${VERCEL_TEAM_ID}`
          : `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains`

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${VERCEL_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: domain.toLowerCase() }),
        })

        vercelResponse = await response.json()

        if (!response.ok && response.status !== 409) {
          // 409 means domain already exists on project, which is fine
          console.error('Vercel API error:', vercelResponse)
          return res.status(500).json({
            error: 'Failed to add domain to Vercel',
            details: vercelResponse.error?.message || 'Unknown error',
          })
        }

        // Get verification requirements from response
        verification = vercelResponse?.verification || []
        isVerified = vercelResponse?.verified || false
      } catch (vercelError) {
        console.error('Vercel API error:', vercelError)
        return res.status(500).json({ error: 'Failed to communicate with Vercel API' })
      }
    } else {
      console.warn('Vercel API not configured - domain added to database only')
    }

    // Save domain configuration to user document
    await firestore.collection('users').doc(userId).update({
      customDomain: {
        domain: domain.toLowerCase(),
        status: isVerified ? 'verified' : 'pending',
        verification: verification,
        addedAt: new Date().toISOString(),
        verifiedAt: isVerified ? new Date().toISOString() : null,
      },
    })

    return res.status(200).json({
      success: true,
      domain: domain.toLowerCase(),
      status: isVerified ? 'verified' : 'pending',
      verification: verification,
      message: isVerified
        ? 'Domain has been verified and is ready to use!'
        : 'Domain added. Please configure your DNS records to verify.',
    })
  } catch (error) {
    console.error('Error setting domain:', error)
    return res.status(500).json({ error: 'Failed to set domain' })
  }
}

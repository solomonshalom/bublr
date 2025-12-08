import { firestore } from '../../../lib/firebase'

// Vercel API configuration
const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID

// Helper to build Vercel API URLs with optional team ID
const buildVercelUrl = (path) => {
  const base = `https://api.vercel.com${path}`
  return VERCEL_TEAM_ID ? `${base}${path.includes('?') ? '&' : '?'}teamId=${VERCEL_TEAM_ID}` : base
}

// Fetch with no caching - CRITICAL for domain operations
// Next.js caches fetch by default which causes stale data
const fetchNoCache = async (url, options = {}) => {
  return fetch(url, {
    ...options,
    cache: 'no-store',
    headers: {
      ...options.headers,
      'Cache-Control': 'no-cache',
    },
  })
}

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

    const normalizedDomain = domain.toLowerCase()

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
      .where('customDomain.domain', '==', normalizedDomain)
      .limit(1)
      .get()

    if (!existingDomainQuery.empty && existingDomainQuery.docs[0].id !== userId) {
      return res.status(409).json({ error: 'Domain is already in use by another user' })
    }

    // Add domain to Vercel project (if configured)
    let verificationRequirements = []
    let isVerified = false

    if (VERCEL_TOKEN && VERCEL_PROJECT_ID) {
      const headers = {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      }

      try {
        // Step 1: Add domain to Vercel project
        const addUrl = buildVercelUrl(`/v10/projects/${VERCEL_PROJECT_ID}/domains`)
        const addResponse = await fetchNoCache(addUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: normalizedDomain }),
        })

        const addData = await addResponse.json()

        if (!addResponse.ok && addResponse.status !== 409) {
          // 409 means domain already exists on project, which is fine
          console.error('Vercel API error:', addData)
          return res.status(500).json({
            error: 'Failed to add domain to Vercel',
            details: addData.error?.message || 'Unknown error',
          })
        }

        // Step 2: Get domain status (includes verification requirements)
        const domainUrl = buildVercelUrl(`/v9/projects/${VERCEL_PROJECT_ID}/domains/${normalizedDomain}`)
        const domainResponse = await fetchNoCache(domainUrl, { headers })
        const domainData = await domainResponse.json()

        // Step 3: Check DNS configuration status
        const configUrl = buildVercelUrl(`/v6/domains/${normalizedDomain}/config`)
        const configResponse = await fetchNoCache(configUrl, { headers })
        const configData = await configResponse.json()

        // Determine if domain is fully verified
        const dnsConfigured = configData?.misconfigured === false

        // Check if TXT verification is required
        const pendingVerification = domainData?.verification || []
        const txtRequirements = pendingVerification.filter(v => v.type === 'TXT')
        const hasPendingTxtVerification = txtRequirements.length > 0

        // Ownership is verified if verified: true OR no TXT requirements
        const ownershipVerified = domainData?.verified === true || !hasPendingTxtVerification
        isVerified = ownershipVerified && dnsConfigured

        // Build verification requirements
        if (!ownershipVerified && hasPendingTxtVerification) {
          verificationRequirements.push(...txtRequirements)
        }

        // Add DNS config requirements if not properly configured
        if (!dnsConfigured) {
          const isSubdomain = normalizedDomain.split('.').length > 2

          if (isSubdomain) {
            const subdomain = normalizedDomain.split('.')[0]
            const recommendedCname = configData?.cnames?.[0]?.value || 'cname.vercel-dns.com'
            const hasCnameReq = verificationRequirements.some(v => v.type === 'CNAME')
            if (!hasCnameReq) {
              verificationRequirements.push({
                type: 'CNAME',
                domain: subdomain,
                value: recommendedCname,
              })
            }
          } else {
            const recommendedA = configData?.aValues?.[0] || '76.76.21.21'
            const hasAReq = verificationRequirements.some(v => v.type === 'A')
            if (!hasAReq) {
              verificationRequirements.push({
                type: 'A',
                domain: '@',
                value: recommendedA,
              })
            }
          }
        }
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
        domain: normalizedDomain,
        status: isVerified ? 'verified' : 'pending',
        verification: verificationRequirements,
        addedAt: new Date().toISOString(),
        verifiedAt: isVerified ? new Date().toISOString() : null,
      },
    })

    return res.status(200).json({
      success: true,
      domain: normalizedDomain,
      status: isVerified ? 'verified' : 'pending',
      verification: verificationRequirements,
      message: isVerified
        ? 'Domain has been verified and is ready to use!'
        : 'Domain added. Please configure your DNS records to verify.',
    })
  } catch (error) {
    console.error('Error setting domain:', error)
    return res.status(500).json({ error: 'Failed to set domain' })
  }
}

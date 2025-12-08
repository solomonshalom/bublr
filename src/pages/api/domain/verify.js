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

// Fetch with no caching - CRITICAL for domain verification
// Next.js caches fetch by default which causes stale verification data
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

    const headers = {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    }

    // Step 1: Trigger verification check via POST /verify
    // This tells Vercel to re-check DNS records NOW
    const verifyUrl = buildVercelUrl(`/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}/verify`)
    let verifyData = null
    let verifyError = null

    try {
      const verifyResponse = await fetchNoCache(verifyUrl, {
        method: 'POST',
        headers,
      })
      verifyData = await verifyResponse.json()

      if (!verifyResponse.ok) {
        verifyError = verifyData.error?.message || `HTTP ${verifyResponse.status}`
      }
    } catch (err) {
      verifyError = err.message
    }

    // Step 2: Get domain status from project
    // Use no-cache to get fresh data after verification trigger
    const domainUrl = buildVercelUrl(`/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}`)
    let domainData = null
    let domainError = null

    try {
      const domainResponse = await fetchNoCache(domainUrl, { headers })
      domainData = await domainResponse.json()

      if (!domainResponse.ok) {
        domainError = domainData.error?.message || `HTTP ${domainResponse.status}`
      }
    } catch (err) {
      domainError = err.message
    }

    // Step 3: Check DNS configuration status
    // This tells us if CNAME/A records are pointing to Vercel
    const configUrl = buildVercelUrl(`/v6/domains/${domain}/config`)
    let configData = null
    let configError = null

    try {
      const configResponse = await fetchNoCache(configUrl, { headers })
      configData = await configResponse.json()

      if (!configResponse.ok) {
        configError = configData.error?.message || `HTTP ${configResponse.status}`
      }
    } catch (err) {
      configError = err.message
    }

    // Determine verification status
    // DNS is configured if misconfigured is explicitly false
    const dnsConfigured = configData?.misconfigured === false

    // Get verification requirements from Vercel's response
    const verificationFromVerify = verifyData?.verification || []
    const verificationFromDomain = domainData?.verification || []
    const pendingVerification = verificationFromVerify.length > 0
      ? verificationFromVerify
      : verificationFromDomain

    // Check if TXT verification is required
    const txtRequirements = pendingVerification.filter(v => v.type === 'TXT')
    const hasPendingTxtVerification = txtRequirements.length > 0

    // Ownership verification status
    // verified: true means TXT ownership check passed (or not needed)
    const vercelSaysVerified = verifyData?.verified === true
    const domainSaysVerified = domainData?.verified === true

    // Domain is ownership-verified if:
    // 1. Either API endpoint returns verified: true, OR
    // 2. There are NO TXT verification requirements
    const ownershipVerified = vercelSaysVerified || domainSaysVerified || !hasPendingTxtVerification

    // Build the complete verification requirements array
    let verificationRequirements = []

    // Add TXT requirements if ownership not verified
    if (!ownershipVerified && hasPendingTxtVerification) {
      verificationRequirements.push(...txtRequirements)
    }

    // Add DNS config requirements if not properly configured
    if (!dnsConfigured) {
      const isSubdomain = domain.split('.').length > 2

      if (isSubdomain) {
        // CNAME for subdomains
        const subdomain = domain.split('.')[0]
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
        // A record for apex domains
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

    // Domain is FULLY verified when:
    // 1. Ownership is verified (TXT passed or not needed), AND
    // 2. DNS is configured (CNAME/A points to Vercel)
    const isFullyVerified = ownershipVerified && dnsConfigured

    if (isFullyVerified) {
      // Domain is fully verified! Update user document
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

    // Update verification info in database
    await firestore.collection('users').doc(userId).update({
      'customDomain.verification': verificationRequirements,
    })

    // Build helpful error message
    let message = 'Domain is not yet verified. '
    if (!ownershipVerified && !dnsConfigured) {
      message += 'Please configure both your DNS records (CNAME/A) and TXT verification record.'
    } else if (!ownershipVerified) {
      message += 'DNS records look good, but TXT ownership verification is pending. Please ensure your TXT record is set correctly at _vercel.' + domain
    } else if (!dnsConfigured) {
      message += 'TXT verification passed, but DNS records (CNAME/A) are not configured correctly.'
    }

    return res.status(200).json({
      success: true,
      verified: false,
      ownershipVerified,
      dnsConfigured,
      verification: verificationRequirements,
      message,
      debug: {
        verifyEndpoint: {
          verified: verifyData?.verified,
          verification: verifyData?.verification,
          error: verifyError,
        },
        domainEndpoint: {
          verified: domainData?.verified,
          verification: domainData?.verification,
          error: domainError,
        },
        configEndpoint: {
          misconfigured: configData?.misconfigured,
          configuredBy: configData?.configuredBy,
          error: configError,
        },
        analysis: {
          hasPendingTxtVerification,
          vercelSaysVerified,
          domainSaysVerified,
        },
      },
    })
  } catch (error) {
    console.error('Error verifying domain:', error)
    return res.status(500).json({ error: 'Failed to verify domain', details: error.message })
  }
}

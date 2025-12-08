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

    // Step 1: Call Vercel API to trigger verification check (for TXT ownership)
    const verifyUrl = buildVercelUrl(`/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}/verify`)
    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers,
    })
    const verifyData = await verifyResponse.json()

    // Step 2: Get domain status from project (includes verification requirements)
    const domainUrl = buildVercelUrl(`/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}`)
    const domainResponse = await fetch(domainUrl, { headers })
    const domainData = await domainResponse.json()

    // Step 3: Check DNS configuration status (CNAME/A records)
    // This is separate from ownership verification (TXT)
    const configUrl = buildVercelUrl(`/v6/domains/${domain}/config`)
    const configResponse = await fetch(configUrl, { headers })
    const configData = await configResponse.json()

    // Determine verification status
    // "verified" from Vercel = TXT ownership verification passed (or not required)
    // "misconfigured" from config = DNS (CNAME/A) not pointing correctly
    const dnsConfigured = configData.misconfigured === false

    // Check if TXT verification is actually required
    // Use verification array from POST /verify response (most up-to-date) or fall back to GET /domains
    const pendingVerification = verifyData.verification || domainData.verification || []
    const hasPendingTxtVerification = pendingVerification.some(v => v.type === 'TXT')

    // Ownership is verified if:
    // 1. Vercel explicitly says verified: true, OR
    // 2. No TXT verification requirements exist (domain doesn't need ownership verification)
    const ownershipVerified = verifyData?.verified === true ||
                              domainData?.verified === true ||
                              !hasPendingTxtVerification

    // Build verification requirements array
    let verificationRequirements = []

    // Add TXT verification requirements only if ownership not verified AND TXT is required
    if (!ownershipVerified && hasPendingTxtVerification) {
      verificationRequirements = pendingVerification.filter(v => v.type === 'TXT')
    }

    // Add DNS config requirements if not properly configured
    if (!dnsConfigured) {
      // Check if it's a subdomain or apex domain
      const isSubdomain = domain.split('.').length > 2

      if (isSubdomain) {
        // Add CNAME requirement for subdomains
        const subdomain = domain.split('.')[0]
        const hasCnameReq = verificationRequirements.some(v => v.type === 'CNAME')
        if (!hasCnameReq) {
          verificationRequirements.push({
            type: 'CNAME',
            domain: subdomain,
            value: configData.cnames?.[0] || 'cname.vercel-dns.com',
          })
        }
      } else {
        // Add A record requirement for apex domains
        const hasAReq = verificationRequirements.some(v => v.type === 'A')
        if (!hasAReq) {
          verificationRequirements.push({
            type: 'A',
            domain: '@',
            value: configData.aValues?.[0] || '76.76.21.21',
          })
        }
      }
    }

    // Domain is fully verified only when both ownership AND DNS are good
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
      message += 'DNS records look good, but TXT ownership verification is pending.'
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
        verifyResponse: {
          verified: verifyData?.verified,
          verification: verifyData?.verification,
          error: verifyData?.error,
        },
        domainResponse: {
          verified: domainData?.verified,
          verification: domainData?.verification,
        },
        configResponse: {
          misconfigured: configData?.misconfigured,
          configured: configData?.configured,
        },
        hasPendingTxtVerification,
      },
    })
  } catch (error) {
    console.error('Error verifying domain:', error)
    return res.status(500).json({ error: 'Failed to verify domain' })
  }
}

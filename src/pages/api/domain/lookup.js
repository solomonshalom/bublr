import { resolveHost } from '../../../lib/custom-domains'

// Which writer a custom domain belongs to (public; only what the page shows)
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { domain } = req.query
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'Missing domain parameter' })
  }

  try {
    const match = await resolveHost(domain)
    if (match.kind === 'unknown' || match.kind === 'platform') {
      return res.status(404).json({ error: 'Domain not found' })
    }
    if (match.kind === 'inactive') {
      return res.status(403).json({ error: 'Custom domain subscription not active', userName: match.user.name })
    }

    return res.status(200).json({
      userId: match.user.id,
      userName: match.user.name,
      displayName: match.user.displayName,
      domain: match.primary,
    })
  } catch (error) {
    console.error('Error looking up domain:', error)
    return res.status(500).json({ error: 'Failed to look up domain' })
  }
}

import { revokeApiKey } from '../../../lib/api-auth'
import { requireSelf } from '../../../lib/server-auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { keyId } = req.body || {}

  const userId = await requireSelf(req, res, req.body?.userId)
  if (!userId) return

  if (!keyId) {
    return res.status(400).json({ error: 'Missing keyId' })
  }

  try {
    const result = await revokeApiKey(userId, keyId)
    return res.status(200).json(result)
  } catch (error) {
    console.error('Revoke API key error:', error)

    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message })
    }

    if (error.message === 'API key not found') {
      return res.status(404).json({ error: error.message })
    }

    return res.status(500).json({ error: 'Failed to revoke API key' })
  }
}

import { listApiKeysForUser } from '../../../lib/api-auth'
import { requireSelf } from '../../../lib/server-auth'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireSelf(req, res, req.query?.userId)
  if (!userId) return

  try {
    const keys = await listApiKeysForUser(userId)
    return res.status(200).json({ keys })
  } catch (error) {
    console.error('List API keys error:', error)

    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message })
    }

    return res.status(500).json({ error: 'Failed to list API keys' })
  }
}

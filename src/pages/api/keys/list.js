import { listApiKeysForUser } from '../../../lib/api-auth'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' })
  }

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

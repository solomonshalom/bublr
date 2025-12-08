import { createApiKeyForUser } from '../../../lib/api-auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, name } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' })
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'API key name is required' })
  }

  if (name.length > 50) {
    return res.status(400).json({ error: 'API key name must be 50 characters or less' })
  }

  try {
    const result = await createApiKeyForUser(userId, name.trim())
    return res.status(200).json(result)
  } catch (error) {
    console.error('Create API key error:', error)

    if (error.message === 'Maximum of 5 API keys allowed per user') {
      return res.status(400).json({ error: error.message })
    }

    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message })
    }

    return res.status(500).json({ error: 'Failed to create API key' })
  }
}

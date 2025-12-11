import { authenticateApiKey, API_ERROR_CODES } from '../../../lib/api-auth'
import { firestore } from '../../../lib/firebase'

export default async function handler(req, res) {
  // Set CORS headers for API access
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Authenticate API key
  const auth = await authenticateApiKey(req.headers.authorization)

  if (!auth.success) {
    return res.status(401).json({
      error: auth.error,
      code: auth.code
    })
  }

  try {
    const userDoc = await firestore.collection('users').doc(auth.userId).get()

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    const userData = userDoc.data()

    // Return public profile data (exclude sensitive fields)
    const profile = {
      name: userData.name,
      displayName: userData.displayName,
      about: userData.about || '',
      photo: userData.photo || '',
      link: userData.link || '',
      socialLinks: userData.socialLinks || {},
      skills: userData.skills || [],
      skillsSectionTitle: userData.skillsSectionTitle || '',
      customSections: (userData.customSections || []).map(s => {
        if (s.type === 'blank') {
          return {
            type: 'blank',
            width: s.width || 'medium'
          }
        }
        return {
          type: s.type || 'regular',
          title: s.title,
          content: s.content
        }
      }),
      postsCount: (userData.posts || []).length,
      subscribersCount: (userData.subscribers || []).length
    }

    return res.status(200).json({ profile })
  } catch (error) {
    console.error('API v1 profile error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

import { firestore } from '../../../lib/firebase'

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'GET') {
    try {
      // Get query parameters
      const { limit = 10, offset = 0 } = req.query
      
      // Convert to numbers
      const limitNum = parseInt(limit)
      const offsetNum = parseInt(offset)
      
      // Query users with only limit (without offset)
      const query = firestore.collection('users')
        .limit(limitNum)
      
      // Execute query
      const snapshot = await query.get()
      
      // Format results
      const profiles = []
      snapshot.forEach(doc => {
        const userData = doc.data()
        
        // Only include necessary profile information, not the full posts array
        profiles.push({
          id: doc.id,
          name: userData.name,
          bio: userData.about || '',
          avatar: userData.photo || '',
          postCount: userData.posts ? userData.posts.length : 0
        })
      })
      
      // Apply offset manually if needed
      const paginatedProfiles = offsetNum > 0 ? profiles.slice(offsetNum) : profiles
      
      res.status(200).json({ 
        profiles: paginatedProfiles,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: profiles.length
        }
      })
    } catch (error) {
      console.error('Error fetching profiles:', error)
      res.status(500).json({ error: 'Failed to fetch profiles' })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
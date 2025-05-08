import firebase, { firestore } from '../../../lib/firebase'
import { getPostByID } from '../../../lib/db'

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'GET') {
    try {
      // Get query parameters
      const { limit = 10, offset = 0, published = true } = req.query
      
      // Convert to numbers
      const limitNum = parseInt(limit)
      const offsetNum = parseInt(offset)
      
      // Query posts
      let query = firestore.collection('posts')
      
      // Filter by published status if specified
      if (published === 'true') {
        query = query.where('published', '==', true)
      } else if (published === 'false') {
        query = query.where('published', '==', false)
      }
      
      // Order by last edited timestamp
      query = query.orderBy('lastEdited', 'desc')
      
      // Apply limit without offset for Firestore query
      query = query.limit(limitNum)
      
      // Execute query
      const snapshot = await query.get()
      
      // Format results
      const posts = []
      snapshot.forEach(doc => {
        const data = doc.data();
        posts.push({
          id: doc.id,
          ...data,
          lastEdited: data.lastEdited instanceof firebase.firestore.Timestamp ? 
            data.lastEdited.toDate().toISOString() : 
            (data.lastEdited || null)
        })
      })
      
      // Apply offset manually if needed
      const paginatedPosts = offsetNum > 0 ? posts.slice(offsetNum) : posts
      
      res.status(200).json({ 
        posts: paginatedPosts,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: posts.length
        }
      })
    } catch (error) {
      console.error('Error fetching posts:', error)
      res.status(500).json({ error: 'Failed to fetch posts' })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
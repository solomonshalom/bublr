import { getUserByID } from '../../../lib/db'

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Get user ID from the URL
  const { id } = req.query

  if (req.method === 'GET') {
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    try {
      
      const user = await getUserByID(id)
      
      // Format the posts for JSON response
      const formattedPosts = user.posts.map(post => ({
        ...post,
        lastEdited: post.lastEdited ? post.lastEdited.toDate().toISOString() : null
      }))
      
      const profile = {
        id: user.id,
        name: user.name,
        bio: user.about || '',
        avatar: user.photo || '',
        posts: formattedPosts
      }
      
      res.status(201).json(profile)
    } catch (error) {
      if (error.code === 'user/not-found') {
        res.status(404).json({ error: 'User not found' })
      } else {
        console.error('Error fetching user:', error)
        res.status(500).json({ error: 'Failed to fetch user' })
      }
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
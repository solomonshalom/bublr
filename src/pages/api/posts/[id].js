import { getPostByID } from '../../../lib/db'

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Get post ID from the URL
  const { id } = req.query

  if (req.method === 'GET') {
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: 'Invalid post ID' })
    }

    try {
      
      const post = await getPostByID(id)
      
      // Format the timestamp for JSON
      const formattedPost = {
        ...post,
        lastEdited: post.lastEdited ? post.lastEdited.toDate().toISOString() : null
      }
      
      res.status(201).json(formattedPost)
    } catch (error) {
      if (error.code === 'post/not-found') {
        res.status(404).json({ error: 'Post not found' })
      } else {
        console.error('Error fetching post:', error)
        res.status(500).json({ error: 'Failed to fetch post' })
      }
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
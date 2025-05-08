import { firestore } from '../../../lib/firebase'
import { createPostForUser, setPost, getPostByID } from '../../../lib/db'

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'POST') {
    try {
      // Check for API key in headers or query parameter
      let apiKey = req.headers.authorization?.split('Bearer ')[1]
      
      // If not in header, check query parameter
      if (!apiKey && req.query.apiKey) {
        apiKey = req.query.apiKey
      }
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key is required' })
      }
      
      // Verify API key (in a real implementation, you'd check against stored keys)
      // This is a simple implementation - you'd want to improve this in production
      const apiKeySnapshot = await firestore.collection('api_keys')
        .where('key', '==', apiKey)
        .limit(1)
        .get()
      
      if (apiKeySnapshot.empty) {
        return res.status(401).json({ error: 'Invalid API key' })
      }
      
      const apiKeyDoc = apiKeySnapshot.docs[0]
      const userId = apiKeyDoc.data().userId
      
      // Get post data from request body
      const { title, content, excerpt, tags, published = true, slug } = req.body
      
      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' })
      }
      
      // Create a new post
      const postId = await createPostForUser(userId)
      
      // Update the post with the provided data
      const postData = {
        title,
        content,
        excerpt: excerpt || '',
        tags: tags || [],
        published,
        lastEdited: firestore.Timestamp.now(),
        slug: slug || postId
      }
      
      await setPost(postId, postData)
      
      // Get the created post
      const post = await getPostByID(postId)
      
      res.status(201).json({
        id: post.id,
        ...post,
        lastEdited: post.lastEdited ? post.lastEdited.toDate().toISOString() : null
      })
    } catch (error) {
      console.error('Error publishing post:', error)
      res.status(500).json({ error: 'Failed to publish post' })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
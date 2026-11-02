import { firestore } from '../../../lib/firebase'
import { requireAuth } from '../../../lib/server-auth'
import { setPostPublished } from '../../../lib/publishing'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const uid = await requireAuth(req, res)
  if (!uid) return

  const { postId, publish } = req.body || {}

  if (!postId) {
    return res.status(400).json({ error: { message: 'Missing postId' } })
  }

  try {
    const postDoc = await firestore.collection('posts').doc(postId).get()

    if (!postDoc.exists) {
      return res.status(404).json({ error: { message: 'Post not found' } })
    }

    // Only the author can publish or unpublish their post
    if (postDoc.data().author !== uid) {
      return res.status(403).json({ error: { message: 'You can only publish your own posts' } })
    }

    // Moderation, followers and newsletter all happen in lib/publishing
    const result = await setPostPublished({ postId, publish: Boolean(publish) })
    return res.status(200).json(result)
  } catch (error) {
    console.error('Publish error:', error)
    return res.status(500).json({ error: { message: 'Internal server error' } })
  }
}

import { firestore } from '../../../lib/firebase'
import { requireAuth } from '../../../lib/server-auth'
import { notifySubscribersOfPost } from '../../../lib/newsletter-notify'

// Publishing sends the newsletter itself (lib/publishing). This route stays
// for re-sending by hand, and only the post's author may use it.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const uid = await requireAuth(req, res)
  if (!uid) return

  const { postId } = req.body || {}

  if (!postId) {
    return res.status(400).json({ error: 'Post ID is required' })
  }

  try {
    const postDoc = await firestore.collection('posts').doc(postId).get()

    if (!postDoc.exists) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (postDoc.data().author !== uid) {
      return res.status(403).json({ error: 'You can only notify subscribers about your own posts' })
    }

    const { status, body } = await notifySubscribersOfPost(postId)
    return res.status(status).json(body)
  } catch (error) {
    console.error('Newsletter notify error:', error)
    return res.status(500).json({ error: 'Failed to send notifications' })
  }
}

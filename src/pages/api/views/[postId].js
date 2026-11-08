import firebase, { firestore } from '../../../lib/firebase'
import { clientIp, isRateLimited } from '../../../lib/rate-limit'

export default async function handler(req, res) {
  const { postId } = req.query

  if (!postId) {
    return res.status(400).json({ error: 'Missing postId' })
  }

  try {
    const postRef = firestore.collection('posts').doc(postId)

    if (req.method === 'POST') {
      // One counted view per visitor per post per 30 minutes
      if (isRateLimited(`view:${clientIp(req)}:${postId}`, { max: 1, windowMs: 30 * 60 * 1000 })) {
        const current = await postRef.get()
        return res.status(200).json({ views: current.data()?.views || 0 })
      }

      // Increment view count
      await postRef.update({
        views: firebase.firestore.FieldValue.increment(1)
      })

      const postDoc = await postRef.get()
      const views = postDoc.data()?.views || 1

      return res.status(200).json({ views })
    } else if (req.method === 'GET') {
      // Get current view count
      const postDoc = await postRef.get()
      const views = postDoc.data()?.views || 0

      return res.status(200).json({ views })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Views API error:', error)
    return res.status(500).json({ error: 'Failed to update views' })
  }
}

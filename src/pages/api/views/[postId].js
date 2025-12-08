import firebase, { firestore } from '../../../lib/firebase'

export default async function handler(req, res) {
  const { postId } = req.query

  if (!postId) {
    return res.status(400).json({ error: 'Missing postId' })
  }

  try {
    const postRef = firestore.collection('posts').doc(postId)

    if (req.method === 'POST') {
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

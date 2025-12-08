import firebase, { firestore } from '../../../lib/firebase'

export default async function handler(req, res) {
  const { postId } = req.query

  if (!postId) {
    return res.status(400).json({ error: 'Missing postId' })
  }

  try {
    const postRef = firestore.collection('posts').doc(postId)
    const postDoc = await postRef.get()

    if (!postDoc.exists) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const postData = postDoc.data()

    if (req.method === 'POST') {
      // Toggle like - requires userId
      const { userId } = req.body

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' })
      }

      const likedBy = postData.likedBy || []
      const hasLiked = likedBy.includes(userId)

      if (hasLiked) {
        // Unlike - remove from array and decrement count
        await postRef.update({
          likes: firebase.firestore.FieldValue.increment(-1),
          likedBy: firebase.firestore.FieldValue.arrayRemove(userId),
        })

        const updatedDoc = await postRef.get()
        const updatedData = updatedDoc.data()

        return res.status(200).json({
          likes: updatedData.likes || 0,
          liked: false,
        })
      } else {
        // Like - add to array and increment count
        await postRef.update({
          likes: firebase.firestore.FieldValue.increment(1),
          likedBy: firebase.firestore.FieldValue.arrayUnion(userId),
        })

        const updatedDoc = await postRef.get()
        const updatedData = updatedDoc.data()

        // Create notification for post author (handled by client to include actor info)
        return res.status(200).json({
          likes: updatedData.likes || 0,
          liked: true,
          authorId: postData.author,
          postTitle: postData.title,
          postSlug: postData.slug,
        })
      }
    } else if (req.method === 'GET') {
      // Get current like count and whether user has liked
      const { userId } = req.query
      const likedBy = postData.likedBy || []
      const likes = postData.likes || 0
      const liked = userId ? likedBy.includes(userId) : false

      return res.status(200).json({ likes, liked })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Likes API error:', error)
    return res.status(500).json({ error: 'Failed to update likes' })
  }
}

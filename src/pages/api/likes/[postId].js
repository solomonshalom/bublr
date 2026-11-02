import firebase, { firestore } from '../../../lib/firebase'
import { requireSelf } from '../../../lib/server-auth'

// Tell the author someone liked their post. Actor details come from the
// liker's own profile, not from the request, so they can't be spoofed.
async function notifyAuthorOfLike({ postId, postData, actorId }) {
  if (!postData.author || postData.author === actorId) return
  try {
    const [actorDoc, authorDoc] = await Promise.all([
      firestore.collection('users').doc(actorId).get(),
      firestore.collection('users').doc(postData.author).get(),
    ])
    const actor = actorDoc.exists ? actorDoc.data() : {}
    const author = authorDoc.exists ? authorDoc.data() : {}
    await firestore.collection('notifications').add({
      recipientId: postData.author,
      type: 'like',
      actorId,
      actorName: actor.displayName || actor.name || 'Someone',
      actorUsername: actor.name || null,
      actorPhoto: actor.photo || '',
      postId,
      postTitle: postData.title || null,
      postSlug: postData.slug || null,
      postAuthorName: author.name || null,
      message: null,
      metadata: {},
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
  } catch (error) {
    console.error('Failed to create like notification:', error)
  }
}

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
      // Toggle like - the liker is whoever is signed in
      const userId = await requireSelf(req, res, req.body?.userId)
      if (!userId) return

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

        await notifyAuthorOfLike({ postId, postData, actorId: userId })

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

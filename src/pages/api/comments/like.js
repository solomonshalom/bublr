import firebase from '../../../lib/firebase'
import { firestore } from '../../../lib/firebase'

// Helper to create notification
async function createNotification(data) {
  try {
    await firestore.collection('notifications').add({
      ...data,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
  } catch (error) {
    console.error('Failed to create notification:', error)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } })
  }

  const { commentId, userId } = req.body

  if (!commentId || !userId) {
    return res.status(400).json({
      error: { message: 'Missing required fields', code: 'MISSING_FIELDS' },
    })
  }

  try {
    const commentRef = firestore.collection('comments').doc(commentId)
    const commentDoc = await commentRef.get()

    if (!commentDoc.exists) {
      return res.status(404).json({
        error: { message: 'Comment not found', code: 'NOT_FOUND' },
      })
    }

    const commentData = commentDoc.data()
    const likedBy = commentData.likedBy || []
    const alreadyLiked = likedBy.includes(userId)

    if (alreadyLiked) {
      // Unlike
      await commentRef.update({
        likeCount: firebase.firestore.FieldValue.increment(-1),
        likedBy: firebase.firestore.FieldValue.arrayRemove(userId),
      })
    } else {
      // Like
      await commentRef.update({
        likeCount: firebase.firestore.FieldValue.increment(1),
        likedBy: firebase.firestore.FieldValue.arrayUnion(userId),
      })

      // Create notification for comment author (only on like, not unlike)
      // Don't notify yourself
      if (commentData.authorId !== userId) {
        try {
          // Get liker's info
          const likerDoc = await firestore.collection('users').doc(userId).get()
          const likerData = likerDoc.exists ? likerDoc.data() : null

          // Get post info for notification link
          const postDoc = await firestore.collection('posts').doc(commentData.postId).get()
          const postData = postDoc.exists ? postDoc.data() : null

          let postAuthorName = ''
          if (postData) {
            const postAuthorDoc = await firestore.collection('users').doc(postData.author).get()
            postAuthorName = postAuthorDoc.exists ? postAuthorDoc.data()?.name || '' : ''
          }

          await createNotification({
            recipientId: commentData.authorId,
            type: 'like',
            actorId: userId,
            actorName: likerData?.displayName || 'Someone',
            actorPhoto: likerData?.photo || '',
            postId: commentData.postId,
            postTitle: postData?.title || 'a post',
            postSlug: postData?.slug || '',
            postAuthorName,
            commentId: commentId,
            message: commentData.content?.substring(0, 50) || '',
          })
        } catch (notifError) {
          console.error('Failed to create like notification:', notifError)
        }
      }
    }

    const updatedDoc = await commentRef.get()
    const updatedData = updatedDoc.data()

    return res.status(200).json({
      id: commentId,
      likeCount: updatedData.likeCount,
      likedBy: updatedData.likedBy,
    })
  } catch (error) {
    console.error('Like error:', error.message, error.code)
    return res.status(500).json({
      error: { message: 'Failed to like comment', code: 'INTERNAL_ERROR', details: error.message },
    })
  }
}

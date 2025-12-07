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
  const { method } = req

  if (method === 'GET') {
    const { postId } = req.query

    if (!postId) {
      return res.status(400).json({
        error: { message: 'Missing postId parameter', code: 'MISSING_POST_ID' },
      })
    }

    try {
      // Query without orderBy to avoid needing a composite index
      // We'll sort in JavaScript instead
      const commentsRef = firestore
        .collection('comments')
        .where('postId', '==', postId)

      const snapshot = await commentsRef.get()
      const comments = []

      snapshot.forEach((doc) => {
        const data = doc.data()
        comments.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.getTime() || Date.now(),
        })
      })

      // Sort by createdAt descending (newest first)
      comments.sort((a, b) => b.createdAt - a.createdAt)

      return res.status(200).json({ comments })
    } catch (error) {
      console.error('Get comments error:', error.message, error.code)
      return res.status(500).json({
        error: { message: 'Failed to get comments', code: 'INTERNAL_ERROR', details: error.message },
      })
    }
  }

  if (method === 'POST') {
    const { postId, authorId, authorName, authorPhoto, content, parentId } = req.body

    if (!postId || !authorId || !content) {
      return res.status(400).json({
        error: { message: 'Missing required fields', code: 'MISSING_FIELDS' },
      })
    }

    if (content.length < 1) {
      return res.status(400).json({
        error: { message: 'Comment cannot be empty', code: 'TOO_SHORT' },
      })
    }

    if (content.length > 1000) {
      return res.status(400).json({
        error: { message: 'Comment must be less than 1000 characters', code: 'TOO_LONG' },
      })
    }

    try {
      const commentData = {
        postId,
        authorId,
        authorName: authorName || 'Anonymous',
        authorPhoto: authorPhoto || '',
        content,
        parentId: parentId || null, // For threaded replies
        likeCount: 0,
        likedBy: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }

      const docRef = await firestore.collection('comments').add(commentData)

      // Create notification for the post author or parent comment author
      try {
        // Get the post to find its author
        const postDoc = await firestore.collection('posts').doc(postId).get()
        if (postDoc.exists) {
          const postData = postDoc.data()
          const postAuthorId = postData.author

          // Get post author's username for the notification link
          const postAuthorDoc = await firestore.collection('users').doc(postAuthorId).get()
          const postAuthorData = postAuthorDoc.exists ? postAuthorDoc.data() : null

          if (parentId) {
            // This is a reply - notify the parent comment author
            const parentCommentDoc = await firestore.collection('comments').doc(parentId).get()
            if (parentCommentDoc.exists) {
              const parentCommentData = parentCommentDoc.data()
              // Don't notify yourself
              if (parentCommentData.authorId !== authorId) {
                await createNotification({
                  recipientId: parentCommentData.authorId,
                  type: 'reply',
                  actorId: authorId,
                  actorName: authorName || 'Someone',
                  actorPhoto: authorPhoto || '',
                  postId,
                  postTitle: postData.title || 'a post',
                  postSlug: postData.slug,
                  postAuthorName: postAuthorData?.name || '',
                  commentId: docRef.id,
                  message: content.substring(0, 100),
                })
              }
            }
          } else {
            // This is a top-level comment - notify post author
            // Don't notify yourself
            if (postAuthorId !== authorId) {
              await createNotification({
                recipientId: postAuthorId,
                type: 'comment',
                actorId: authorId,
                actorName: authorName || 'Someone',
                actorPhoto: authorPhoto || '',
                postId,
                postTitle: postData.title || 'your post',
                postSlug: postData.slug,
                postAuthorName: postAuthorData?.name || '',
                commentId: docRef.id,
                message: content.substring(0, 100),
              })
            }
          }
        }
      } catch (notifError) {
        // Don't fail the comment creation if notification fails
        console.error('Failed to create comment notification:', notifError)
      }

      return res.status(201).json({
        id: docRef.id,
        ...commentData,
        createdAt: Date.now(),
      })
    } catch (error) {
      console.error('Create comment error:', error.message, error.code)
      return res.status(500).json({
        error: { message: 'Failed to create comment', code: 'INTERNAL_ERROR', details: error.message },
      })
    }
  }

  if (method === 'DELETE') {
    const { commentId, authorId } = req.body

    if (!commentId || !authorId) {
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

      // Only allow author to delete their own comment
      if (commentDoc.data().authorId !== authorId) {
        return res.status(403).json({
          error: { message: 'Not authorized to delete this comment', code: 'FORBIDDEN' },
        })
      }

      await commentRef.delete()

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Delete comment error:', error.message, error.code)
      return res.status(500).json({
        error: { message: 'Failed to delete comment', code: 'INTERNAL_ERROR', details: error.message },
      })
    }
  }

  return res.status(405).json({ error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } })
}

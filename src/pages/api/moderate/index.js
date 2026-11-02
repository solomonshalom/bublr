import { firestore } from '../../../lib/firebase'
import { moderateContent } from '../../../lib/publishing'
import { hasSharedSecret } from '../../../lib/server-auth'

// Same moderation as publishing (lib/publishing.js)

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  // Verify secret key (set this in your environment variables)
  // Fails closed when MODERATION_SECRET_KEY isn't set
  if (!hasSharedSecret(req, process.env.MODERATION_SECRET_KEY)) {
    return res.status(401).json({ error: { message: 'Unauthorized' } })
  }

  const { postId } = req.body

  if (!postId) {
    return res.status(400).json({ error: { message: 'Missing postId' } })
  }

  try {
    // Get the post
    const postRef = firestore.collection('posts').doc(postId)
    const postDoc = await postRef.get()

    if (!postDoc.exists) {
      return res.status(404).json({ error: { message: 'Post not found' } })
    }

    const post = postDoc.data()

    // Only moderate published posts
    if (!post.published) {
      return res.status(200).json({
        message: 'Post is not published, skipping moderation',
        moderated: false
      })
    }

    // Moderate the content
    const result = await moderateContent(post.title, post.content)

    if (result.shouldUnpublish) {
      // Unpublish the post (don't delete)
      await postRef.update({
        published: false,
        moderationReason: result.reason,
        moderationCategory: result.category,
        moderatedAt: new Date().toISOString(),
      })

      return res.status(200).json({
        message: 'Post unpublished due to content policy violation',
        moderated: true,
        reason: result.reason,
        category: result.category,
      })
    }

    return res.status(200).json({
      message: 'Post passed moderation',
      moderated: false,
      category: result.category,
    })
  } catch (error) {
    console.error('Moderation error:', error)
    return res.status(500).json({ error: { message: 'Internal server error' } })
  }
}

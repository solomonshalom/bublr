import { firestore } from '../../../lib/firebase'
import { moderateContent, emailWriterAboutTakedown } from '../../../lib/publishing'
import { hasSharedSecret } from '../../../lib/server-auth'

// Same moderation as publishing (lib/publishing.js)

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  // Verify secret key
  // Fails closed when MODERATION_SECRET_KEY isn't set
  if (!hasSharedSecret(req, process.env.MODERATION_SECRET_KEY)) {
    return res.status(401).json({ error: { message: 'Unauthorized' } })
  }

  const { limit = 10 } = req.body

  try {
    // Get published posts that haven't been moderated yet
    const postsSnapshot = await firestore
      .collection('posts')
      .where('published', '==', true)
      .limit(limit)
      .get()

    const results = {
      processed: 0,
      unpublished: 0,
      passed: 0,
      errors: 0,
      details: [],
    }

    for (const doc of postsSnapshot.docs) {
      const post = doc.data()
      const postId = doc.id

      // Skip already moderated posts
      if (post.moderatedAt) {
        continue
      }

      try {
        const result = await moderateContent(post.title, post.content)
        results.processed++

        if (result.shouldUnpublish) {
          // Unpublish the post
          await firestore.collection('posts').doc(postId).update({
            published: false,
            moderationReason: result.reason,
            moderationCategory: result.category,
            moderatedAt: new Date().toISOString(),
          })

          // Tell the writer why their post came down
          const email = await emailWriterAboutTakedown({
            authorId: post.author,
            postTitles: [post.title],
            reason: result.reason,
          })

          results.unpublished++
          results.details.push({
            postId,
            action: 'unpublished',
            reason: result.reason,
            category: result.category,
            writerEmailed: Boolean(email.success),
          })
        } else {
          // Mark as moderated (passed)
          await firestore.collection('posts').doc(postId).update({
            moderatedAt: new Date().toISOString(),
            moderationCategory: 'none',
          })

          results.passed++
          results.details.push({
            postId,
            action: 'passed',
          })
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Error moderating post ${postId}:`, error)
        results.errors++
        results.details.push({
          postId,
          action: 'error',
          error: error.message,
        })
      }
    }

    return res.status(200).json({
      message: 'Batch moderation completed',
      results,
    })
  } catch (error) {
    console.error('Batch moderation error:', error)
    return res.status(500).json({ error: { message: 'Internal server error' } })
  }
}

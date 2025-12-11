import { firestore } from '../../../lib/firebase'
import { sendBatchNotifications } from '../../../lib/resend'
import { hasActiveAccess } from '../../../lib/subscription'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { postId, authorId } = req.body

  if (!postId || !authorId) {
    return res.status(400).json({ error: 'Post ID and Author ID are required' })
  }

  try {
    // Get the post data
    const postDoc = await firestore.collection('posts').doc(postId).get()

    if (!postDoc.exists) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const post = postDoc.data()

    // Only send notifications for published posts
    if (!post.published) {
      return res.status(400).json({ error: 'Post is not published' })
    }

    // Get the author data
    const authorDoc = await firestore.collection('users').doc(authorId).get()

    if (!authorDoc.exists) {
      return res.status(404).json({ error: 'Author not found' })
    }

    const author = authorDoc.data()

    // Check if there are subscribers
    const subscribers = author.subscribers || []

    if (subscribers.length === 0) {
      return res.status(200).json({
        success: true,
        sent: 0,
        message: 'No subscribers to notify'
      })
    }

    // Get custom newsletter template if user has one and has active subscription (with grace period support)
    const customTemplate = (hasActiveAccess(author) && author.newsletterTemplate?.html)
      ? author.newsletterTemplate.html
      : null

    // Send batch notifications
    const result = await sendBatchNotifications({
      subscribers,
      authorName: author.displayName || author.name,
      authorPhoto: author.photo,
      authorUsername: author.name,
      postTitle: post.title?.replace(/<[^>]*>/g, '') || 'New Post',
      postExcerpt: post.excerpt,
      postContent: post.content,
      postSlug: post.slug,
      postColor: post.dotColor,
      customTemplate,
    })

    // Log notification result
    console.log(`Newsletter notification for post ${postId}: sent ${result.sent}/${result.total} emails`)

    return res.status(200).json({
      success: result.success,
      sent: result.sent,
      total: result.total,
      message: `Sent ${result.sent} notification${result.sent !== 1 ? 's' : ''} to subscribers`
    })
  } catch (error) {
    console.error('Newsletter notify error:', error)
    return res.status(500).json({ error: 'Failed to send notifications' })
  }
}

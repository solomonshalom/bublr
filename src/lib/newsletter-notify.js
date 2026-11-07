import { firestore } from './firebase'
import { sendBatchNotifications } from './resend'
import { hasActiveAccess } from './subscription'
import { liveCustomDomain } from './custom-domains'
import { slugServedOnCustomDomain } from './domain-utils'

/**
 * Email a writer's newsletter subscribers about one of their posts — at most
 * once per post. Callers check who is asking (the post's author); this only
 * does the sending.
 *
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function notifySubscribersOfPost(postId) {
  const postRef = firestore.collection('posts').doc(postId)
  const postDoc = await postRef.get()
  if (!postDoc.exists) return { status: 404, body: { error: 'Post not found' } }

  const post = postDoc.data()
  if (!post.published) return { status: 400, body: { error: 'Post is not published' } }

  // Each post is emailed to subscribers at most once, so unpublishing to fix a
  // typo and publishing again doesn't email everyone twice
  if (post.newsletterSentAt) {
    return {
      status: 200,
      body: { success: true, sent: 0, message: 'Subscribers were already notified about this post' },
    }
  }

  const authorDoc = await firestore.collection('users').doc(post.author).get()
  if (!authorDoc.exists) return { status: 404, body: { error: 'Author not found' } }

  const author = authorDoc.data()
  const subscribers = author.subscribers || []
  if (subscribers.length === 0) {
    return { status: 200, body: { success: true, sent: 0, message: 'No subscribers to notify' } }
  }

  // Custom template only while the writer's subscription is active (with grace period)
  const customTemplate =
    hasActiveAccess(author) && author.newsletterTemplate?.html ? author.newsletterTemplate.html : null

  // Send readers to the writer's own domain once it's live
  const domain = slugServedOnCustomDomain(post.slug) ? liveCustomDomain(author) : null

  const result = await sendBatchNotifications({
    subscribers,
    postUrl: domain ? `https://${domain}/${encodeURIComponent(post.slug)}` : undefined,
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

  if (result.sent > 0) {
    try {
      await postRef.update({ newsletterSentAt: new Date().toISOString() })
    } catch (markError) {
      console.error('Could not mark newsletter as sent:', markError)
    }
  }

  console.log(`Newsletter notification for post ${postId}: sent ${result.sent}/${result.total} emails`)

  return {
    status: 200,
    body: {
      success: result.success,
      sent: result.sent,
      total: result.total,
      message: `Sent ${result.sent} notification${result.sent !== 1 ? 's' : ''} to subscribers`,
    },
  }
}

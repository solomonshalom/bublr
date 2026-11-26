import { firestore } from './firebase'
import { sendBatchNotifications } from './resend'
import { hasActiveAccess } from './subscription'
import { confirmedSubscribers, subscriberEmail } from './subscribers'
import { fullContent, isPaidPost } from './paid-content'
import {
  describePrice,
  needsRefresh,
  paidAccess,
  refreshPaidSubscriber,
  trustedPaidSettings,
  verifiedPaid,
} from './paid-newsletter'
import { EMAIL_LINK_TTL_MS, loginUrl, manageUrl } from './reader-session'

const SITE = () => (process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life').replace(/\/$/, '')

/**
 * Who among the subscribers pays, asking Stripe/Creem about anyone whose paid
 * period has run out (a few at a time) before deciding.
 */
async function paidReaders(author, subscribers, { now = Date.now() } = {}) {
  const currentMode = author.integrations?.payments?.mode || 'live'
  const records = new Map()
  const stale = []
  for (const sub of subscribers) {
    const paid = verifiedPaid(author.id, sub)
    if (!paid) continue
    records.set(subscriberEmail(sub), paid)
    if (needsRefresh(paid, { now })) stale.push(subscriberEmail(sub))
  }
  for (let i = 0; i < stale.length; i += 5) {
    await Promise.all(
      stale.slice(i, i + 5).map(async email => {
        try {
          const fresh = await refreshPaidSubscriber(author, email, { now })
          if (fresh) records.set(email, fresh)
        } catch (error) {
          console.error('Newsletter: could not check a paid subscription:', error?.message)
        }
      })
    )
  }
  const paying = new Set()
  for (const [email, paid] of records) if (paidAccess(paid, { now, currentMode })) paying.add(email)
  return paying
}

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

  const author = { id: authorDoc.id, ...authorDoc.data() }
  let subscribers = confirmedSubscribers(author.subscribers)
  if (subscribers.length === 0) {
    return { status: 200, body: { success: true, sent: 0, message: 'No subscribers to notify' } }
  }

  // Paid posts: paying readers get the opening of the whole post and a link
  // that signs them in; everyone else gets the free preview and an invitation
  // (or nothing, if the writer turned previews off).
  const paidPost = isPaidPost(post)
  const settings = trustedPaidSettings(author)
  const paying = await paidReaders(author, subscribers)
  const postPath = `/${author.name}/${post.slug}`
  const postUrl = `${SITE()}${postPath}`
  let wholePost = null
  if (paidPost) {
    wholePost = fullContent(post, postId)
    if (wholePost === null) {
      return { status: 500, body: { error: 'This paid post can’t be opened on the server, so it wasn’t emailed.' } }
    }
    if (settings?.teaseFree === false) subscribers = subscribers.filter(sub => paying.has(subscriberEmail(sub)))
    if (subscribers.length === 0) {
      return { status: 200, body: { success: true, sent: 0, message: 'No paid subscribers to notify' } }
    }
  }
  const price = settings ? describePrice(settings.monthly, settings.currency, 'month') : ''
  const personalize = subscriber => {
    const email = subscriberEmail(subscriber)
    const pays = paying.has(email)
    const extras = pays ? { manageUrl: manageUrl(SITE(), email, author.id) } : {}
    if (!paidPost) return extras
    if (pays) {
      return {
        ...extras,
        postContent: wholePost,
        postUrl: loginUrl(SITE(), email, { next: postPath, ttlMs: EMAIL_LINK_TTL_MS }),
        notice: 'For paid subscribers. Thank you for your support.',
      }
    }
    return {
      postUrl,
      notice: `This post is for paid subscribers.${price ? ` Subscribe for ${price} to read all of it.` : ''}`,
      ctaText: 'Subscribe to read',
    }
  }

  // Custom template only while the writer's subscription is active (with grace period)
  const customTemplate =
    hasActiveAccess(author) && author.newsletterTemplate?.html ? author.newsletterTemplate.html : null

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
    personalize: paidPost || paying.size ? personalize : undefined,
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

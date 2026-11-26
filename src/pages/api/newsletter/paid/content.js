import { firestore } from '../../../../lib/firebase'
import { fullContent, isPaidPost, removePaywallLine } from '../../../../lib/paid-content'
import { readerHasPaidAccess } from '../../../../lib/paid-newsletter'
import { emailOrigin, manageUrl, maskEmail, readerFromRequest, sessionCovers } from '../../../../lib/reader-session'
import { sanitizePostHtml } from '../../../../lib/sanitize-post'
import { getBearerToken, verifyIdToken } from '../../../../lib/server-auth'
import { clientIp, isRateLimited } from '../../../../lib/rate-limit'

/**
 * The whole of a paid post, for whoever may read it: the writer (signed in to
 * Bublr) and readers whose session's address pays the writer. Everyone else
 * gets `{ locked: true }` and the page keeps showing the free preview.
 *
 * GET ?postId=<id>
 *   -> { html, reader: { email, manageUrl } | null, author: true? }
 *   -> { locked: true, signedIn: 'jo***@example.com' | null }
 */
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/

async function signedInUid(req) {
  const token = getBearerToken(req)
  if (!token) return null
  try {
    return (await verifyIdToken(token)).uid
  } catch (_) {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  // Answers depend on who's asking: never cache them anywhere shared.
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vary', 'Cookie, Authorization')

  if (isRateLimited(`paid-content:${clientIp(req)}`, { max: 120, windowMs: 10 * 60 * 1000 })) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  const postId = String(req.query.postId || '')
  if (!ID_RE.test(postId)) return res.status(400).json({ error: 'Missing post' })

  try {
    const postDoc = await firestore.collection('posts').doc(postId).get()
    if (!postDoc.exists) return res.status(404).json({ error: 'Post not found' })
    const post = { id: postDoc.id, ...postDoc.data() }
    if (!isPaidPost(post)) return res.status(200).json({ locked: false, everyone: true })

    const uid = await signedInUid(req)
    const isAuthor = uid && uid === post.author
    if (!post.published && !isAuthor) return res.status(404).json({ error: 'Post not found' })

    const authorDoc = await firestore.collection('users').doc(post.author).get()
    if (!authorDoc.exists) return res.status(404).json({ error: 'Post not found' })
    const author = { id: authorDoc.id, ...authorDoc.data() }

    const session = readerFromRequest(req)
    let reader = null
    if (!isAuthor) {
      const allowed = sessionCovers(session, author.id) && (await readerHasPaidAccess(author, session.email))
      if (!allowed) return res.status(200).json({ locked: true, signedIn: session ? maskEmail(session.email) : null })
      reader = { email: maskEmail(session.email), manageUrl: manageUrl(emailOrigin(), session.email, author.id) }
    }

    const html = fullContent(post)
    if (html === null) {
      console.error('Paid content: could not open the sealed body of', post.id)
      return res.status(500).json({ error: 'This post can’t be shown right now. Please try again later.' })
    }
    return res.status(200).json({ html: sanitizePostHtml(removePaywallLine(html)), reader, author: Boolean(isAuthor) })
  } catch (error) {
    console.error('Paid content failed:', error)
    return res.status(500).json({ error: 'This post can’t be shown right now. Please try again later.' })
  }
}

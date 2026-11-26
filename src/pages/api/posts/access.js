import firebase, { firestore } from '../../../lib/firebase'
import { loadUserDoc, requirePostOwner } from '../../../lib/post-owner'
import { ACCESS_PAID, PaidContentError, fullContent, isPaidPost, sealedFields } from '../../../lib/paid-content'
import { canPublishPaid } from '../../../lib/paid-newsletter'
import { generateSearchQueries } from '../../../lib/db'
import { federatePost } from '../../../lib/activitypub/federation'

/**
 * Who can read a post: everyone, or paid subscribers.
 *
 * POST { postId, access: 'paid' | 'everyone' }
 *
 * Going paid seals the body and leaves only the free preview (what's above
 * the paywall line) in the open; it needs the paid newsletter to be on.
 * Going back to everyone puts the whole post back, and is always allowed.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const owned = await requirePostOwner(req, res, req.body?.postId)
  if (!owned) return
  const { uid, post } = owned
  const access = req.body?.access
  if (access !== 'paid' && access !== 'everyone') return res.status(400).json({ error: 'Choose everyone or paid subscribers.' })

  try {
    const ref = firestore.collection('posts').doc(post.id)
    if (access === 'paid') {
      const author = await loadUserDoc(uid)
      if (!isPaidPost(post) && !canPublishPaid(author)) {
        return res.status(402).json({
          error: 'Turn on paid subscriptions first (Settings → Newsletter). They’re part of the Pro + Shop plan.',
          code: 'PAID_PLAN_REQUIRED',
        })
      }
    }
    // Read and switched in one transaction: a save landing meanwhile is
    // either sealed with the rest or seen here.
    const { FieldValue } = firebase.firestore
    const changed = await firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref)
      const current = { id: post.id, ...snapshot.data() }
      if (access === 'paid') {
        if (isPaidPost(current)) return false
        const sealed = sealedFields(uid, post.id, current.content || '')
        // Search terms are rebuilt from the free part only
        const searchQueries = generateSearchQueries({ title: current.title, excerpt: current.excerpt, content: sealed.content })
        transaction.update(ref, { access: ACCESS_PAID, ...sealed, searchQueries })
        return true
      }
      if (!isPaidPost(current)) return false
      const whole = fullContent(current)
      if (whole === null) throw new PaidContentError('This post can’t be opened right now, so it was left as it is. Please try again later.', 500)
      transaction.update(ref, { access: FieldValue.delete(), paidContentSealed: FieldValue.delete(), content: whole })
      return true
    })
    if (!changed) return res.status(200).json({ access })
    // What fediverse followers see changes with it.
    if (post.published) await federatePost(post.id)
    return res.status(200).json({ access })
  } catch (error) {
    if (error instanceof PaidContentError) return res.status(error.status).json({ error: error.message })
    console.error('Post access change failed:', error)
    return res.status(500).json({ error: 'Could not change who can read this post' })
  }
}

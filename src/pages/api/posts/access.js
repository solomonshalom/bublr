import firebase, { firestore } from '../../../lib/firebase'
import { loadUserDoc, requirePostOwner } from '../../../lib/post-owner'
import { ACCESS_PAID, PaidContentError, fullContent, isPaidPost, sealedFields } from '../../../lib/paid-content'
import { canPublishPaid } from '../../../lib/paid-newsletter'
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
      if (isPaidPost(post)) return res.status(200).json({ access: 'paid' })
      const author = await loadUserDoc(uid)
      if (!canPublishPaid(author)) {
        return res.status(402).json({
          error: 'Turn on paid subscriptions first (Settings → Newsletter). They’re part of the Pro + Shop plan.',
          code: 'PAID_PLAN_REQUIRED',
        })
      }
      await ref.update({ access: ACCESS_PAID, ...sealedFields(uid, post.id, post.content || '') })
    } else {
      if (!isPaidPost(post)) return res.status(200).json({ access: 'everyone' })
      const whole = fullContent(post)
      if (whole === null) {
        return res.status(500).json({ error: 'This post can’t be opened right now, so it was left as it is. Please try again later.', code: 'PAID_CONTENT_UNREADABLE' })
      }
      const { FieldValue } = firebase.firestore
      await ref.update({ access: FieldValue.delete(), paidContentSealed: FieldValue.delete(), content: whole })
    }
    // What fediverse followers see changes with it.
    if (post.published) await federatePost(post.id)
    return res.status(200).json({ access })
  } catch (error) {
    if (error instanceof PaidContentError) return res.status(error.status).json({ error: error.message })
    console.error('Post access change failed:', error)
    return res.status(500).json({ error: 'Could not change who can read this post' })
  }
}

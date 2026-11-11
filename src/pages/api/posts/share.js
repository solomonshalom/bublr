import firebase, { firestore } from '../../../lib/firebase'
import { requireAuth } from '../../../lib/server-auth'
import { newShareToken, isShareToken, draftSharePath } from '../../../lib/draft-share'

/**
 * POST /api/posts/share  { postId, enabled }
 *
 * Turns a draft's private link on or off. Only the author can do it. Turning
 * it on when it's already on returns the same link, so pressing the button
 * twice (or in two tabs) never breaks a link that was already sent to someone.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const uid = await requireAuth(req, res)
  if (!uid) return

  const { postId, enabled } = req.body || {}

  if (!postId || typeof postId !== 'string') {
    return res.status(400).json({ error: { message: 'Missing postId' } })
  }
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: { message: 'Missing enabled (true or false)' } })
  }

  try {
    const ref = firestore.collection('posts').doc(postId)
    const postDoc = await ref.get()

    if (!postDoc.exists) {
      return res.status(404).json({ error: { message: 'Post not found' } })
    }

    const post = postDoc.data()
    if (post.author !== uid) {
      return res.status(403).json({ error: { message: 'You can only share your own drafts' } })
    }

    if (!enabled) {
      await ref.update({ shareToken: firebase.firestore.FieldValue.delete() })
      return res.status(200).json({ shared: false })
    }

    let token = post.shareToken
    if (!isShareToken(token)) {
      token = newShareToken()
      await ref.update({ shareToken: token })
    }
    return res.status(200).json({ shared: true, token, path: draftSharePath(token) })
  } catch (error) {
    console.error('Draft share error:', error)
    return res.status(500).json({ error: { message: 'Internal server error' } })
  }
}

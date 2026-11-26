import { firestore } from '../../../../lib/firebase'
import { fediverseEnabled } from '../../../../lib/activitypub/actor-keys'
import { wantsActivityJson } from '../../../../lib/activitypub/config'
import { sendActivityJson } from '../../../../lib/activitypub/lookup'
import { buildArticle, postUrl } from '../../../../lib/activitypub/objects'

/**
 * A post as an ActivityPub Article: /posts/<postId> or /posts/<postId>/<gen>.
 * Only published posts of writers on the fediverse; an older id of a post
 * that was published again answers 410 like a deleted one.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const parts = Array.isArray(req.query.id) ? req.query.id : [req.query.id]
  const [postId, genPart] = parts
  const gen = genPart === undefined ? 0 : /^\d{1,6}$/.test(genPart) ? Number(genPart) : -1
  if (typeof postId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(postId) || gen < 0 || parts.length > 2) {
    return sendActivityJson(res, 404, { error: 'Not found' })
  }
  try {
    const snapshot = await firestore.collection('posts').doc(postId).get()
    if (!snapshot.exists) return sendActivityJson(res, 410, { error: 'Gone' })
    const post = { id: snapshot.id, ...snapshot.data() }
    const current = Number.isInteger(post.fediverse?.gen) ? post.fediverse.gen : 0
    const authorSnap = post.author ? await firestore.collection('users').doc(post.author).get() : null
    const author = authorSnap?.exists ? { id: authorSnap.id, ...authorSnap.data() } : null
    if (!post.published || !post.slug || !author || !fediverseEnabled(author) || gen !== current) {
      return sendActivityJson(res, 410, { error: 'Gone' })
    }
    if (!wantsActivityJson(req) && /text\/html/.test(String(req.headers?.accept || ''))) {
      res.setHeader('Location', postUrl(author, post))
      return res.status(302).end()
    }
    return sendActivityJson(res, 200, buildArticle(post, author, { postId, gen }))
  } catch (error) {
    console.error('Fediverse post failed:', error)
    return res.status(500).json({ error: 'Post error' })
  }
}

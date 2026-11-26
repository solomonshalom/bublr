import { loadUserDoc, requirePostOwner } from '../../../lib/post-owner'
import { fediverseEnabled } from '../../../lib/activitypub/actor-keys'
import { federatePost } from '../../../lib/activitypub/federation'

/**
 * The editor calls this a little while after a published post was edited, so
 * fediverse followers see the new version (an Update, sent only if what they
 * see changed). The post is read from the database, never from the request.
 *
 * POST { postId }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const owned = await requirePostOwner(req, res, req.body?.postId)
  if (!owned) return
  const { uid, post } = owned
  const author = await loadUserDoc(uid)
  if (!fediverseEnabled(author) || !post.published) return res.status(200).json({ sent: null })
  const result = await federatePost(post.id, { post, author })
  return res.status(200).json({ sent: result.sent || null })
}

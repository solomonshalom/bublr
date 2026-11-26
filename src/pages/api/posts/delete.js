import firebase, { firestore } from '../../../lib/firebase'
import { loadUserDoc, requirePostOwner } from '../../../lib/post-owner'
import { federatePostDeleted } from '../../../lib/activitypub/federation'

/**
 * Delete one of the writer's posts. Fediverse followers' servers are told
 * first (while the post can still be found), then the post goes.
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
  try {
    if (post.fediverse?.live) await federatePostDeleted(post, await loadUserDoc(uid))
    await firestore.collection('posts').doc(post.id).delete()
    await firestore
      .collection('users')
      .doc(uid)
      .update({ posts: firebase.firestore.FieldValue.arrayRemove(post.id) })
      .catch(() => {})
    return res.status(200).json({ deleted: true })
  } catch (error) {
    console.error('Post delete failed:', error)
    return res.status(500).json({ error: 'Could not delete the post' })
  }
}

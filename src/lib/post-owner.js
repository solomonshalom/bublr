import { firestore } from './firebase'
import { requireAuth } from './server-auth'

/**
 * For routes that act on one of the signed-in writer's posts: answers
 * 401/400/404/403 itself and returns { uid, post } (post includes its id),
 * or null.
 */
export async function requirePostOwner(req, res, postId) {
  const uid = await requireAuth(req, res)
  if (!uid) return null
  if (typeof postId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(postId)) {
    res.status(400).json({ error: 'Missing post' })
    return null
  }
  const snapshot = await firestore.collection('posts').doc(postId).get()
  if (!snapshot.exists) {
    res.status(404).json({ error: 'Post not found' })
    return null
  }
  const post = { id: snapshot.id, ...snapshot.data() }
  if (post.author !== uid) {
    res.status(403).json({ error: 'You can only change your own posts.', code: 'FORBIDDEN' })
    return null
  }
  return { uid, post }
}

export async function loadUserDoc(uid) {
  const snapshot = await firestore.collection('users').doc(uid).get()
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null
}

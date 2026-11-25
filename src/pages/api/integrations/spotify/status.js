import firebase, { firestore } from '../../../../lib/firebase'
import { requireAuth } from '../../../../lib/server-auth'
import { spotifyStatus } from '../../../../lib/spotify'

/**
 *   GET     the writer's Spotify connection (never the secret)
 *   DELETE  disconnect: the client secret and refresh token are removed
 */
export default async function handler(req, res) {
  if (!['GET', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const uid = await requireAuth(req, res)
  if (!uid) return

  const userRef = firestore.collection('users').doc(uid)
  if (req.method === 'DELETE') {
    await userRef.update({ 'integrations.spotify': firebase.firestore.FieldValue.delete() })
    return res.status(200).json(spotifyStatus(null))
  }

  const snapshot = await userRef.get()
  if (!snapshot.exists) return res.status(404).json({ error: 'User not found' })
  return res.status(200).json(spotifyStatus({ id: uid, ...snapshot.data() }))
}

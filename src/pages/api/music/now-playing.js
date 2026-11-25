import { firestore } from '../../../lib/firebase'
import { SpotifyError, getListening } from '../../../lib/spotify'
import { clientIp, isRateLimited } from '../../../lib/rate-limit'

/**
 * What a writer is listening to, for the "adaptive" music section on their
 * profile. Public; answers only for writers who chose Spotify mode.
 *
 * GET ?user=<username>
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (isRateLimited(`now-playing:${clientIp(req)}`, { max: 60, windowMs: 60 * 1000 })) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  const name = String(req.query.user || '')
  if (!name || name.length > 64) return res.status(400).json({ error: 'Missing user' })

  try {
    const snapshot = await firestore.collection('users').where('name', '==', name).limit(1).get()
    if (snapshot.empty) return res.status(404).json({ error: 'Not found' })
    const user = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }

    if (user.music?.mode !== 'spotify' || user.integrations?.spotify?.status !== 'connected') {
      return res.status(200).json({ connected: false, nowPlaying: null, recent: [] })
    }

    const listening = await getListening(user, { recentLimit: user.music?.showRecent === false ? 0 : 10 })
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=10, stale-while-revalidate=20')
    return res.status(200).json({ connected: true, ...listening })
  } catch (error) {
    if (error instanceof SpotifyError) {
      // Expired or unavailable: the profile falls back to the writer's list.
      return res.status(200).json({ connected: false, nowPlaying: null, recent: [], reason: error.code || 'unavailable' })
    }
    console.error('now-playing failed:', error)
    return res.status(500).json({ error: 'Unavailable' })
  }
}

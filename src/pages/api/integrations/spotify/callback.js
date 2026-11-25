import { firestore } from '../../../../lib/firebase'
import { open, seal, verifyState } from '../../../../lib/secret-box'
import { exchangeCode, fetchProfile, refreshContext, secretContext } from '../../../../lib/spotify'

/**
 * Spotify sends the writer back here after they authorise their app. The
 * signed `state` says which writer started it (it can't be forged or reused
 * after 15 minutes); the code is exchanged with that writer's own app.
 */
const back = (res, query) => {
  res.setHeader('Cache-Control', 'no-store')
  res.redirect(302, `/dashboard/settings/music?${new URLSearchParams(query)}`)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  const { code, state, error } = req.query
  const payload = verifyState(String(state || ''))
  if (!payload?.uid) return back(res, { spotify: 'error', reason: 'expired' })
  if (error) return back(res, { spotify: 'error', reason: error === 'access_denied' ? 'denied' : 'spotify' })
  if (typeof code !== 'string' || !code) return back(res, { spotify: 'error', reason: 'spotify' })

  const uid = payload.uid
  try {
    const userRef = firestore.collection('users').doc(uid)
    const snapshot = await userRef.get()
    const spotify = snapshot.exists ? snapshot.data().integrations?.spotify : null
    const clientSecret = spotify ? open(spotify.secretSealed, secretContext(uid)) : null
    if (!spotify?.clientId || !clientSecret) return back(res, { spotify: 'error', reason: 'expired' })

    const tokens = await exchangeCode({ clientId: spotify.clientId, clientSecret, code })
    if (!tokens?.refresh_token) return back(res, { spotify: 'error', reason: 'spotify' })

    let displayName = null
    try {
      displayName = (await fetchProfile(tokens.access_token)).displayName
    } catch (_) {
      // Not needed for the feature.
    }

    await userRef.update({
      'integrations.spotify.refreshSealed': seal(tokens.refresh_token, refreshContext(uid)),
      'integrations.spotify.status': 'connected',
      'integrations.spotify.displayName': displayName,
      'integrations.spotify.connectedAt': Date.now(),
    })
    return back(res, { spotify: 'connected' })
  } catch (err) {
    console.error('Spotify callback failed:', err?.message || err)
    // A redirect URI that doesn't match the app's settings is the usual cause.
    return back(res, { spotify: 'error', reason: err?.code === 'invalid_grant' ? 'redirect' : 'spotify' })
  }
}

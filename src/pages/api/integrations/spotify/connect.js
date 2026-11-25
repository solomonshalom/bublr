import { firestore } from '../../../../lib/firebase'
import { requireAuth } from '../../../../lib/server-auth'
import { canSeal, open, seal, signState } from '../../../../lib/secret-box'
import { SpotifyError, authorizeUrl, isClientId, secretContext, verifyClient } from '../../../../lib/spotify'

/**
 * Save the writer's Spotify app and send them to Spotify to authorise it.
 *
 * POST { clientId, clientSecret? }
 * The secret may be left out when reconnecting the same app.
 * Answers { authorizeUrl }.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const uid = await requireAuth(req, res)
  if (!uid) return

  if (!canSeal()) {
    return res.status(500).json({ error: 'Spotify can’t be connected on this server yet (INTEGRATIONS_SECRET missing).' })
  }

  const clientId = String(req.body?.clientId || '').trim()
  let clientSecret = String(req.body?.clientSecret || '').trim()

  if (!isClientId(clientId)) {
    return res.status(400).json({ error: 'The Client ID is the 32-character code on your Spotify app’s page.' })
  }

  try {
    const userRef = firestore.collection('users').doc(uid)
    const snapshot = await userRef.get()
    if (!snapshot.exists) return res.status(404).json({ error: 'User not found' })
    const existing = snapshot.data().integrations?.spotify

    if (!clientSecret && existing?.clientId === clientId && existing.secretSealed) {
      clientSecret = open(existing.secretSealed, secretContext(uid)) || ''
    }
    if (!isClientId(clientSecret)) {
      return res.status(400).json({ error: 'The Client Secret is the 32-character code under “View client secret”.' })
    }

    await verifyClient(clientId, clientSecret)

    const sameApp = existing?.clientId === clientId
    await userRef.update({
      'integrations.spotify': {
        clientId,
        secretSealed: seal(clientSecret, secretContext(uid)),
        // Keep a working connection until the new authorisation replaces it.
        refreshSealed: sameApp ? existing.refreshSealed || null : null,
        status: sameApp && existing.refreshSealed && existing.status === 'connected' ? 'connected' : 'pending',
        displayName: sameApp ? existing.displayName || null : null,
        connectedAt: sameApp ? existing.connectedAt || null : null,
      },
    })

    const state = signState({ uid, nonce: Math.random().toString(36).slice(2) })
    return res.status(200).json({ authorizeUrl: authorizeUrl({ clientId, state }) })
  } catch (error) {
    if (error instanceof SpotifyError) {
      return res.status(400).json({
        error: error.status === 400 || error.status === 401
          ? 'Spotify didn’t accept that Client ID and Secret. Check them on your app’s Settings page.'
          : `Couldn’t reach Spotify: ${error.message}`,
      })
    }
    console.error('Spotify connect failed:', error)
    return res.status(500).json({ error: 'Could not connect Spotify' })
  }
}

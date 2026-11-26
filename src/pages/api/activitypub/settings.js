import { firestore } from '../../../lib/firebase'
import { requireAuth } from '../../../lib/server-auth'
import { canSeal } from '../../../lib/secret-box'
import { actorPrivateKey, fediverseEnabled, fediverseHandle, newSealedKey } from '../../../lib/activitypub/actor-keys'
import { actorUrl } from '../../../lib/activitypub/config'
import { followerCount, removeAllFollowers } from '../../../lib/activitypub/followers'
import { federateAccountGone, federateProfile, resetPostsFederation } from '../../../lib/activitypub/federation'

/**
 * The writer's fediverse setting (Settings → Fediverse).
 *
 *   GET                              { enabled, handle, followers }
 *   POST { enabled: true }           let people follow @name@bublr.life
 *   POST { enabled: false }          leave: followers' servers are told the
 *                                    account is gone, and the list is cleared
 *   POST { action: 'profile' }       name, bio or picture changed: tell
 *                                    followers' servers (at most every 20 seconds)
 */
const lastProfilePush = new Map()

async function status(user) {
  const enabled = fediverseEnabled(user)
  return {
    enabled,
    handle: fediverseHandle(user),
    actor: enabled ? actorUrl(user.id) : null,
    followers: enabled ? await followerCount(user.id) : 0,
    canSeal: canSeal(),
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const uid = await requireAuth(req, res)
  if (!uid) return
  const ref = firestore.collection('users').doc(uid)
  const snapshot = await ref.get()
  if (!snapshot.exists) return res.status(404).json({ error: 'User not found' })
  const user = { id: uid, ...snapshot.data() }

  try {
    if (req.method === 'GET') return res.status(200).json(await status(user))

    if (req.body?.action === 'profile') {
      const last = lastProfilePush.get(uid) || 0
      if (!fediverseEnabled(user) || Date.now() - last < 20 * 1000) return res.status(200).json({ sent: false })
      lastProfilePush.set(uid, Date.now())
      const result = await federateProfile(user)
      return res.status(200).json({ sent: Boolean(result.sent) })
    }

    if (req.body?.enabled === true) {
      if (!user.name) return res.status(400).json({ error: 'Choose a username first.' })
      if (!canSeal()) return res.status(500).json({ error: 'The fediverse can’t be turned on on this server yet (INTEGRATIONS_SECRET missing).' })
      const key = actorPrivateKey(user) ? { keySealed: user.fediverse.keySealed, keyCreatedAt: user.fediverse.keyCreatedAt || Date.now() } : newSealedKey(uid)
      const fediverse = { enabled: true, ...key, enabledAt: Date.now() }
      await ref.update({ fediverse })
      return res.status(200).json(await status({ ...user, fediverse }))
    }

    if (req.body?.enabled === false) {
      if (fediverseEnabled(user)) await federateAccountGone(user)
      await removeAllFollowers(uid)
      await resetPostsFederation(uid)
      await ref.update({ fediverse: { enabled: false } })
      return res.status(200).json(await status({ ...user, fediverse: { enabled: false } }))
    }

    return res.status(400).json({ error: 'Nothing to change' })
  } catch (error) {
    console.error('Fediverse settings failed:', error)
    return res.status(500).json({ error: 'Could not change your fediverse setting' })
  }
}

import { actorPublicKeyPem } from '../../../../../lib/activitypub/actor-keys'
import { wantsActivityJson } from '../../../../../lib/activitypub/config'
import { enabledWriterById, sendActivityJson } from '../../../../../lib/activitypub/lookup'
import { buildActor, profileUrl } from '../../../../../lib/activitypub/objects'

/**
 * A writer as a fediverse actor (Person). Browsers that land here are sent
 * to the writer's page. A writer who turned the fediverse off answers 410.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const user = await enabledWriterById(String(req.query.uid || ''))
    if (!user) return sendActivityJson(res, 410, { error: 'Gone' }, { cache: 'public, max-age=60' })
    if (!wantsActivityJson(req) && /text\/html/.test(String(req.headers?.accept || ''))) {
      res.setHeader('Location', profileUrl(user))
      return res.status(302).end()
    }
    const publicKeyPem = actorPublicKeyPem(user)
    if (!publicKeyPem) return sendActivityJson(res, 503, { error: 'Not ready' }, { cache: 'no-store' })
    return sendActivityJson(res, 200, buildActor(user, { publicKeyPem }), { cache: 'public, max-age=300' })
  } catch (error) {
    console.error('Fediverse actor failed:', error)
    return res.status(500).json({ error: 'Actor error' })
  }
}

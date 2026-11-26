import { actorUrl, handleDomain, localDomains, uidFromActorUrl } from '../../../lib/activitypub/config'
import { enabledWriterById, enabledWriterByName } from '../../../lib/activitypub/lookup'
import { profileUrl } from '../../../lib/activitypub/objects'

/**
 * WebFinger (/.well-known/webfinger, rewritten here): how a fediverse app
 * turns @name@bublr.life into the writer's actor. Accepts acct: on
 * bublr.life or www.bublr.life, the profile URL and the actor URL.
 */
async function writerFor(resource) {
  const value = String(resource || '').trim()
  const acct = value.match(/^acct:@?([^@\s]+)@([^@\s]+)$/i)
  if (acct) {
    if (!localDomains().includes(acct[2].toLowerCase())) return null
    return enabledWriterByName(acct[1].toLowerCase())
  }
  const fromActor = uidFromActorUrl(value)
  if (fromActor) return enabledWriterById(fromActor)
  // A profile URL: https://bublr.life/name (or /@name)
  const profile = value.match(/^https?:\/\/([^/\s]+)\/@?([a-z0-9-]{1,64})\/?$/i)
  if (profile && localDomains().includes(profile[1].toLowerCase())) return enabledWriterByName(profile[2].toLowerCase())
  return null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const resource = req.query?.resource
  if (!resource) return res.status(400).json({ error: 'resource is required' })
  try {
    const user = await writerFor(resource)
    if (!user) return res.status(404).json({ error: 'Not found' })
    const actor = actorUrl(user.id)
    res.setHeader('Content-Type', 'application/jrd+json; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300')
    return res.status(200).send(
      JSON.stringify({
        subject: `acct:${user.name}@${handleDomain()}`,
        aliases: [profileUrl(user), actor],
        links: [
          { rel: 'self', type: 'application/activity+json', href: actor },
          { rel: 'http://webfinger.net/rel/profile-page', type: 'text/html', href: profileUrl(user) },
          ...(user.photo ? [{ rel: 'http://webfinger.net/rel/avatar', href: user.photo }] : []),
        ],
      })
    )
  } catch (error) {
    console.error('WebFinger failed:', error)
    return res.status(500).json({ error: 'WebFinger error' })
  }
}

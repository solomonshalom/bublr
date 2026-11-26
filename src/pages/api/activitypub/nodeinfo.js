import { firestore } from '../../../lib/firebase'
import { apOrigin } from '../../../lib/activitypub/config'

/**
 * NodeInfo, so fediverse servers and directories know what Bublr is.
 *   /.well-known/nodeinfo  -> ?discover=1: where the document is
 *   this route             -> the NodeInfo 2.1 document
 */
const SCHEMA = 'http://nodeinfo.diaspora.software/ns/schema/2.1'
let usersCache = { total: null, at: 0 }

async function federatedWriters() {
  if (Date.now() - usersCache.at < 6 * 60 * 60 * 1000) return usersCache.total
  try {
    const snapshot = await firestore.collection('users').where('fediverse.enabled', '==', true).get()
    usersCache = { total: snapshot.size, at: Date.now() }
  } catch (error) {
    console.error('NodeInfo: could not count writers:', error?.message)
    usersCache = { total: null, at: Date.now() }
  }
  return usersCache.total
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (req.query?.discover) {
    return res.status(200).json({ links: [{ rel: SCHEMA, href: `${apOrigin()}/api/activitypub/nodeinfo` }] })
  }
  const total = await federatedWriters()
  res.setHeader('Content-Type', `application/json; profile="${SCHEMA}#"`)
  return res.status(200).send(
    JSON.stringify({
      version: '2.1',
      software: {
        name: 'bublr',
        version: '1.0.0',
        repository: 'https://github.com/solomonshalom/bublr',
        homepage: 'https://bublr.life',
      },
      protocols: ['activitypub'],
      services: { inbound: [], outbound: ['rss2.0', 'atom1.0'] },
      openRegistrations: true,
      usage: { users: total === null ? {} : { total } },
      metadata: { nodeName: 'Bublr', nodeDescription: 'A calm, open-source home for writing, with no ads.' },
    })
  )
}

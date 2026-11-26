import { firestore } from '../firebase'
import { fediverseEnabled } from './actor-keys'

/** Writers by uid or username, only while they have the fediverse on. */
export async function enabledWriterById(uid) {
  if (typeof uid !== 'string' || !uid || uid.length > 128 || uid.includes('/')) return null
  const snapshot = await firestore.collection('users').doc(uid).get()
  if (!snapshot.exists) return null
  const user = { id: snapshot.id, ...snapshot.data() }
  return fediverseEnabled(user) ? user : null
}

export async function enabledWriterByName(name) {
  if (typeof name !== 'string' || !/^[a-z0-9-]{1,64}$/i.test(name)) return null
  const snapshot = await firestore.collection('users').where('name', '==', name).limit(1).get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  const user = { id: doc.id, ...doc.data() }
  return fediverseEnabled(user) ? user : null
}

/** Answer with ActivityPub JSON. */
export function sendActivityJson(res, status, body, { cache = 'public, max-age=60' } = {}) {
  res.setHeader('Content-Type', 'application/activity+json; charset=utf-8')
  res.setHeader('Cache-Control', cache)
  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(status).send(JSON.stringify(body))
}

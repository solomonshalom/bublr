import { firestore } from '../firebase'
import { fediverseEnabled } from './actor-keys'
import { actorUrl, inboxUrl, sharedInboxUrl, uidFromActorUrl } from './config'
import { addFollower, removeActorEverywhere, removeFollower } from './followers'
import { acceptActivity } from './objects'
import { RemoteError, assertPublicUrl, fetchActivityJson } from './remote'
import { SignatureError, parseSignatureHeader, verifyRequestSignature } from './signatures'
import { deliver, signerFor } from './federation'

/**
 * Activities other servers send to a writer's inbox (or the shared one).
 *
 * Everything must be signed by the actor it claims to come from: the
 * signature is checked against the key their server publishes, and that key
 * must belong to the activity's actor. Bublr only needs a few activities:
 *
 *   Follow           someone follows a writer: remember them, send Accept
 *   Undo { Follow }  they unfollowed
 *   Delete { actor } their account is gone
 *
 * Everything else (likes, boosts, replies, edits) is acknowledged and
 * dropped: Bublr has no comments, and a writer's page stays theirs.
 */

const MAX_BODY = 256 * 1024
const KEY_TTL_MS = 10 * 60 * 1000

export class InboxError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'InboxError'
    this.status = status
  }
}

export async function readRawBody(req) {
  if (typeof req.rawBody === 'string') return req.rawBody // tests
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    size += buffer.length
    if (size > MAX_BODY) throw new InboxError('Too large', 413)
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const idOf = value => (typeof value === 'string' ? value : value && typeof value === 'object' && typeof value.id === 'string' ? value.id : null)

const keys = new Map() // keyId -> { pem, owner, actor, at }

export function _clearKeyCacheForTesting() {
  keys.clear()
}

function keyFromDocument(doc, keyId) {
  // An actor with its key(s), or a key object on its own.
  if (doc.publicKey) {
    const list = Array.isArray(doc.publicKey) ? doc.publicKey : [doc.publicKey]
    const key = list.find(k => k && k.id === keyId) || list[0]
    if (!key?.publicKeyPem) return null
    return { pem: key.publicKeyPem, owner: idOf(key.owner) || doc.id, actor: doc }
  }
  if (doc.publicKeyPem) return { pem: doc.publicKeyPem, owner: idOf(doc.owner), actor: null }
  return null
}

async function fetchKey(keyId, signer, { fresh = false } = {}) {
  const cached = keys.get(keyId)
  if (!fresh && cached && Date.now() - cached.at < KEY_TTL_MS) return cached
  const url = keyId.split('#')[0]
  const doc = await fetchActivityJson(url, { signer })
  const key = keyFromDocument(doc, keyId)
  if (!key?.owner) throw new InboxError('The key has no owner', 401)
  if (!key.actor || key.actor.id !== key.owner) {
    // The key lives apart from its actor: fetch the actor for its inbox.
    const actor = await fetchActivityJson(key.owner, { signer })
    if (actor.id !== key.owner) throw new InboxError('The key’s owner doesn’t match', 401)
    key.actor = actor
  }
  const entry = { ...key, at: Date.now() }
  if (keys.size > 1000) keys.clear()
  keys.set(keyId, entry)
  return entry
}

async function loadWriter(uid) {
  if (!uid) return null
  const snapshot = await firestore.collection('users').doc(uid).get()
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null
}

// Which of our writers an activity is for (shared inbox deliveries name them in the object).
function recipientUid(activity) {
  const type = activity.type
  if (type === 'Follow') return uidFromActorUrl(idOf(activity.object))
  if (type === 'Undo' && activity.object && typeof activity.object === 'object') return uidFromActorUrl(idOf(activity.object.object))
  return null
}

function requestPaths(req, uid) {
  const own = new URL(uid ? inboxUrl(uid) : sharedInboxUrl())
  const paths = new Set([String(req.url || '').split('#')[0], own.pathname])
  return [...paths].filter(Boolean)
}

const lowerHeaders = headers => {
  const out = {}
  for (const [key, value] of Object.entries(headers || {})) out[key.toLowerCase()] = value
  return out
}

/**
 * Handle one delivery. `uid` is set for a writer's own inbox and null for the
 * shared inbox. Returns { status, body }.
 */
export async function processInbox(req, { uid = null, now = Date.now() } = {}) {
  const raw = await readRawBody(req)
  let activity
  try {
    activity = JSON.parse(raw)
  } catch (_) {
    throw new InboxError('Not JSON', 400)
  }
  if (!activity || typeof activity !== 'object' || typeof activity.type !== 'string') throw new InboxError('Not an activity', 400)
  const actor = idOf(activity.actor)
  if (!actor) throw new InboxError('No actor', 400)

  const headers = lowerHeaders(req.headers)
  const parsed = parseSignatureHeader(headers.signature)
  if (!parsed) throw new InboxError('Unsigned', 401)

  const targetUid = uid || recipientUid(activity)
  const writer = targetUid ? await loadWriter(targetUid) : null
  if (uid && !fediverseEnabled(writer)) throw new InboxError('No such actor', 404)
  // Fetch the sender's key signed as the writer, for servers that only
  // answer signed requests (Mastodon's secure mode, GoToSocial).
  const signer = writer && fediverseEnabled(writer) ? signerFor(writer) : null

  let key
  try {
    await assertPublicUrl(parsed.keyId)
    key = await fetchKey(parsed.keyId, signer)
  } catch (error) {
    // A deleted account's key is gone with it. Its "I'm gone" can't be
    // checked, but acting on it only removes follows, which is harmless.
    if (activity.type === 'Delete' && idOf(activity.object) === actor && (error?.status === 404 || error?.status === 410)) {
      await removeActorEverywhere(actor)
      return { status: 202, body: { ok: true } }
    }
    if (error instanceof InboxError) throw error
    throw new InboxError(error instanceof RemoteError ? `Couldn’t fetch the key: ${error.message}` : 'Couldn’t fetch the key', 401)
  }

  const verify = k =>
    verifyRequestSignature({ method: req.method || 'POST', paths: requestPaths(req, uid), headers, rawBody: raw, parsed, publicKeyPem: k.pem, now })
  try {
    verify(key)
  } catch (error) {
    if (!(error instanceof SignatureError)) throw error
    // Keys rotate: try a fresh copy once.
    let fresh
    try {
      fresh = await fetchKey(parsed.keyId, signer, { fresh: true })
    } catch (_) {
      throw new InboxError(error.message, 401)
    }
    try {
      verify(fresh)
      key = fresh
    } catch (again) {
      throw new InboxError(again.message, 401)
    }
  }
  if (key.owner !== actor) throw new InboxError('Signed by someone else', 401)

  switch (activity.type) {
    case 'Follow': {
      const target = idOf(activity.object)
      if (!writer || !fediverseEnabled(writer) || target !== actorUrl(writer.id)) throw new InboxError('No such actor', 404)
      const inbox = typeof key.actor?.inbox === 'string' ? key.actor.inbox : null
      if (!inbox) throw new InboxError('The follower has no inbox', 400)
      await assertPublicUrl(inbox)
      const shared = typeof key.actor?.endpoints?.sharedInbox === 'string' ? key.actor.endpoints.sharedInbox : null
      if (shared) await assertPublicUrl(shared)
      await addFollower(writer.id, { actor, inbox, sharedInbox: shared, followId: idOf(activity) }, { now })
      const follow = { id: idOf(activity), type: 'Follow', actor, object: target }
      await deliver(writer, acceptActivity(writer, follow), [inbox], { budgetMs: 6000 })
      return { status: 202, body: { ok: true } }
    }
    case 'Undo': {
      const inner = activity.object
      if (inner && typeof inner === 'object' && inner.type === 'Follow') {
        if (idOf(inner.actor) && idOf(inner.actor) !== actor) throw new InboxError('Not theirs to undo', 403)
        const targetWriter = uidFromActorUrl(idOf(inner.object))
        if (targetWriter) await removeFollower(targetWriter, actor)
      } else if (typeof inner === 'string') {
        // Only the Follow's id: find it among this actor's follows.
        const snapshot = await firestore.collection('fediverseFollowers').where('actor', '==', actor).get()
        await Promise.all(snapshot.docs.filter(doc => doc.data().followId === inner).map(doc => doc.ref.delete()))
      }
      return { status: 202, body: { ok: true } }
    }
    case 'Delete': {
      if (idOf(activity.object) === actor) await removeActorEverywhere(actor)
      return { status: 202, body: { ok: true } }
    }
    default:
      return { status: 202, body: { ok: true, ignored: activity.type } }
  }
}

/** Route handler shared by the personal and shared inboxes. */
export async function inboxHandler(req, res, { uid = null } = {}) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const { status, body } = await processInbox(req, { uid })
    return res.status(status).json(body)
  } catch (error) {
    if (error instanceof InboxError) return res.status(error.status).json({ error: error.message })
    console.error('Fediverse inbox failed:', error)
    return res.status(500).json({ error: 'Inbox error' })
  }
}

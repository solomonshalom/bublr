import { firestore } from '../firebase'
import { actorPrivateKey, actorPublicKeyPem, fediverseEnabled } from './actor-keys'
import { keyIdFor, objectUrl } from './config'
import { deliveryInboxes, listFollowers, removeFollowersAt } from './followers'
import { actorDeleteActivity, actorUpdateActivity, articleHash, buildActor, buildArticle, deleteActivity, wrap } from './objects'
import { postActivity } from './remote'

/**
 * Sending a writer's posts to their fediverse followers.
 *
 * Publishing sends a Create, an edit an Update (only when what followers see
 * changed), unpublishing or deleting a Delete. What was sent is kept on the
 * post as `fediverse: { gen, live, hash, at }`; `gen` moves on after a Delete
 * so a post published again gets a fresh object id (Mastodon refuses ids it
 * has seen deleted).
 *
 * Delivery is one signed POST per follower server (shared inboxes), a few at
 * a time, within a time budget, so publishing never waits long. A server that
 * is down misses that one activity; the post stays on the writer's profile and
 * in their outbox. A server that answers 410 Gone loses its followers.
 */

const CONCURRENCY = 8
const BUDGET_MS = 9000

export function signerFor(user) {
  const privateKeyPem = actorPrivateKey(user)
  return privateKeyPem ? { keyId: keyIdFor(user.id), privateKeyPem } : null
}

/** POST an activity to these inboxes. Returns { delivered, failed }. */
export async function deliver(user, activity, inboxes, { budgetMs = BUDGET_MS } = {}) {
  const signer = signerFor(user)
  if (!signer || !inboxes.length) return { delivered: 0, failed: 0 }
  const started = Date.now()
  const queue = [...inboxes]
  let delivered = 0
  let failed = 0
  const gone = []
  async function worker() {
    while (queue.length) {
      if (Date.now() - started > budgetMs) {
        failed += queue.length
        queue.length = 0
        return
      }
      const inbox = queue.shift()
      try {
        const status = await postActivity(inbox, activity, { signer })
        if (status >= 200 && status < 300) delivered++
        else {
          failed++
          if (status === 410) gone.push(inbox)
        }
      } catch (error) {
        failed++
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, inboxes.length) }, worker))
  for (const inbox of gone) await removeFollowersAt(user.id, inbox).catch(() => {})
  if (failed) console.warn(`Fediverse: ${activity.type} for ${user.id} reached ${delivered}/${inboxes.length} servers`)
  return { delivered, failed }
}

async function toFollowers(user, activity) {
  const inboxes = deliveryInboxes(await listFollowers(user.id))
  return deliver(user, activity, inboxes)
}

async function loadAuthor(uid) {
  const snapshot = await firestore.collection('users').doc(uid).get()
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null
}

/**
 * Bring the fediverse up to date with a post: Create, Update or Delete as
 * needed. Safe to call after any change; it sends nothing if nothing
 * followers see has changed. Never throws.
 */
export async function federatePost(postId, { post: given = null, author: givenAuthor = null } = {}) {
  try {
    const postRef = firestore.collection('posts').doc(postId)
    let post = given
    if (!post) {
      const snapshot = await postRef.get()
      if (!snapshot.exists) return { sent: null }
      post = { id: snapshot.id, ...snapshot.data() }
    }
    const author = givenAuthor || (await loadAuthor(post.author))
    if (!author || !fediverseEnabled(author)) return { sent: null }

    const state = post.fediverse && typeof post.fediverse === 'object' ? post.fediverse : {}
    const gen = Number.isInteger(state.gen) && state.gen >= 0 ? state.gen : 0
    const live = state.live === true

    // Gone from the web: take it off the fediverse.
    if (!post.published || !post.slug) {
      if (!live) return { sent: null }
      const result = await toFollowers(author, deleteActivity(objectUrl(postId, gen), author))
      await postRef.update({ fediverse: { gen: gen + 1, live: false, hash: null, at: Date.now() } }).catch(() => {})
      return { sent: 'Delete', ...result }
    }

    const article = buildArticle(post, author, { postId, gen })
    const hash = articleHash(article)
    if (live && state.hash === hash) return { sent: null }

    const kind = live ? 'Update' : 'Create'
    // Record first, so two saves at once don't both send a Create.
    await postRef.update({ fediverse: { gen, live: true, hash, at: Date.now() } })
    const result = await toFollowers(author, wrap(kind, article, author))
    return { sent: kind, ...result }
  } catch (error) {
    console.error('Fediverse: could not federate post', postId, error?.message)
    return { sent: null, error: true }
  }
}

/** A post is being deleted: send a Delete if it was ever sent. Call before deleting it. */
export async function federatePostDeleted(post, author) {
  try {
    const state = post?.fediverse
    if (!state?.live || !author || !fediverseEnabled(author)) return { sent: null }
    const gen = Number.isInteger(state.gen) ? state.gen : 0
    const result = await toFollowers(author, deleteActivity(objectUrl(post.id, gen), author))
    return { sent: 'Delete', ...result }
  } catch (error) {
    console.error('Fediverse: could not send a Delete', error?.message)
    return { sent: null, error: true }
  }
}

/** The writer changed their name, bio or picture. */
export async function federateProfile(user) {
  try {
    if (!fediverseEnabled(user)) return { sent: null }
    const publicKeyPem = actorPublicKeyPem(user)
    if (!publicKeyPem) return { sent: null }
    const actor = buildActor(user, { publicKeyPem })
    return { sent: 'Update', ...(await toFollowers(user, actorUpdateActivity(user, actor))) }
  } catch (error) {
    console.error('Fediverse: could not send a profile update', error?.message)
    return { sent: null, error: true }
  }
}

/**
 * The writer left the fediverse (turned it off, or deleted their account):
 * tell every follower's server the account is gone. Needs the key, so call it
 * before removing it.
 */
export async function federateAccountGone(user) {
  try {
    if (!user?.fediverse?.keySealed) return { sent: null }
    return { sent: 'Delete', ...(await toFollowers(user, actorDeleteActivity(user))) }
  } catch (error) {
    console.error('Fediverse: could not send the account Delete', error?.message)
    return { sent: null, error: true }
  }
}

/** Forget what was sent for each of the writer's posts (after leaving the fediverse). */
export async function resetPostsFederation(uid) {
  const snapshot = await firestore.collection('posts').where('author', '==', uid).get()
  await Promise.all(
    snapshot.docs
      .filter(doc => doc.data().fediverse?.live)
      .map(doc => {
        const gen = Number.isInteger(doc.data().fediverse.gen) ? doc.data().fediverse.gen : 0
        return doc.ref.update({ fediverse: { gen: gen + 1, live: false, hash: null, at: Date.now() } }).catch(() => {})
      })
  )
}

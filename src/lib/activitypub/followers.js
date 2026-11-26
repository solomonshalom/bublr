import { firestore } from '../firebase'
import { hashId } from '../secret-box'

/**
 * Fediverse followers, one document per (writer, remote actor) in the
 * `fediverseFollowers` collection, so a writer's follower count isn't
 * limited by the size of their user document:
 *
 *   { uid, actor, inbox, sharedInbox, followId, followedAt }
 *
 * The list itself is never shown publicly (the followers collection only
 * gives a count). Like every collection the API routes write to, the
 * Firestore rules must let the server read and write it.
 */

export const FOLLOWERS = 'fediverseFollowers'

const docId = (uid, actor) => hashId(`${uid}|${actor}`)

export async function addFollower(uid, { actor, inbox, sharedInbox = null, followId = null }, { now = Date.now() } = {}) {
  await firestore.collection(FOLLOWERS).doc(docId(uid, actor)).set({
    uid,
    actor,
    inbox,
    sharedInbox: sharedInbox || null,
    followId: followId || null,
    followedAt: now,
  })
}

export async function removeFollower(uid, actor) {
  await firestore.collection(FOLLOWERS).doc(docId(uid, actor)).delete()
}

export async function isFollower(uid, actor) {
  return (await firestore.collection(FOLLOWERS).doc(docId(uid, actor)).get()).exists
}

export async function listFollowers(uid) {
  const snapshot = await firestore.collection(FOLLOWERS).where('uid', '==', uid).get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function followerCount(uid) {
  return (await firestore.collection(FOLLOWERS).where('uid', '==', uid).get()).size
}

/** A remote account was deleted: it follows nobody here any more. */
export async function removeActorEverywhere(actor) {
  const snapshot = await firestore.collection(FOLLOWERS).where('actor', '==', actor).get()
  await Promise.all(snapshot.docs.map(doc => doc.ref.delete()))
  return snapshot.docs.length
}

/** Followers whose inbox (or shared inbox) is gone for good. */
export async function removeFollowersAt(uid, inbox) {
  const followers = await listFollowers(uid)
  const gone = followers.filter(f => f.inbox === inbox || f.sharedInbox === inbox)
  await Promise.all(gone.map(f => firestore.collection(FOLLOWERS).doc(f.id).delete()))
  return gone.length
}

export async function removeAllFollowers(uid) {
  const snapshot = await firestore.collection(FOLLOWERS).where('uid', '==', uid).get()
  for (let i = 0; i < snapshot.docs.length; i += 40) {
    await Promise.all(snapshot.docs.slice(i, i + 40).map(doc => doc.ref.delete()))
  }
  return snapshot.docs.length
}

/** Where to deliver to reach every follower once: shared inboxes where there are any. */
export function deliveryInboxes(followers) {
  return [...new Set(followers.map(f => f.sharedInbox || f.inbox).filter(Boolean))]
}

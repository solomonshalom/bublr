import firebase, { firestore } from './firebase'

/**
 * Deleting an account: everything a writer made on Bublr goes with them.
 *
 * `deleteAccountData(uid)` removes the user's posts and drafts, profile,
 * subscriber list, API keys, guest book, notifications, follows and likes.
 * Every step can be run again safely, and the profile document goes last, so
 * a request that died halfway can simply be repeated.
 *
 * The Firebase sign-in record itself is removed by the browser afterwards
 * (`user.delete()`); API routes have no admin credentials to do it.
 */

export const DELETE_CONFIRM_PHRASE = 'delete my account'

// How recently the caller must have signed in. Deleting everything is not
// something a token left open in an old tab should be able to do.
export const RECENT_SIGN_IN_SECONDS = 10 * 60

const CHUNK = 40

async function inChunks(items, fn) {
  for (let i = 0; i < items.length; i += CHUNK) {
    await Promise.all(items.slice(i, i + CHUNK).map(fn))
  }
}

async function deleteQuery(query) {
  const snapshot = await query.get()
  await inChunks(snapshot.docs, doc => doc.ref.delete())
  return snapshot.docs.length
}

// Optional clean-up: a failure here must not stop the account being deleted.
async function bestEffort(label, fn) {
  try {
    return await fn()
  } catch (error) {
    console.error(`Account deletion: ${label} failed:`, error)
    return 0
  }
}

/**
 * A paid subscription that will renew has to be cancelled first, otherwise
 * the writer would keep being charged with no account left to manage it from.
 */
export function hasRenewingSubscription(user) {
  const subscription = user?.subscription
  if (!subscription) return false
  if (!['active', 'trialing'].includes(subscription.status)) return false
  return !subscription.cancelAtPeriodEnd
}

async function removeDomainFromVercel(domain) {
  const { VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID } = process.env
  if (!domain || !VERCEL_TOKEN || !VERCEL_PROJECT_ID) return
  const base = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${encodeURIComponent(domain)}`
  const url = VERCEL_TEAM_ID ? `${base}?teamId=${encodeURIComponent(VERCEL_TEAM_ID)}` : base
  await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } })
}

export async function deleteAccountData(uid) {
  if (!uid || typeof uid !== 'string') throw new Error('deleteAccountData needs a uid')

  const userRef = firestore.collection('users').doc(uid)
  const userDoc = await userRef.get()
  const user = userDoc.exists ? userDoc.data() : {}

  // 1. Posts and drafts. Queried by author, so posts missing from the
  //    profile's list are found too.
  const posts = await deleteQuery(firestore.collection('posts').where('author', '==', uid))

  // 2. API keys stop working at once.
  const keyHashes = (Array.isArray(user.apiKeys) ? user.apiKeys : []).map(k => k?.keyHash).filter(Boolean)
  await inChunks(keyHashes, hash => firestore.collection('apiKeyLookup').doc(hash).delete())

  // 3. The custom domain goes back to its owner.
  await bestEffort('custom domain', () => removeDomainFromVercel(user.customDomain?.domain))

  // 4. Guest book entries left on this profile.
  await bestEffort('guest book', () => deleteQuery(userRef.collection('guestbook')))

  // 5. Notifications: the ones this writer received, and the ones carrying
  //    their name and picture in other people's lists.
  await bestEffort('notifications received', () =>
    deleteQuery(firestore.collection('notifications').where('recipientId', '==', uid))
  )
  await bestEffort('notifications sent', () =>
    deleteQuery(firestore.collection('notifications').where('actorId', '==', uid))
  )

  // 6. Follows, on both sides.
  const { arrayRemove, increment } = firebase.firestore.FieldValue
  const unlink = (ids, field) =>
    inChunks(
      (Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && id && id !== uid),
      id => firestore.collection('users').doc(id).update({ [field]: arrayRemove(uid) }).catch(() => {})
    )
  await bestEffort('following', () => unlink(user.following, 'followers'))
  await bestEffort('followers', () => unlink(user.followers, 'following'))

  // 7. Likes this writer gave to other people's posts.
  await bestEffort('likes', async () => {
    const liked = await firestore.collection('posts').where('likedBy', 'array-contains', uid).get()
    await inChunks(liked.docs, doc => {
      const count = doc.data().likes
      return doc.ref.update({
        likedBy: arrayRemove(uid),
        ...(typeof count === 'number' && count > 0 ? { likes: increment(-1) } : {}),
      })
    })
  })

  // 8. Last: the profile itself (name, email, bio, subscriber list, billing ids).
  await userRef.delete()

  return { posts, hadProfile: userDoc.exists }
}

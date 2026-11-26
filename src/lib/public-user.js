/**
 * What of a user's record is safe to put in a public page's props.
 *
 * Page props are serialized into the HTML (and, for statically generated
 * pages, into cached JSON), so everything in them is readable by anyone. The
 * profile and post pages used to pass the whole Firestore user document,
 * which shipped every newsletter subscriber's email address, the writer's own
 * email, API key hashes, billing IDs and their custom newsletter template to
 * every visitor.
 */

import { normalizeGallery } from './gallery'
import { normalizeMusic } from './music'
import { toPublicProduct } from './shop'
import { hasVerifiedShopAccess, trustedProducts } from './shop-trust'
import { publicPaidPlan } from './paid-newsletter'
import { fediverseHandle } from './activitypub/actor-keys'
import { actorUrl } from './activitypub/config'

// Never leave the server
const PRIVATE_USER_FIELDS = [
  'email',
  'apiKeys',
  'newsletterTemplate',
  'readingList',
  'subscription',
  'subscribers',
  'followers',
  'following',
  // Sealed payment key and Spotify tokens; paid orders with buyer details;
  // the raw catalogue (it holds sealed download links). Products go out
  // through `shopProducts` instead.
  'integrations',
  'shopOrders',
  'shop',
  // Signed paid newsletter settings (readers get `paidPlan` instead) and the
  // fediverse signing key (sealed).
  'paidNewsletter',
  'fediverse',
]

// Post fields readers don't need (who liked it, moderation bookkeeping, the
// private draft link)
const PRIVATE_POST_FIELDS = [
  'shareToken',
  'likedBy',
  'searchQueries',
  'moderationReason',
  'moderationCategory',
  'moderatedAt',
  'announcedAt',
  'newsletterSentAt',
  // A paid post's whole body (sealed; `content` is the free preview) and the
  // fediverse delivery bookkeeping.
  'paidContentSealed',
  'fediverse',
]

const count = value => (Array.isArray(value) ? value.length : 0)

export function toPublicPost(post) {
  if (!post || typeof post !== 'object') return post
  const out = { ...post }
  for (const field of PRIVATE_POST_FIELDS) delete out[field]
  return out
}

/**
 * Public view of a profile. Follower/following/subscriber lists become counts,
 * the custom domain keeps only what the page shows, and published posts lose
 * reader-private fields.
 */
export function toPublicUser(user) {
  if (!user || typeof user !== 'object') return user
  const out = { ...user }
  for (const field of PRIVATE_USER_FIELDS) delete out[field]

  out.followerCount = count(user.followers)
  out.followingCount = count(user.following)
  out.subscriberCount = Array.isArray(user.subscribers) ? user.subscribers.filter(s => !(s && s.pending === true)).length : 0

  if (user.customDomain) {
    out.customDomain = {
      domain: user.customDomain.domain || null,
      status: user.customDomain.status || null,
    }
  }

  if (Array.isArray(user.posts)) {
    out.posts = user.posts.map(p => (p && typeof p === 'object' ? toPublicPost(p) : p))
  }

  // Profile blocks. The shop shows only while the Pro + Shop plan is active.
  out.gallery = normalizeGallery(user.gallery)
  out.music = normalizeMusic(user.music)
  out.musicLive = out.music.mode === 'spotify' && user.integrations?.spotify?.status === 'connected'
  out.shopProducts = hasVerifiedShopAccess(user)
    ? trustedProducts(user).filter(p => p && p.active !== false && p.title).map(toPublicProduct)
    : []
  delete out.shopGrant

  // Paid newsletter: prices and what paid subscribers get, if it's on.
  out.paidPlan = user.id ? publicPaidPlan(user) : null
  // @name@bublr.life, when the writer lets people follow them from the fediverse.
  out.fediverseHandle = fediverseHandle(user)
  out.fediverseActor = out.fediverseHandle && user.id ? actorUrl(user.id) : null

  return out
}

/** Just enough of the author for a post byline. */
export function toPostAuthor(user) {
  if (!user) return { name: '', displayName: '', photo: '' }
  return {
    name: user.name || '',
    displayName: user.displayName || user.name || '',
    photo: user.photo || '',
  }
}

/**
 * The end-of-post newsletter sign-up. It follows the writer's profile
 * setting: if they hid the newsletter button there, posts hide it too.
 */
export function toPostNewsletter(user) {
  const enabled = !!user && user.buttonsVisibility?.newsletter !== false
  const buttonText = enabled && typeof user.newsletterButtonText === 'string'
    ? user.newsletterButtonText.trim().slice(0, 100)
    : ''
  return { enabled, buttonText }
}

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

// Never leave the server
const PRIVATE_USER_FIELDS = [
  'email',
  'apiKeys',
  'newsletterTemplate',
  'readingList',
  'subscription',
  'pendingCheckout',
  'subscribers',
  'followers',
  'following',
]

// Post fields readers don't need (who liked it, moderation bookkeeping)
const PRIVATE_POST_FIELDS = [
  'likedBy',
  'searchQueries',
  'moderationReason',
  'moderationCategory',
  'moderatedAt',
  'announcedAt',
  'newsletterSentAt',
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
  out.subscriberCount = count(user.subscribers)

  if (user.customDomain) {
    out.customDomain = {
      domain: user.customDomain.domain || null,
      status: user.customDomain.status || null,
    }
  }

  if (Array.isArray(user.posts)) {
    out.posts = user.posts.map(p => (p && typeof p === 'object' ? toPublicPost(p) : p))
  }

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

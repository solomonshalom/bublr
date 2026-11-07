import { firestore } from './firebase'
import { resolveHost } from './custom-domains'
import { baseUrl } from './app-url'

/**
 * What to do with a request, given its Host header and the first path
 * segment (`segment` is null for "/"). On a writer's domain:
 *
 *   /               their profile
 *   /<post-slug>    that post (clean URLs, no /<username> prefix)
 *   /<username>     -> /   (their own name)
 *   anything else   404
 *
 * If their Pro has lapsed, readers are sent to the same page on bublr.life,
 * so links keep working. Hosts we don't know go to bublr.life.
 *
 * @returns {Promise<
 *   { kind: 'platform' } |
 *   { kind: 'redirect', destination: string } |
 *   { kind: 'profile', host: string, owner: object } |
 *   { kind: 'post', host: string, owner: object, post: object } |
 *   { kind: 'not-found' }
 * >}
 */
export async function routeCustomDomain(rawHost, segment = null) {
  const match = await resolveHost(rawHost)
  if (match.kind === 'platform') return { kind: 'platform' }

  const base = baseUrl()
  const path = segment ? `/${encodeURIComponent(segment)}` : '/'

  if (match.kind === 'unknown') {
    return { kind: 'redirect', destination: `${base}${path}` }
  }

  const owner = match.user
  const ownerPath = `/${encodeURIComponent(owner.name || '')}`

  if (match.kind === 'inactive') {
    if (!segment) return { kind: 'redirect', destination: `${base}${ownerPath}` }
    const post = await findPublishedPost(owner.id, segment)
    return { kind: 'redirect', destination: post ? `${base}${ownerPath}${path}` : `${base}${ownerPath}` }
  }

  // www <-> apex partner: send readers to the domain the writer chose
  if (match.viaCompanion) {
    return { kind: 'redirect', destination: `https://${match.primary}${path}` }
  }

  if (!segment) return { kind: 'profile', host: match.primary, owner }

  const post = await findPublishedPost(owner.id, segment)
  if (post) return { kind: 'post', host: match.primary, owner, post }
  if (segment === owner.name) return { kind: 'redirect', destination: '/' }
  return { kind: 'not-found' }
}

/** A writer's published post by slug, or null. */
export async function findPublishedPost(authorId, slug) {
  if (!authorId || !slug) return null
  const snap = await firestore
    .collection('posts')
    .where('author', '==', authorId)
    .where('slug', '==', slug)
    .limit(5)
    .get()
  const doc = snap.docs.find(d => d.data().published)
  return doc ? { id: doc.id, ...doc.data() } : null
}

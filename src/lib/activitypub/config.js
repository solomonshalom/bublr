/**
 * Addresses for Bublr on the fediverse (ActivityPub).
 *
 * Writers are followed as @name@bublr.life. bublr.life answers every request
 * with a redirect to www.bublr.life, and fediverse servers expect an actor's
 * address to answer directly (and sign requests for the exact host), so the
 * ActivityPub URLs live on www.bublr.life while handles stay @name@bublr.life.
 * Mastodon resolves that split through WebFinger, which answers on both.
 *
 *   FEDIVERSE_ORIGIN   where ActivityPub is served (default: www.bublr.life,
 *                      or NEXT_PUBLIC_BASE_URL when that isn't bublr.life)
 *   FEDIVERSE_DOMAIN   the domain in handles (default: FEDIVERSE_ORIGIN's
 *                      host without "www.")
 *
 * Actors are keyed by the writer's uid, not their username, so changing a
 * username doesn't break anyone's follow.
 */

export const AS_CONTEXT = 'https://www.w3.org/ns/activitystreams'
export const SECURITY_CONTEXT = 'https://w3id.org/security/v1'
export const AS_PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'
export const ACTIVITY_JSON = 'application/activity+json'
export const AP_CONTENT_TYPE = 'application/activity+json; charset=utf-8'
export const AP_ACCEPT = 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"'

const trim = value => String(value || '').replace(/\/+$/, '')

/** Where people read Bublr (posts and profiles). */
export function siteOrigin() {
  return trim(process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life')
}

/** Where ActivityPub is served. */
export function apOrigin() {
  if (process.env.FEDIVERSE_ORIGIN) return trim(process.env.FEDIVERSE_ORIGIN)
  const site = siteOrigin()
  return site === 'https://bublr.life' ? 'https://www.bublr.life' : site
}

/** The domain in @name@domain handles. */
export function handleDomain() {
  if (process.env.FEDIVERSE_DOMAIN) return String(process.env.FEDIVERSE_DOMAIN).toLowerCase()
  return new URL(apOrigin()).hostname.replace(/^www\./, '').toLowerCase()
}

/** Domains a WebFinger acct: may name for a local writer. */
export function localDomains() {
  const hosts = new Set([handleDomain(), new URL(apOrigin()).host.toLowerCase(), new URL(siteOrigin()).host.toLowerCase()])
  return [...hosts]
}

const base = () => `${apOrigin()}/api/activitypub`

export const actorUrl = uid => `${base()}/users/${encodeURIComponent(uid)}`
export const keyIdFor = uid => `${actorUrl(uid)}#main-key`
export const inboxUrl = uid => `${actorUrl(uid)}/inbox`
export const outboxUrl = uid => `${actorUrl(uid)}/outbox`
export const followersUrl = uid => `${actorUrl(uid)}/followers`
export const followingUrl = uid => `${actorUrl(uid)}/following`
export const sharedInboxUrl = () => `${base()}/inbox`

/**
 * A post's object id. `gen` goes up every time the post leaves the fediverse
 * (unpublished): Mastodon remembers deleted ids and won't accept one again,
 * so publishing it again needs a new one.
 */
export const objectUrl = (postId, gen = 0) => `${base()}/posts/${encodeURIComponent(postId)}${gen > 0 ? `/${gen}` : ''}`

/** The uid in one of our actor URLs, or null. */
export function uidFromActorUrl(url) {
  const prefix = `${base()}/users/`
  if (typeof url !== 'string' || !url.startsWith(prefix)) return null
  const rest = url.slice(prefix.length).split(/[/#?]/)[0]
  try {
    return decodeURIComponent(rest) || null
  } catch (_) {
    return null
  }
}

/** Whether a request asks for ActivityPub JSON rather than a web page. */
export function wantsActivityJson(req) {
  const accept = String(req?.headers?.accept || '')
  return /application\/(activity\+json|ld\+json)/i.test(accept)
}

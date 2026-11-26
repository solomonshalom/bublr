import crypto from 'crypto'
import { htmlToText } from 'html-to-text'
import { escapeHtml } from '../escape'
import { sanitizePostHtml } from '../sanitize-post'
import { isPaidPost } from '../paid-content'
import { toMillis } from '../timestamps'
import {
  AS_CONTEXT,
  AS_PUBLIC,
  SECURITY_CONTEXT,
  actorUrl,
  followersUrl,
  followingUrl,
  handleDomain,
  inboxUrl,
  keyIdFor,
  objectUrl,
  outboxUrl,
  sharedInboxUrl,
  siteOrigin,
} from './config'

/**
 * The ActivityPub documents Bublr serves and sends: a writer as a Person, a
 * post as an Article, and the activities that announce them. Pure functions
 * of the user and post records.
 */

const ACTOR_CONTEXT = [
  AS_CONTEXT,
  SECURITY_CONTEXT,
  {
    manuallyApprovesFollowers: 'as:manuallyApprovesFollowers',
    toot: 'http://joinmastodon.org/ns#',
    discoverable: 'toot:discoverable',
    indexable: 'toot:indexable',
    attributionDomains: { '@id': 'toot:attributionDomains', '@type': '@id' },
    schema: 'http://schema.org#',
    PropertyValue: 'schema:PropertyValue',
    value: 'schema:value',
  },
]

const plain = html => htmlToText(String(html || ''), { wordwrap: false, selectors: [{ selector: 'a', options: { ignoreHref: true } }] }).trim()

/** Where people read the writer: their own domain when it's set up, otherwise Bublr. */
export function profileUrl(user) {
  if (user?.customDomain?.status === 'verified' && user.customDomain.domain) return `https://${user.customDomain.domain}`
  return `${siteOrigin()}/${encodeURIComponent(user.name)}`
}

export const postUrl = (user, post) => `${siteOrigin()}/${encodeURIComponent(user.name)}/${encodeURIComponent(post.slug)}`

// Fediverse servers don't take SVG avatars (DiceBear's default): ask for PNG.
function imageUrl(url) {
  if (typeof url !== 'string' || !/^https:\/\//.test(url)) return null
  if (/^https:\/\/api\.dicebear\.com\/[^/]+\/[^/]+\/svg/.test(url)) return url.replace(/\/svg(\?|$)/, '/png$1')
  return url
}

const mediaType = url => (/\.png(\?|$)|\/png(\?|$)/i.test(url) ? 'image/png' : /\.webp(\?|$)/i.test(url) ? 'image/webp' : /\.gif(\?|$)/i.test(url) ? 'image/gif' : 'image/jpeg')

export function buildActor(user, { publicKeyPem }) {
  const id = actorUrl(user.id)
  const icon = imageUrl(user.photo)
  const website = typeof user.link === 'string' && /^https?:\/\//.test(user.link) ? user.link : null
  const domains = [handleDomain(), user.customDomain?.status === 'verified' ? user.customDomain.domain : null].filter(Boolean)
  return {
    '@context': ACTOR_CONTEXT,
    id,
    type: 'Person',
    preferredUsername: user.name,
    name: user.displayName || user.name,
    summary: user.about ? `<p>${escapeHtml(String(user.about).slice(0, 2000)).replace(/\n+/g, '</p><p>')}</p>` : '',
    url: profileUrl(user),
    inbox: inboxUrl(user.id),
    outbox: outboxUrl(user.id),
    followers: followersUrl(user.id),
    following: followingUrl(user.id),
    endpoints: { sharedInbox: sharedInboxUrl() },
    manuallyApprovesFollowers: false,
    discoverable: true,
    indexable: true,
    attributionDomains: domains,
    ...(icon ? { icon: { type: 'Image', mediaType: mediaType(icon), url: icon } } : {}),
    ...(website
      ? { attachment: [{ type: 'PropertyValue', name: 'Website', value: `<a href="${escapeHtml(website)}" rel="me nofollow noopener noreferrer" target="_blank">${escapeHtml(website.replace(/^https?:\/\//, ''))}</a>` }] }
      : {}),
    publicKey: { id: keyIdFor(user.id), owner: id, publicKeyPem },
  }
}

/** The text that goes to the fediverse for a post: the whole post, or a paid post's free preview and a link. */
export function federatedContent(post, user) {
  const url = postUrl(user, post)
  if (!isPaidPost(post)) return sanitizePostHtml(post.content || '')
  const preview = sanitizePostHtml(post.content || '')
  return `${preview}<p><em>This post is for paid subscribers.</em> <a href="${escapeHtml(url)}">Read it on Bublr</a></p>`
}

export function buildArticle(post, user, { postId = post.id, gen = 0 } = {}) {
  const url = postUrl(user, post)
  const title = plain(post.title) || 'Untitled'
  const excerpt = plain(post.excerpt)
  const published = toMillis(post.announcedAt) || toMillis(post.moderatedAt) || toMillis(post.lastEdited) || Date.now()
  const updated = toMillis(post.lastEdited) || published
  const image = (String(post.content || '').match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i) || [])[1] || null
  return {
    '@context': AS_CONTEXT,
    id: objectUrl(postId, gen),
    type: 'Article',
    attributedTo: actorUrl(user.id),
    name: title,
    summary: excerpt ? escapeHtml(excerpt.slice(0, 500)) : null,
    content: federatedContent(post, user),
    mediaType: 'text/html',
    url,
    published: new Date(published).toISOString(),
    ...(updated > published + 60 * 1000 ? { updated: new Date(updated).toISOString() } : {}),
    to: [AS_PUBLIC],
    cc: [followersUrl(user.id)],
    ...(image ? { image: { type: 'Image', url: image } } : {}),
  }
}

const activityId = (user, kind, objectId) =>
  `${actorUrl(user.id)}#${kind}/${crypto.createHash('sha256').update(`${objectId}|${Date.now()}|${Math.random()}`).digest('hex').slice(0, 24)}`

export function wrap(kind, object, user) {
  return {
    '@context': AS_CONTEXT,
    id: kind === 'Create' ? `${object.id}#create` : activityId(user, kind.toLowerCase(), object.id || object),
    type: kind,
    actor: actorUrl(user.id),
    published: new Date().toISOString(),
    to: [AS_PUBLIC],
    cc: [followersUrl(user.id)],
    object,
  }
}

export function deleteActivity(objectId, user) {
  return {
    '@context': AS_CONTEXT,
    id: activityId(user, 'delete', objectId),
    type: 'Delete',
    actor: actorUrl(user.id),
    to: [AS_PUBLIC],
    cc: [followersUrl(user.id)],
    object: { id: objectId, type: 'Tombstone' },
  }
}

export function actorDeleteActivity(user) {
  const id = actorUrl(user.id)
  return { '@context': AS_CONTEXT, id: `${id}#delete`, type: 'Delete', actor: id, to: [AS_PUBLIC], object: id }
}

export function actorUpdateActivity(user, actor) {
  return { '@context': ACTOR_CONTEXT, id: activityId(user, 'update', actor.id), type: 'Update', actor: actor.id, to: [AS_PUBLIC], object: actor }
}

export function acceptActivity(user, follow) {
  return {
    '@context': AS_CONTEXT,
    id: activityId(user, 'accept', typeof follow === 'string' ? follow : follow.id || ''),
    type: 'Accept',
    actor: actorUrl(user.id),
    to: [typeof follow.actor === 'string' ? follow.actor : follow.actor?.id],
    object: follow,
  }
}

export function collection(id, totalItems, extra = {}) {
  return { '@context': AS_CONTEXT, id, type: 'OrderedCollection', totalItems, ...extra }
}

/** A hash of what was federated, to tell whether an edit needs an Update. */
export function articleHash(article) {
  return crypto.createHash('sha256').update(JSON.stringify([article.name, article.summary, article.content, article.url])).digest('base64url').slice(0, 22)
}

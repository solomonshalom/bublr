import { canSeal, open, seal } from './secret-box'

/**
 * Paid posts: "Paid subscribers" under Who can read, in the editor.
 *
 * Post documents can be read by anyone who has the (public) Firebase config,
 * so the body of a paid post can't simply sit in `content`. The server keeps
 * it sealed instead (lib/secret-box, bound to the writer and the post), and
 * `content` holds only the free preview: everything above the paywall line,
 * or nothing when there's no line. Every page, feed, API, search index and
 * email that reads `content` therefore shows the preview and nothing more.
 * The full post is opened only for the writer and for their paying readers.
 *
 *   access              'paid' | absent (everyone)
 *   content             the free preview (HTML)
 *   paidContentSealed   the whole post, sealed
 */

export const ACCESS_PAID = 'paid'
export const ACCESS_EVERYONE = 'everyone'

// What the editor's paywall line is saved as.
export const PAYWALL_HTML = '<div data-type="paywall"></div>'
const PAYWALL_RE = /<div\b[^>]*\bdata-type\s*=\s*(["'])paywall\1[^>]*>\s*(?:<\/div>)?/gi

export const MAX_POST_HTML = 900 * 1024 // a Firestore document holds 1 MiB in all

export class PaidContentError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'PaidContentError'
    this.status = status
  }
}

export const isPaidPost = post => Boolean(post) && post.access === ACCESS_PAID

export const paidContentContext = (uid, postId) => `${uid}:paid-post:${postId}`

export function hasPaywallLine(html) {
  PAYWALL_RE.lastIndex = 0
  return PAYWALL_RE.test(String(html || ''))
}

/** The free part of a paid post: what comes before the first paywall line. */
export function freePreview(html) {
  const text = typeof html === 'string' ? html : ''
  PAYWALL_RE.lastIndex = 0
  const match = PAYWALL_RE.exec(text)
  if (!match) return ''
  return text.slice(0, match.index).trim()
}

/** The post without its paywall line(s), for showing the whole thing. */
export function removePaywallLine(html) {
  return String(html || '').replace(PAYWALL_RE, '')
}

/**
 * What to write to a paid post's document for this body. Throws when the
 * server can't seal (no INTEGRATIONS_SECRET), so the body is never written
 * where anyone can read it.
 */
export function sealedFields(uid, postId, html) {
  if (!uid || !postId) throw new PaidContentError('A paid post needs its author and id', 500)
  const full = typeof html === 'string' ? html : ''
  if (full.length > MAX_POST_HTML) throw new PaidContentError('This post is too long to save.', 413)
  if (!canSeal()) throw new PaidContentError('Paid posts can’t be saved on this server yet (INTEGRATIONS_SECRET missing).', 500)
  return {
    content: freePreview(full),
    paidContentSealed: seal(full || '<p></p>', paidContentContext(uid, postId)),
  }
}

/**
 * The whole post, for the writer and for paying readers. For a post that
 * isn't paid it's just `content`. Returns null when a paid post's body is
 * there but can't be opened (the server's secret changed, or the document
 * was tampered with); callers must then refuse rather than show or save the
 * preview as if it were everything.
 *
 * `postId` defaults to `post.id` (documents read with an id field).
 */
export function fullContent(post, postId = post?.id) {
  if (!post) return null
  const plain = typeof post.content === 'string' ? post.content : ''
  if (!isPaidPost(post)) return plain
  // Marked paid without a sealed body (an older or hand-edited document):
  // `content` is the only copy there is.
  if (typeof post.paidContentSealed !== 'string' || !post.paidContentSealed) return plain
  try {
    return open(post.paidContentSealed, paidContentContext(post.author, postId))
  } catch (_) {
    return null
  }
}

/** What feeds carry for a post: a paid post's free preview, and a note that there's more. */
export function feedContent(post) {
  const html = typeof post?.content === 'string' ? post.content : ''
  if (!isPaidPost(post)) return html
  return `${html}<p><em>The rest of this post is for paid subscribers. Open it to read on.</em></p>`
}

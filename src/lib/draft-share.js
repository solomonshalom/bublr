import crypto from 'crypto'
import { firestore } from './firebase'
import { toPostAuthor } from './public-user'
import { toMillis } from './timestamps'
import { sanitizeFontFamily } from './fonts'

/**
 * Private links to unpublished drafts ("Share draft" in the editor).
 *
 * A writer can ask for a link to a draft so a friend or editor can read it
 * before it's published. The link is /draft/<token>, where the token is a
 * long random string saved on the post as `shareToken`. Anyone with the link
 * can read; nobody can guess it. Turning the link off deletes the token, and
 * a new link gets a new token, so an old link never comes back to life.
 */

const TOKEN_PATTERN = /^[a-f0-9]{48}$/

export function newShareToken() {
  return crypto.randomBytes(24).toString('hex')
}

export function isShareToken(value) {
  return typeof value === 'string' && TOKEN_PATTERN.test(value)
}

export function draftSharePath(token) {
  return `/draft/${token}`
}

/**
 * Everything the shared-draft page needs, or a redirect when the post has
 * since been published, or null when the link is unknown or turned off.
 *
 * Returns only what the page shows. The post's other fields (and the token's
 * owner record) stay on the server.
 */
export async function getSharedDraft(token) {
  if (!isShareToken(token)) return null

  const snapshot = await firestore.collection('posts').where('shareToken', '==', token).limit(1).get()
  if (snapshot.empty) return null

  const doc = snapshot.docs[0]
  const post = doc.data()
  if (!post || !post.author) return null

  const userDoc = await firestore.collection('users').doc(post.author).get()
  if (!userDoc.exists) return null
  const user = userDoc.data()

  // Once it's live, the private link just takes readers to the real post
  if (post.published) {
    if (!user.name || !post.slug) return null
    return { redirect: `/${user.name}/${post.slug}` }
  }

  const userFonts = user.fontSettings || {}
  const postFonts = post.fontOverrides || {}
  const fontSettings = {
    headingFont: sanitizeFontFamily(postFonts.headingFont || userFonts.headingFont, 'Inter'),
    bodyFont: sanitizeFontFamily(postFonts.bodyFont || userFonts.bodyFont, 'Inter'),
    codeFont: sanitizeFontFamily(postFonts.codeFont || userFonts.codeFont, 'JetBrains Mono'),
  }
  const defaultFonts = ['Inter', 'Newsreader', 'JetBrains Mono']
  const customFonts = [fontSettings.headingFont, fontSettings.bodyFont, fontSettings.codeFont]
    .filter(f => f && !defaultFonts.includes(f))
    .filter((f, i, arr) => arr.indexOf(f) === i)

  return {
    draft: {
      title: typeof post.title === 'string' ? post.title : '',
      content: typeof post.content === 'string' ? post.content : '',
      textDirection: post.textDirection || 'auto',
      lastEdited: toMillis(post.lastEdited) || null,
      author: toPostAuthor(user),
    },
    fontSettings,
    customFonts,
  }
}

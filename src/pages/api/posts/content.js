import firebase from '../../../lib/firebase'
import { requirePostOwner } from '../../../lib/post-owner'
import { MAX_POST_HTML, PaidContentError, fullContent, isPaidPost, savePostFields } from '../../../lib/paid-content'

/**
 * A post's body for its writer.
 *
 *   GET ?postId=      the whole post (for a paid post, its sealed body)
 *   PUT { postId, title?, excerpt?, content? }
 *                     save; a paid post's body is sealed and only its free
 *                     preview lands in `content` (lib/paid-content)
 *
 * The editor saves free posts straight to Firestore as before; paid posts
 * come through here so their body never sits in the open.
 */
export default async function handler(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  res.setHeader('Cache-Control', 'private, no-store')
  const postId = req.method === 'GET' ? req.query?.postId : req.body?.postId
  const owned = await requirePostOwner(req, res, postId)
  if (!owned) return
  const { uid, post } = owned

  try {
    if (req.method === 'GET') {
      const content = fullContent(post)
      if (content === null) {
        return res.status(500).json({
          error: 'This paid post can’t be opened right now, so it can’t be edited. Nothing has been lost; please try again later.',
          code: 'PAID_CONTENT_UNREADABLE',
        })
      }
      return res.status(200).json({ content, access: isPaidPost(post) ? 'paid' : 'everyone' })
    }

    const { title, excerpt, content } = req.body || {}
    const update = {}
    if (title !== undefined) {
      if (typeof title !== 'string' || title.length > 2000) return res.status(400).json({ error: 'Invalid title' })
      update.title = title
    }
    if (excerpt !== undefined) {
      if (typeof excerpt !== 'string' || excerpt.length > 5000) return res.status(400).json({ error: 'Invalid excerpt' })
      update.excerpt = excerpt
    }
    if (content !== undefined) {
      if (typeof content !== 'string' || content.length > MAX_POST_HTML) return res.status(413).json({ error: 'This post is too long to save.' })
      update.content = content
    }
    if (!Object.keys(update).length) return res.status(200).json({ saved: false })
    update.lastEdited = firebase.firestore.Timestamp.now()
    // Sealed if the post is paid when it's written, not when it was read
    await savePostFields(post.id, update, { uid })
    return res.status(200).json({ saved: true })
  } catch (error) {
    if (error instanceof PaidContentError) return res.status(error.status).json({ error: error.message })
    console.error('Post content failed:', error)
    return res.status(500).json({ error: 'Could not save the post' })
  }
}

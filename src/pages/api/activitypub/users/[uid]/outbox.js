import { firestore } from '../../../../../lib/firebase'
import { outboxUrl } from '../../../../../lib/activitypub/config'
import { enabledWriterById, sendActivityJson } from '../../../../../lib/activitypub/lookup'
import { buildArticle, collection, wrap } from '../../../../../lib/activitypub/objects'
import { toMillis } from '../../../../../lib/timestamps'

/**
 * A writer's published posts, newest first, as Create activities. Paid posts
 * show their free preview and a link, as everywhere else.
 */
const PAGE = 20

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const user = await enabledWriterById(String(req.query.uid || ''))
    if (!user) return sendActivityJson(res, 410, { error: 'Gone' })
    const snapshot = await firestore.collection('posts').where('author', '==', user.id).get()
    const posts = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(post => post.published && post.slug)
      .sort((a, b) => (toMillis(b.lastEdited) || 0) - (toMillis(a.lastEdited) || 0))
    const id = outboxUrl(user.id)
    const page = Math.max(0, Math.min(10000, parseInt(req.query.page, 10) || 0))
    if (!page) return sendActivityJson(res, 200, collection(id, posts.length, { first: `${id}?page=1`, last: `${id}?page=${Math.max(1, Math.ceil(posts.length / PAGE))}` }))
    const items = posts.slice((page - 1) * PAGE, page * PAGE).map(post => {
      const gen = Number.isInteger(post.fediverse?.gen) ? post.fediverse.gen : 0
      return wrap('Create', buildArticle(post, user, { postId: post.id, gen }), user)
    })
    return sendActivityJson(res, 200, {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${id}?page=${page}`,
      type: 'OrderedCollectionPage',
      partOf: id,
      totalItems: posts.length,
      orderedItems: items,
      ...(page * PAGE < posts.length ? { next: `${id}?page=${page + 1}` } : {}),
      ...(page > 1 ? { prev: `${id}?page=${page - 1}` } : {}),
    })
  } catch (error) {
    console.error('Fediverse outbox failed:', error)
    return res.status(500).json({ error: 'Outbox error' })
  }
}

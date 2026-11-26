import { followingUrl } from '../../../../../lib/activitypub/config'
import { enabledWriterById, sendActivityJson } from '../../../../../lib/activitypub/lookup'
import { collection } from '../../../../../lib/activitypub/objects'

// Writers don't follow anyone from Bublr.
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const user = await enabledWriterById(String(req.query.uid || '')).catch(() => null)
  if (!user) return sendActivityJson(res, 410, { error: 'Gone' })
  return sendActivityJson(res, 200, collection(followingUrl(user.id), 0, { orderedItems: [] }))
}

import { followersUrl } from '../../../../../lib/activitypub/config'
import { followerCount } from '../../../../../lib/activitypub/followers'
import { enabledWriterById, sendActivityJson } from '../../../../../lib/activitypub/lookup'
import { collection } from '../../../../../lib/activitypub/objects'

// Only the count: who follows a writer isn't published.
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const user = await enabledWriterById(String(req.query.uid || ''))
    if (!user) return sendActivityJson(res, 410, { error: 'Gone' })
    return sendActivityJson(res, 200, collection(followersUrl(user.id), await followerCount(user.id)))
  } catch (error) {
    console.error('Fediverse followers failed:', error)
    return res.status(500).json({ error: 'Followers error' })
  }
}

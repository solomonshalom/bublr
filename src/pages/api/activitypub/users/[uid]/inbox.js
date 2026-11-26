import { inboxHandler } from '../../../../../lib/activitypub/inbox'

// Activities other servers send to one writer (needs the raw body for its signature).
export const config = { api: { bodyParser: false } }

export default function handler(req, res) {
  return inboxHandler(req, res, { uid: String(req.query.uid || '') })
}

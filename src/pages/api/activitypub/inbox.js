import { inboxHandler } from '../../../lib/activitypub/inbox'

// The shared inbox: one delivery per server for all its users who follow Bublr writers.
export const config = { api: { bodyParser: false } }

export default function handler(req, res) {
  return inboxHandler(req, res, { uid: null })
}

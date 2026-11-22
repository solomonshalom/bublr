import { firestore } from '../../../lib/firebase'
import { getUserByID } from '../../../lib/db'
import { clientIp, isRateLimited } from '../../../lib/rate-limit'
import { buildProfileDocument, setFrameHeaders, summarizeProfileCode, frameUrl } from '../../../lib/profile-code'
import { hasValidSignature } from '../../../lib/profile-code-signature'
import { loadTemplateData, storedCode } from '../../../lib/profile-code-server'

/**
 * GET /api/profile-frame/<username>?embed=page|block&v=<version>
 *
 * A writer's Profile HTML as its own document, for the <iframe sandbox> on
 * their profile. The `Content-Security-Policy: sandbox` header gives it an
 * opaque origin even when opened directly, so the writer's scripts can never
 * act as bublr.life. Opening it as a page sends you to the profile instead.
 *
 * Only code saved through /api/profile/code (signed) is shown, and only at
 * its one canonical URL: any other query redirects there, so the CDN copy
 * serves everyone and junk query strings can't force fresh renders.
 */

const USERNAME = /^[A-Za-z0-9_.-]{1,64}$/
const FRAME_LIMIT = { max: 240, windowMs: 60 * 1000 }

function notFound(res, message) {
  setFrameHeaders(res)
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30')
  return res.status(404).send(`<!doctype html><meta charset="utf-8"><title>Not found</title><p>${message}</p>`)
}

async function findUser(username) {
  const snapshot = await firestore.collection('users').where('name', '==', username).limit(1).get()
  const doc = snapshot.docs[0]
  return doc && doc.exists ? { id: doc.id, ...doc.data() } : null
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const username = String(req.query.username || '')
  if (!USERNAME.test(username)) return notFound(res, 'No such profile.')

  // Browsers say what a request is for. Someone visiting the frame URL itself
  // gets the real profile, with Bublr's header and links around the page.
  if (req.headers['sec-fetch-dest'] === 'document') {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Location', `/${encodeURIComponent(username)}`)
    return res.status(302).end()
  }

  if (isRateLimited(`profile-frame:${clientIp(req)}`, FRAME_LIMIT)) {
    setFrameHeaders(res)
    res.setHeader('Retry-After', '60')
    return res.status(429).send('<!doctype html><meta charset="utf-8"><p>Too many requests.</p>')
  }

  try {
    const owner = await findUser(username)
    if (!owner) return notFound(res, 'No such profile.')

    const summary = summarizeProfileCode(owner.profileCode)
    if (!summary || summary.mode === 'off' || !hasValidSignature(owner.id, owner.profileCode)) {
      return notFound(res, 'This profile has no custom page.')
    }

    const embed = req.query.embed === 'block' ? 'block' : 'page'
    const extraKeys = Object.keys(req.query).filter(k => !['username', 'embed', 'v'].includes(k))
    if (req.query.embed !== embed || String(req.query.v) !== String(summary.version) || extraKeys.length) {
      setFrameHeaders(res)
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30')
      res.setHeader('Location', frameUrl(owner.name, { embed, version: summary.version }))
      return res.status(302).end()
    }

    const user = await getUserByID(owner.id)
    const code = storedCode(user.profileCode)
    const data = await loadTemplateData(user, code.html)
    const { html } = buildProfileDocument({ code, data, embed })

    setFrameHeaders(res)
    res.setHeader('Vary', 'Sec-Fetch-Dest')
    // The URL carries the version, so a save shows up at once; posts, guest
    // book and counts can lag a minute behind.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=60')
    if (req.method === 'HEAD') return res.status(200).end()
    return res.status(200).send(html)
  } catch (error) {
    console.error('Profile frame error:', error)
    setFrameHeaders(res)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(500).send('<!doctype html><meta charset="utf-8"><p>This page couldn’t be loaded.</p>')
  }
}

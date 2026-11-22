import { getUserByID } from '../../../lib/db'
import { requireAuth } from '../../../lib/server-auth'
import { isRateLimited } from '../../../lib/rate-limit'
import { moderateContent } from '../../../lib/publishing'
import { validateProfileCode, friendNamesFrom, moderationText, MAX_FRIENDS } from '../../../lib/profile-code'
import { canSignProfileCode, hasValidSignature } from '../../../lib/profile-code-signature'
import {
  loadTemplateData,
  loadFriends,
  storedCode,
  listRevisions,
  getRevision,
  saveProfileCode,
  VersionConflict,
} from '../../../lib/profile-code-server'

/**
 * Profile HTML for the signed-in writer (only ever their own).
 *
 * GET  /api/profile/code                 { code, revisions, data }
 * GET  /api/profile/code?revision=<id>   { revision }
 * GET  /api/profile/code?friends=a,b     { friends }  (for the live preview)
 * POST /api/profile/code                 { html, css, js, mode, placement, baseVersion?, force? }
 *                                        -> { version, updatedAt, codeChanged, revisions }
 */

const SAVE_LIMIT = { max: 30, windowMs: 10 * 60 * 1000 }
const FRIENDS_LIMIT = { max: 60, windowMs: 60 * 1000 }

const fail = (res, status, message, extra = {}) => res.status(status).json({ error: { message, ...extra } })

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return fail(res, 405, 'Method not allowed')
  }

  const uid = await requireAuth(req, res)
  if (!uid) return

  res.setHeader('Cache-Control', 'private, no-store')

  if (req.method === 'GET') return read(req, res, uid)
  return save(req, res, uid)
}

async function read(req, res, uid) {
  try {
    if (req.query.revision !== undefined) {
      const revision = await getRevision(uid, String(req.query.revision))
      if (!revision) return fail(res, 404, 'That version isn’t in your history any more')
      return res.status(200).json({ revision })
    }

    if (req.query.friends !== undefined) {
      if (isRateLimited(`profile-code-friends:${uid}`, FRIENDS_LIMIT)) return fail(res, 429, 'Too many lookups. Wait a minute.')
      const names = friendNamesFrom(String(req.query.friends)).slice(0, MAX_FRIENDS)
      return res.status(200).json({ friends: await loadFriends(names) })
    }

    let user
    try {
      user = await getUserByID(uid)
    } catch (_) {
      return fail(res, 404, 'Set up your profile first')
    }
    const code = storedCode(user.profileCode)
    // false when the stored code didn't come through this route (it isn't shown until saved here)
    code.trusted = !user.profileCode || hasValidSignature(uid, user.profileCode)
    const [data, revisions] = await Promise.all([loadTemplateData(user, code.html), listRevisions(uid)])
    return res.status(200).json({ code, revisions, data })
  } catch (error) {
    console.error('Profile HTML read error:', error)
    return fail(res, 500, 'Couldn’t load your Profile HTML')
  }
}

async function save(req, res, uid) {
  if (isRateLimited(`profile-code:${uid}`, SAVE_LIMIT)) {
    return fail(res, 429, 'That’s a lot of saves. Wait a few minutes and try again.')
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const checked = validateProfileCode(body)
  if (!checked.ok) return fail(res, 400, checked.error, { field: checked.field })
  const value = checked.value

  const baseVersion = Number.isFinite(body.baseVersion) ? body.baseVersion : undefined
  const force = body.force === true
  const source = body.source === 'ai' || body.source === 'template' || body.source === 'restore' ? body.source : 'editor'

  if (value.mode !== 'off' && !canSignProfileCode()) {
    return fail(res, 503, 'Profile HTML isn’t set up on this server yet (no signing secret).')
  }

  try {
    // Anything shown to visitors goes through the same moderation as posts,
    // including text the page only writes with JavaScript.
    if (value.mode !== 'off') {
      const verdict = await moderateContent('', moderationText(value))
      if (verdict && verdict.shouldUnpublish) {
        return fail(res, 422, `This page can’t go on your profile: ${verdict.reason || 'it breaks the content rules'}`, {
          category: verdict.category || 'none',
        })
      }
    }

    const result = await saveProfileCode(uid, value, { baseVersion, force, source })
    const revisions = await listRevisions(uid)
    return res.status(200).json({ ...result, revisions })
  } catch (error) {
    if (error instanceof VersionConflict) {
      return fail(res, 409, 'Your Profile HTML was saved from another tab or device since you opened it.', {
        code: 'VERSION_CONFLICT',
        currentVersion: error.current.version,
      })
    }
    if (error && error.status === 404) return fail(res, 404, 'Set up your profile first')
    console.error('Profile HTML save error:', error)
    return fail(res, 500, 'Couldn’t save your Profile HTML')
  }
}

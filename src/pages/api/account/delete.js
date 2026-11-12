import { firestore } from '../../../lib/firebase'
import { verifyIdToken, getBearerToken } from '../../../lib/server-auth'
import {
  deleteAccountData,
  hasRenewingSubscription,
  DELETE_CONFIRM_PHRASE,
  RECENT_SIGN_IN_SECONDS,
} from '../../../lib/delete-account'

/**
 * POST /api/account/delete  { confirm: "delete my account" }
 *
 * Permanently deletes the signed-in writer's account data. The account is
 * always the one the sign-in token belongs to; there is no userId to pass.
 *
 * Unlike other routes this one also needs a *recent* sign-in (the browser
 * asks the writer to sign in again first), so a session left open on a shared
 * computer can't be used to wipe an account.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let claims
  try {
    claims = await verifyIdToken(getBearerToken(req))
  } catch (_) {
    return res.status(401).json({ error: 'Please sign in again to continue.', code: 'UNAUTHENTICATED' })
  }
  const uid = claims.uid

  const signedInAt = typeof claims.auth_time === 'number' ? claims.auth_time : 0
  if (Math.floor(Date.now() / 1000) - signedInAt > RECENT_SIGN_IN_SECONDS) {
    return res.status(401).json({
      error: 'Please sign in again to confirm it’s you.',
      code: 'RECENT_SIGN_IN_REQUIRED',
    })
  }

  const confirm = typeof req.body?.confirm === 'string' ? req.body.confirm.trim().toLowerCase() : ''
  if (confirm !== DELETE_CONFIRM_PHRASE) {
    return res.status(400).json({
      error: `Type "${DELETE_CONFIRM_PHRASE}" to confirm.`,
      code: 'CONFIRMATION_REQUIRED',
    })
  }

  try {
    const userDoc = await firestore.collection('users').doc(uid).get()
    if (userDoc.exists && hasRenewingSubscription(userDoc.data())) {
      return res.status(409).json({
        error:
          'Your custom domain subscription is still active. Cancel it first with Manage Billing, further up this page, so you are not charged again, then delete your account.',
        code: 'SUBSCRIPTION_ACTIVE',
      })
    }

    const result = await deleteAccountData(uid)
    return res.status(200).json({ deleted: true, posts: result.posts })
  } catch (error) {
    console.error('Account deletion error:', error)
    return res.status(500).json({
      error: 'Something went wrong and your account may be only partly deleted. Please try again.',
      code: 'INTERNAL_ERROR',
    })
  }
}

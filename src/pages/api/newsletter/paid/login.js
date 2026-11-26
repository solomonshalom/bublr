import { findUserByName, shopOrigin } from '../../../../lib/shop-server'
import { clientIp, isRateLimited } from '../../../../lib/rate-limit'
import { sendReaderLoginEmail } from '../../../../lib/resend'
import { findSubscriber, paidState, verifiedPaid } from '../../../../lib/paid-newsletter'
import { loginUrl, safeNext } from '../../../../lib/reader-session'

/**
 * "Already a paid subscriber? Sign in." Emails a sign-in link to the address,
 * if it pays this writer. The answer is the same either way, and links are
 * only ever sent to the address itself.
 *
 * POST { username, email, next? }
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const DONE = { sent: true, message: 'If that address has a paid subscription, we’ve emailed it a sign-in link. It works for one hour.' }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (isRateLimited(`paid-login-ip:${clientIp(req)}`, { max: 8, windowMs: 10 * 60 * 1000 })) {
    return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' })
  }
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' })

  try {
    const user = await findUserByName(req.body?.username)
    if (!user) return res.status(200).json(DONE)
    const paid = verifiedPaid(user.id, findSubscriber(user, email))
    const currentMode = user.integrations?.payments?.mode || 'live'
    // Expired records still get a link while the provider might say they
    // renewed (the content check asks it).
    const worthSending = paid && (paidState(paid, { currentMode }) !== 'ended' || ['active', 'trialing', 'past_due'].includes(paid.status))
    if (worthSending && !isRateLimited(`paid-login:${user.id}:${email}`, { max: 3, windowMs: 60 * 60 * 1000 })) {
      const { origin } = shopOrigin(req, user)
      await sendReaderLoginEmail({
        subscriberEmail: email,
        authorName: user.displayName || user.name,
        loginUrl: loginUrl(origin, email, { next: safeNext(req.body?.next) }),
      })
    }
    return res.status(200).json(DONE)
  } catch (error) {
    console.error('Paid login link failed:', error)
    return res.status(500).json({ error: 'We couldn’t send the link right now. Please try again.' })
  }
}

import { firestore } from '../../../../lib/firebase'
import { newId } from '../../../../lib/shop'
import { PaymentProviderError } from '../../../../lib/shop-payments'
import { findUserByName, paymentKey, shopOrigin } from '../../../../lib/shop-server'
import { signCreemProduct, verifyCreemProduct } from '../../../../lib/shop-trust'
import { getBearerToken, verifyIdToken } from '../../../../lib/server-auth'
import { clientIp, isRateLimited } from '../../../../lib/rate-limit'
import { sendReaderLoginEmail } from '../../../../lib/resend'
import { INTERVALS, createCreemNewsletterProduct, createSubscriptionCheckout } from '../../../../lib/newsletter-payments'
import {
  findSubscriber,
  isRenewing,
  openForSubscriptions,
  paidAccess,
  priceFor,
  verifiedPaid,
} from '../../../../lib/paid-newsletter'
import { loginUrl, safeNext } from '../../../../lib/reader-session'

/**
 * Start a paid newsletter subscription. Public: readers aren't signed in.
 * The price comes from the writer's signed settings, never from the request,
 * and the checkout runs on the writer's own Stripe/Creem account, so the money
 * goes straight to them.
 *
 * POST { username, email, interval: 'month' | 'year', returnPath? }
 *   -> { checkoutUrl }  or  { alreadySubscribed: true } (a sign-in link was emailed)
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function signedInUid(req) {
  const token = getBearerToken(req)
  if (!token) return null
  try {
    return (await verifyIdToken(token)).uid
  } catch (_) {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (isRateLimited(`paid-checkout:${clientIp(req)}`, { max: 10, windowMs: 10 * 60 * 1000 })) {
    return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' })
  }

  const { username, interval = 'month', returnPath } = req.body || {}
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' })
  if (!INTERVALS.includes(interval)) return res.status(400).json({ error: 'Choose monthly or yearly.' })

  try {
    const user = await findUserByName(username)
    const open = user ? openForSubscriptions(user) : null
    if (!user || !open) return res.status(404).json({ error: 'Paid subscriptions aren’t open for this writer right now.' })

    const amount = priceFor(open.settings, interval)
    if (!amount) return res.status(400).json({ error: 'This writer doesn’t offer that plan.' })

    // With a test key only the writer can subscribe (to try it out), so a test
    // card never unlocks anything for a visitor.
    if (open.mode === 'test' && (await signedInUid(req)) !== user.id) {
      return res.status(403).json({ error: 'Paid subscriptions are in test mode, so they aren’t open yet.' })
    }

    const { origin, onCustomDomain } = shopOrigin(req, user)
    const home = onCustomDomain ? '/' : `/${user.name}`
    const back = safeNext(returnPath) === '/' && !onCustomDomain ? home : safeNext(returnPath || home)

    // Already paying: don't charge twice. Email them a way in instead.
    const existing = verifiedPaid(user.id, findSubscriber(user, email))
    if (existing && paidAccess(existing, { currentMode: open.mode }) && (isRenewing(existing) || existing.cancelAtPeriodEnd)) {
      if (!isRateLimited(`paid-login:${user.id}:${email}`, { max: 3, windowMs: 60 * 60 * 1000 })) {
        await sendReaderLoginEmail({
          subscriberEmail: email,
          authorName: user.displayName || user.name,
          loginUrl: loginUrl(origin, email, { next: back }),
        }).catch(error => console.error('Paid checkout: sign-in email failed:', error))
      }
      return res.status(200).json({
        alreadySubscribed: true,
        message: 'This address already has a paid subscription. We’ve emailed it a sign-in link.',
      })
    }

    const apiKey = paymentKey(user)
    const writerName = user.displayName || user.name
    const orderId = newId(16)
    const metadata = {
      bublr_kind: 'newsletter',
      bublr_user: user.id,
      bublr_email: email,
      bublr_interval: interval,
      bublr_amount: String(amount),
      bublr_currency: open.settings.currency,
      bublr_order: orderId,
    }

    let creemProductId = null
    if (open.provider === 'creem') {
      const cacheKey = `newsletter_${interval}_${amount}_${open.settings.currency}`
      const payments = user.integrations.payments
      creemProductId = verifyCreemProduct(user.id, cacheKey, payments.creemProducts?.[cacheKey])
      if (!creemProductId) {
        creemProductId = await createCreemNewsletterProduct({
          apiKey,
          name: `${writerName}: paid newsletter (${interval === 'year' ? 'yearly' : 'monthly'})`,
          description: open.settings.description || `A paid subscription to ${writerName}’s newsletter on Bublr.`,
          amount,
          currency: open.settings.currency,
          interval,
          writerId: user.id,
        })
        await firestore.collection('users').doc(user.id).update({
          [`integrations.payments.creemProducts.${cacheKey}`]: { id: creemProductId, sig: signCreemProduct(user.id, cacheKey, creemProductId) },
        })
      }
    }

    const returnUrl = `${origin}${back}`
    const checkout = await createSubscriptionCheckout(open.provider, {
      apiKey,
      amount,
      currency: open.settings.currency,
      interval,
      productName: `${writerName}: paid newsletter`,
      description: open.settings.description,
      email,
      orderId,
      creemProductId,
      successUrl: returnUrl,
      cancelUrl: returnUrl,
      metadata,
    })
    return res.status(200).json({ checkoutUrl: checkout.url })
  } catch (error) {
    if (error instanceof PaymentProviderError) {
      console.error('Paid checkout: provider error', error.status, error.code, error.message)
      return res.status(502).json({ error: 'The payment page couldn’t be opened. Please try again in a moment.' })
    }
    console.error('Paid checkout failed:', error)
    return res.status(500).json({ error: 'Subscribing is unavailable right now' })
  }
}

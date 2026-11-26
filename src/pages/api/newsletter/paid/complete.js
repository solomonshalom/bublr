import firebase, { firestore } from '../../../../lib/firebase'
import { PROVIDERS } from '../../../../lib/shop'
import { PaymentProviderError } from '../../../../lib/shop-payments'
import { findUserByName, paymentKey, shopOrigin } from '../../../../lib/shop-server'
import { hashId } from '../../../../lib/secret-box'
import { clientIp, isRateLimited } from '../../../../lib/rate-limit'
import { sendNewPaidSubscriberEmail, sendPaidWelcomeEmail } from '../../../../lib/resend'
import { cancelAtPeriodEnd, retrieveSubscriptionCheckout } from '../../../../lib/newsletter-payments'
import {
  describePrice,
  isRenewing,
  openSubscriptionRef,
  recordFromSubscription,
  sealSubscriptionRef,
  verifiedPaid,
  writePaidRecord,
} from '../../../../lib/paid-newsletter'
import { EMAIL_LINK_TTL_MS, loginUrl, manageUrl, maskEmail, paidSessionCookie } from '../../../../lib/reader-session'

/**
 * Confirm a paid subscription when the reader comes back from Stripe/Creem
 * (the page calls this with the id the provider put in the return URL). Asks
 * the writer's payment account whether it was paid, and how much, then
 * records the reader as a paid subscriber once, welcomes them, tells the
 * writer, and signs this browser in for this writer's paid posts.
 *
 * The checkout id works like a receipt, so only its hash is stored, and it
 * signs a browser in only within an hour of the payment.
 *
 * GET ?user=<username>&checkout_id=<id>   (Stripe's session_id works too)
 */
const ID_RE = /^[A-Za-z0-9_-]{6,200}$/
const SIGN_IN_WINDOW_MS = 60 * 60 * 1000

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (isRateLimited(`paid-complete:${clientIp(req)}`, { max: 30, windowMs: 10 * 60 * 1000 })) {
    return res.status(429).json({ error: 'Too many requests' })
  }
  res.setHeader('Cache-Control', 'private, no-store')

  const checkoutId = String(req.query.checkout_id || req.query.session_id || '')
  if (!ID_RE.test(checkoutId)) return res.status(400).json({ error: 'Missing checkout id' })

  try {
    const user = await findUserByName(String(req.query.user || ''))
    const apiKey = user ? paymentKey(user) : null
    const payments = user?.integrations?.payments
    if (!user || !apiKey || !PROVIDERS[payments?.provider]) return res.status(404).json({ error: 'Subscription not found' })

    const checkout = await retrieveSubscriptionCheckout(payments.provider, { apiKey, checkoutId })
    const meta = checkout.metadata || {}
    if (meta.bublr_user !== user.id || meta.bublr_kind !== 'newsletter') return res.status(404).json({ error: 'Subscription not found' })
    if (!checkout.paid || !checkout.subscription?.id) {
      return res.status(202).json({ paid: false, message: 'Your payment is still being processed.' })
    }

    // What was paid has to be the price when the checkout started.
    const expected = Number(meta.bublr_amount)
    const expectedCurrency = String(meta.bublr_currency || '').toLowerCase()
    const amountOk =
      Number.isFinite(expected) &&
      Number.isFinite(checkout.amount) &&
      checkout.amount >= expected &&
      String(checkout.currency || '').toLowerCase() === expectedCurrency
    if (!amountOk) {
      console.error('Paid complete: amount mismatch for', user.id, checkout.amount, checkout.currency, 'expected', expected, expectedCurrency)
      return res.status(409).json({ paid: true, error: 'This payment doesn’t match the price, so it couldn’t be confirmed here. Please contact the writer.' })
    }

    const email = String(checkout.email || meta.bublr_email || '').trim().toLowerCase()
    if (!email.includes('@')) return res.status(409).json({ paid: true, error: 'The payment has no email address, so it couldn’t be linked to a subscription.' })

    const now = Date.now()
    const checkoutHash = hashId(checkoutId)
    const mode = payments.mode || 'live'
    let replaced = null
    const result = await writePaidRecord(user.id, email, entry => {
      const before = verifiedPaid(user.id, entry)
      if (before && before.checkoutHash === checkoutHash) return null // recorded already (a reload)
      if (before && isRenewing(before, { now })) replaced = { paid: before, ref: openSubscriptionRef(user.id, email, before) }
      return recordFromSubscription(user.id, email, {
        provider: payments.provider,
        mode,
        subscription: checkout.subscription,
        interval: meta.bublr_interval,
        amount: checkout.amount,
        currency: checkout.currency,
        checkoutHash,
        startedAt: now,
        ref: sealSubscriptionRef(user.id, email, { subscriptionId: checkout.subscription.id, customerId: checkout.subscription.customerId || checkout.customerId }),
        now,
      })
    }, { now })
    if (!result) return res.status(404).json({ error: 'Subscription not found' })

    const { origin } = shopOrigin(req, user)
    const writerName = user.displayName || user.name
    const priceText = describePrice(result.paid.amount, result.paid.currency, result.paid.interval)
    const providerName = PROVIDERS[payments.provider].name

    if (result.written) {
      // Two checkouts finished for the same address (two tabs): keep the
      // newest and stop the older one renewing, so nobody pays twice.
      if (replaced?.ref?.subscriptionId && replaced.ref.subscriptionId !== checkout.subscription.id) {
        await cancelAtPeriodEnd(replaced.paid.provider, { apiKey, subscriptionId: replaced.ref.subscriptionId }).catch(error =>
          console.error('Paid complete: could not stop the older subscription:', error?.message)
        )
      }
      await sendPaidWelcomeEmail({
        subscriberEmail: email,
        authorName: writerName,
        priceText,
        providerName,
        loginUrl: loginUrl(origin, email, { next: req.query.next || `/${user.name}`, ttlMs: EMAIL_LINK_TTL_MS }),
        manageUrl: manageUrl(origin, email, user.id),
      }).catch(error => console.error('Paid welcome email failed:', error))
      if (user.email) {
        await sendNewPaidSubscriberEmail({ writerEmail: user.email, writerName, subscriberLabel: maskEmail(email), priceText, providerName, mode }).catch(
          error => console.error('Paid subscriber email failed:', error)
        )
      }
      try {
        await firestore.collection('notifications').add({
          recipientId: user.id,
          type: 'subscriber',
          actorId: null,
          actorName: maskEmail(email),
          actorPhoto: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(emailInitial(email))}`,
          postId: null,
          postTitle: null,
          postSlug: null,
          postAuthorName: null,
          message: `${maskEmail(email)} became a paid subscriber${priceText ? ` (${priceText})` : ''}`,
          metadata: { paid: true },
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
      } catch (error) {
        console.error('Paid subscriber notification failed:', error)
      }
    }

    // Sign this browser in for this writer, right after paying only.
    const fresh = result.paid.checkoutHash === checkoutHash && now - (result.paid.startedAt || 0) < SIGN_IN_WINDOW_MS
    if (fresh) {
      const cookie = paidSessionCookie(req, email, user.id, { now })
      if (cookie) res.setHeader('Set-Cookie', cookie)
    }

    return res.status(200).json({ paid: true, email: maskEmail(email), priceText, signedIn: fresh })
  } catch (error) {
    if (error instanceof PaymentProviderError) {
      console.error('Paid complete: provider error', error.status, error.message)
      if (error.status === 404) return res.status(404).json({ error: 'Subscription not found' })
      return res.status(502).json({ error: 'We couldn’t confirm the payment yet. Refresh in a moment.' })
    }
    console.error('Paid complete failed:', error)
    return res.status(500).json({ error: 'We couldn’t confirm the payment yet. Refresh in a moment.' })
  }
}

const emailInitial = email => String(email || '?').slice(0, 1)

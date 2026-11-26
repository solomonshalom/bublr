import firebase, { firestore } from '../../../../lib/firebase'
import { PROVIDERS } from '../../../../lib/shop'
import { PaymentProviderError } from '../../../../lib/shop-payments'
import { findUserByName, paymentAccount } from '../../../../lib/shop-server'
import { hashId } from '../../../../lib/secret-box'
import { clientIp, isRateLimited } from '../../../../lib/rate-limit'
import { sendDuplicatePaymentEmail, sendNewPaidSubscriberEmail, sendPaidWelcomeEmail } from '../../../../lib/resend'
import { cancelAtPeriodEnd, retrieveSubscriptionCheckout } from '../../../../lib/newsletter-payments'
import {
  couldStillCharge,
  describePrice,
  findSubscriber,
  openSubscriptionRef,
  refreshPaidSubscriber,
  recordFromSubscription,
  sealSubscriptionRef,
  verifiedPaid,
  writePaidRecord,
} from '../../../../lib/paid-newsletter'
import { EMAIL_LINK_TTL_MS, emailOrigin, loginUrl, manageUrl, maskEmail, paidSessionCookie } from '../../../../lib/reader-session'

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
    const payments = user ? paymentAccount(user) : null
    const apiKey = payments?.apiKey
    if (!user || !apiKey || !PROVIDERS[payments.provider]) return res.status(404).json({ error: 'Subscription not found' })

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

    // A second subscription for someone already paying: stop it renewing and
    // tell the writer, who can refund the extra payment.
    async function duplicate() {
      await cancelAtPeriodEnd(payments.provider, { apiKey, subscriptionId: checkout.subscription.id }).catch(error =>
        console.error('Paid complete: could not stop a duplicate subscription:', error?.message)
      )
      if (user.email && !isRateLimited(`paid-duplicate:${checkoutId}`, { max: 1, windowMs: 24 * 60 * 60 * 1000 })) {
        await sendDuplicatePaymentEmail({
          writerEmail: user.email,
          writerName: user.displayName || user.name,
          subscriberLabel: maskEmail(email),
          providerName: PROVIDERS[payments.provider].name,
        }).catch(() => {})
      }
      return res.status(200).json({
        paid: true,
        duplicate: true,
        email: maskEmail(email),
        signedIn: false,
        message: 'You already have a paid subscription, so this second one won’t renew. Ask the writer for a refund of the extra payment.',
      })
    }

    const now = Date.now()
    const checkoutHash = hashId(checkoutId)
    const mode = payments.mode
    const newSubscriptionId = checkout.subscription.id
    const writerName = user.displayName || user.name
    const providerName = PROVIDERS[payments.provider].name

    // Already paying through another subscription (two tabs, or a second
    // checkout)? Ask the provider whether that one still renews. If it does,
    // the subscription on record stays as it is and this new one is stopped
    // from renewing: never the other way round, so reloading an old return
    // page can't cancel the subscription a reader is relying on.
    const sameSubscription = paid => openSubscriptionRef(user.id, email, paid)?.subscriptionId === newSubscriptionId
    let existing = verifiedPaid(user.id, findSubscriber(user, email))
    if (existing && existing.checkoutHash !== checkoutHash && !sameSubscription(existing) && couldStillCharge(existing)) {
      existing = (await refreshPaidSubscriber(user, email, { now }).catch(() => null)) || existing
    }
    const keepsExisting = paid => paid && paid.checkoutHash !== checkoutHash && !sameSubscription(paid) && couldStillCharge(paid)
    if (keepsExisting(existing)) return duplicate()

    const result = await writePaidRecord(user.id, email, entry => {
      const before = verifiedPaid(user.id, entry)
      if (before && before.checkoutHash === checkoutHash) return null // recorded already (a reload)
      if (keepsExisting(before)) return null // another checkout won the race
      return recordFromSubscription(user.id, email, {
        previous: before && sameSubscription(before) ? before : null,
        provider: payments.provider,
        mode,
        subscription: checkout.subscription,
        interval: meta.bublr_interval,
        amount: checkout.amount,
        currency: checkout.currency,
        checkoutHash,
        startedAt: now,
        ref: sealSubscriptionRef(user.id, email, { subscriptionId: newSubscriptionId, customerId: checkout.subscription.customerId || checkout.customerId }),
        now,
      })
    }, { now, resubscribe: true })
    if (!result) return res.status(404).json({ error: 'Subscription not found' })
    if (!result.written && result.paid?.checkoutHash !== checkoutHash) return duplicate()

    const origin = emailOrigin()
    const priceText = describePrice(result.paid.amount, result.paid.currency, result.paid.interval)

    if (result.written) {
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

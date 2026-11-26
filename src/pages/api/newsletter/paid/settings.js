import { firestore } from '../../../../lib/firebase'
import { PaymentProviderError } from '../../../../lib/shop-payments'
import { paymentAccount, paymentStatus, requireShopOwner } from '../../../../lib/shop-server'
import { hasVerifiedShopAccess } from '../../../../lib/shop-trust'
import { canSeal } from '../../../../lib/secret-box'
import { verifySubscriptionKey } from '../../../../lib/newsletter-payments'
import {
  PaidNewsletterError,
  currentModeOf,
  normalizePaidSettings,
  openForSubscriptions,
  paidSubscribers,
  paidState,
  renewingPaidSubscribers,
  signedPaidSettings,
  trustedPaidSettings,
} from '../../../../lib/paid-newsletter'

/**
 * The writer's paid newsletter (Settings → Newsletter).
 *
 *   GET   what's set, whether readers can subscribe, and how many pay
 *   POST  { enabled, currency, monthly, yearly, description, teaseFree }
 *
 * Prices are checked and signed here (the user document can be written by
 * anyone, so an unsigned price is never used). Turning paid subscriptions on
 * needs the Pro + Shop plan and a connected Stripe or Creem account whose key
 * can manage subscriptions. Turning them off is always possible: it stops new
 * paid sign-ups, and existing paid subscribers keep what they pay for.
 */
function summary(user) {
  const currentMode = currentModeOf(user)
  const all = paidSubscribers(user)
  return {
    settings: trustedPaidSettings(user),
    payments: paymentStatus(user),
    plan: hasVerifiedShopAccess(user),
    open: Boolean(openForSubscriptions(user)),
    canSeal: canSeal(),
    counts: {
      paying: all.filter(({ paid }) => paidState(paid, { currentMode }) !== 'ended').length,
      renewing: renewingPaidSubscribers(user, { strict: true }).length,
      total: all.length,
    },
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Checking and turning off stay possible after the plan ends.
  const user = await requireShopOwner(req, res, { allowWithoutPlan: true })
  if (!user) return

  if (req.method === 'GET') return res.status(200).json(summary(user))

  try {
    const account = paymentAccount(user)
    const provider = account?.provider || null
    // Anything left out keeps its saved value (so "turn off" needs no prices).
    const turningOff = req.body?.enabled === false
    const settings = normalizePaidSettings(
      { ...(trustedPaidSettings(user) || {}), ...(req.body || {}) },
      { provider: turningOff ? null : provider }
    )

    if (settings.enabled) {
      if (!hasVerifiedShopAccess(user)) {
        throw new PaidNewsletterError('Paid newsletters are part of the Pro + Shop plan ($3/month).', 402, 'SHOP_PLAN_REQUIRED')
      }
      const apiKey = account?.apiKey
      if (!apiKey || !provider) {
        throw new PaidNewsletterError('Connect your Stripe or Creem account first, so readers can pay you.', 409, 'PAYMENTS_REQUIRED')
      }
      try {
        await verifySubscriptionKey(provider, apiKey)
      } catch (error) {
        if (error instanceof PaymentProviderError && (error.status === 401 || error.status === 403)) {
          throw new PaidNewsletterError(
            provider === 'stripe'
              ? 'Your Stripe key can’t manage subscriptions. In Stripe, edit the restricted key and give it “Subscriptions: Write”, then save here again.'
              : 'Your Creem key was refused. Check it has Products, Checkouts, Subscriptions and Customers permissions.',
            400,
            'KEY_PERMISSIONS'
          )
        }
        throw error
      }
    }

    if (!canSeal()) throw new PaidNewsletterError('Paid newsletters can’t be saved on this server yet (INTEGRATIONS_SECRET missing).', 500)

    const paidNewsletter = signedPaidSettings(user.id, settings)
    await firestore.collection('users').doc(user.id).update({ paidNewsletter })
    return res.status(200).json(summary({ ...user, paidNewsletter }))
  } catch (error) {
    if (error instanceof PaidNewsletterError) return res.status(error.status).json({ error: error.message, code: error.code })
    if (error instanceof PaymentProviderError) {
      console.error('Paid newsletter settings: provider error', error.status, error.message)
      return res.status(502).json({ error: 'Your payment provider didn’t answer. Please try again in a moment.' })
    }
    console.error('Paid newsletter settings failed:', error)
    return res.status(500).json({ error: 'Could not save your paid newsletter' })
  }
}

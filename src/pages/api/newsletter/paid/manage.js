import { firestore } from '../../../../lib/firebase'
import { escapeHtml } from '../../../../lib/escape'
import { PROVIDERS } from '../../../../lib/shop'
import { PaymentProviderError } from '../../../../lib/shop-payments'
import { paymentAccount } from '../../../../lib/shop-server'
import { billingPortalUrl } from '../../../../lib/newsletter-payments'
import {
  PaidNewsletterError,
  currentModeOf,
  describePrice,
  findSubscriber,
  isRenewing,
  openSubscriptionRef,
  paidState,
  refreshPaidSubscriber,
  setPaidRenewal,
  verifiedPaid,
} from '../../../../lib/paid-newsletter'
import { emailOrigin, verifyManageToken } from '../../../../lib/reader-session'
import { clientIp, isRateLimited } from '../../../../lib/rate-limit'

/**
 * A paid subscriber's own page for their subscription, from the link in every
 * email they get: what they pay, when it renews or ends, and buttons to stop
 * renewing, keep it after all, or change their card (on Stripe's or Creem's
 * own page). Like unsubscribing, GET only shows the page; the buttons POST.
 *
 * GET  ?token=
 * POST token, action = cancel | resume | card
 */
const STYLE = `
  body { font-family: Inter, -apple-system, sans-serif; padding: 40px 20px; max-width: 440px; margin: 0 auto; background: #fafafa; color: #2e2e2e; }
  .card { background: white; border-radius: 8px; padding: 32px; }
  h1 { font-size: 1.25rem; font-weight: 500; margin: 0 0 8px; }
  p { color: #6f6f6f; font-size: 0.9rem; line-height: 1.5; }
  .row { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.9rem; padding: 8px 0; border-top: 1px solid #eee; }
  .row span:first-child { color: #6f6f6f; }
  a { color: #2e2e2e; }
  form { display: inline; }
  button { font: inherit; background: #2e2e2e; color: white; border: 0; border-radius: 6px; padding: 10px 18px; cursor: pointer; margin: 16px 8px 0 0; }
  button.secondary { background: white; color: #2e2e2e; border: 1px solid #d4d4d4; }
  .note { font-size: 0.8rem; margin-top: 20px; }
`

function page(res, status, title, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  return res.status(status).send(`<!DOCTYPE html>
<html><head><title>${escapeHtml(title)} - Bublr</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<style>${STYLE}</style></head>
<body><div class="card">${body}</div></body></html>`)
}

const formatDate = ms =>
  Number.isFinite(ms) ? new Date(ms).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—'

const button = (token, action, label, secondary = false) => `<form method="POST" action="/api/newsletter/paid/manage">
  <input type="hidden" name="token" value="${escapeHtml(token)}">
  <input type="hidden" name="action" value="${action}">
  <button type="submit"${secondary ? ' class="secondary"' : ''}>${escapeHtml(label)}</button>
</form>`

function statusPage(res, { user, email, paid, token, origin, message = null }) {
  const writer = escapeHtml(user.displayName || user.name)
  const currentMode = currentModeOf(user)
  const state = paidState(paid, { currentMode })
  const provider = PROVIDERS[paid.provider]?.name || 'your payment provider'
  const price = describePrice(paid.amount, paid.currency, paid.interval)
  const statusText = {
    active: `Renews on ${formatDate(paid.currentPeriodEnd)}`,
    past_due: `The last payment didn’t go through. ${escapeHtml(provider)} will try again; you can update your card below.`,
    ending: `Cancelled. You can read paid posts until ${formatDate(paid.currentPeriodEnd)}, and you won’t be charged again.`,
    ended: 'Ended. You still get free posts by email.',
  }[state]
  const actions = [
    isRenewing(paid) ? button(token, 'cancel', 'Cancel subscription') : '',
    state === 'ending' && paid.cancelAtPeriodEnd ? button(token, 'resume', 'Keep my subscription') : '',
    state !== 'ended' && openSubscriptionRef(user.id, email, paid)?.customerId ? button(token, 'card', 'Update payment method', true) : '',
  ].join('')
  return page(
    res,
    200,
    'Your subscription',
    `<h1>Your subscription to ${writer}</h1>
     ${message ? `<p>${escapeHtml(message)}</p>` : ''}
     <div class="row"><span>Email</span><span>${escapeHtml(email)}</span></div>
     <div class="row"><span>Plan</span><span>${escapeHtml(price || 'Paid')}${paid.mode === 'test' ? ' (test mode)' : ''}</span></div>
     <div class="row"><span>Status</span><span>${statusText}</span></div>
     ${actions}
     <p class="note">Payments go straight to ${writer} through ${escapeHtml(provider)}; Bublr takes no cut. Receipts come from ${escapeHtml(provider)}. <a href="${escapeHtml(origin)}/${encodeURIComponent(user.name)}">Visit ${writer}’s page</a></p>`
  )
}

export default async function handler(req, res) {
  const isGet = req.method === 'GET'
  if (!isGet && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (isRateLimited(`paid-manage:${clientIp(req)}`, { max: 40, windowMs: 10 * 60 * 1000 })) {
    return page(res, 429, 'Slow down', '<h1>Too many requests</h1><p>Please wait a few minutes and try again.</p>')
  }

  const params = isGet ? req.query || {} : { ...(req.query || {}), ...(req.body || {}) }
  const token = typeof params.token === 'string' ? params.token : ''
  const link = verifyManageToken(token)
  if (!link) {
    return page(res, 400, 'Invalid link', '<h1>This link isn’t valid</h1><p>Use the “Manage your paid subscription” link from a recent email.</p>')
  }

  try {
    const snapshot = await firestore.collection('users').doc(link.writerId).get()
    if (!snapshot.exists) return page(res, 404, 'Not found', '<h1>This writer isn’t on Bublr any more</h1>')
    const user = { id: snapshot.id, ...snapshot.data() }
    const origin = emailOrigin()
    let paid = verifiedPaid(user.id, findSubscriber(user, link.email))
    if (!paid) {
      return page(res, 404, 'No subscription', `<h1>No paid subscription</h1><p>There’s no paid subscription for this address any more. <a href="${escapeHtml(origin)}/${encodeURIComponent(user.name)}">Visit the writer’s page</a></p>`)
    }

    if (isGet) {
      // Show what the provider says now, not what was true at the last renewal.
      paid = (await refreshPaidSubscriber(user, link.email).catch(() => null)) || paid
      return statusPage(res, { user, email: link.email, paid, token, origin })
    }

    const action = params.action
    if (action === 'card') {
      const ref = openSubscriptionRef(user.id, link.email, paid)
      const account = paymentAccount(user)
      const apiKey = account?.apiKey
      if (!ref?.customerId || !apiKey || account.provider !== paid.provider || account.mode !== paid.mode) {
        return statusPage(res, { user, email: link.email, paid, token, origin, message: 'Changing your card isn’t available here right now. Please contact the writer.' })
      }
      const returnUrl = `${origin}/api/newsletter/paid/manage?token=${encodeURIComponent(token)}`
      try {
        const url = await billingPortalUrl(paid.provider, { apiKey, customerId: ref.customerId, returnUrl })
        // A page that moves on by itself, not a redirect: the site's
        // form-action policy would block a redirect to another site after a form.
        const provider = escapeHtml(PROVIDERS[paid.provider]?.name || 'the payment page')
        return page(
          res,
          200,
          'Opening your billing page',
          `<meta http-equiv="refresh" content="0;url=${escapeHtml(url)}">
           <h1>Opening ${provider}…</h1>
           <p>If nothing happens, <a href="${escapeHtml(url)}" rel="noreferrer">continue to ${provider}</a>.</p>`
        )
      } catch (error) {
        console.error('Paid manage: billing portal failed:', error?.status, error?.message)
        return statusPage(res, { user, email: link.email, paid, token, origin, message: 'Changing your card isn’t available here right now. Please contact the writer.' })
      }
    }

    if (action !== 'cancel' && action !== 'resume') return statusPage(res, { user, email: link.email, paid, token, origin })
    paid = await setPaidRenewal(user, link.email, { renew: action === 'resume' })
    return statusPage(res, {
      user,
      email: link.email,
      paid,
      token,
      origin,
      message: action === 'cancel' ? 'Done. Your subscription won’t renew.' : 'Done. Your subscription will renew as before.',
    })
  } catch (error) {
    if (error instanceof PaidNewsletterError || error instanceof PaymentProviderError) {
      console.error('Paid manage failed:', error.status, error.message)
      const message = error instanceof PaidNewsletterError ? error.message : 'The payment provider didn’t answer. Nothing was changed; please try again in a moment.'
      return page(res, 409, 'Not changed', `<h1>Nothing was changed</h1><p>${escapeHtml(message)}</p>`)
    }
    console.error('Paid manage failed:', error)
    return page(res, 500, 'Error', '<h1>Something went wrong</h1><p>Please try again later.</p>')
  }
}

import { PaymentProviderError, creemRequest, stripeRequest } from './shop-payments'

/**
 * Paid newsletter subscriptions, on the writer's own Stripe or Creem account
 * (the one connected for their shop). Readers subscribe on the provider's
 * checkout page and are billed by the writer directly; Bublr takes no cut and
 * never holds the money.
 *
 * Everything comes back in one shape, whichever provider it was:
 *
 *   { id, status, currentPeriodEnd (ms), cancelAtPeriodEnd, customerId,
 *     amount, currency, interval, metadata }
 *
 * where status is one of active, trialing, past_due, unpaid, paused,
 * incomplete, canceled (still paid up until currentPeriodEnd) or ended.
 *
 * Permissions the writer's key needs:
 *   Stripe (restricted key): Checkout Sessions: Write, Subscriptions: Write;
 *     Customer portal: Write is optional (lets readers change their card).
 *   Creem: Products, Checkouts, Subscriptions and Customers.
 */

export const INTERVALS = ['month', 'year']

const toMs = value => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

const idOf = value => (typeof value === 'string' ? value : value && typeof value === 'object' ? value.id || null : null)

// ---------------------------------------------------------------- Stripe

const STRIPE_STATUS = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  unpaid: 'unpaid',
  paused: 'paused',
  incomplete: 'incomplete',
  // Stripe's "canceled" is final: it has already stopped.
  canceled: 'ended',
  incomplete_expired: 'ended',
}

export function normalizeStripeSubscription(sub) {
  if (!sub || typeof sub !== 'object' || !sub.id) return null
  const item = sub.items?.data?.[0] || null
  // API versions from 2025-03-31 keep the period on the subscription item.
  const periodEnd = sub.current_period_end ?? item?.current_period_end ?? null
  return {
    id: sub.id,
    status: STRIPE_STATUS[sub.status] || 'incomplete',
    currentPeriodEnd: toMs(periodEnd),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    customerId: idOf(sub.customer),
    amount: Number.isFinite(item?.price?.unit_amount) ? item.price.unit_amount : null,
    currency: (item?.price?.currency || sub.currency || '').toLowerCase() || null,
    interval: item?.price?.recurring?.interval || null,
    metadata: sub.metadata || {},
  }
}

async function createStripeCheckout({ apiKey, amount, currency, interval, productName, description, email, orderId, successUrl, cancelUrl, metadata }) {
  const session = await stripeRequest(
    apiKey,
    'POST',
    '/v1/checkout/sessions',
    {
      mode: 'subscription',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amount,
            recurring: { interval },
            product_data: {
              name: productName.slice(0, 250),
              ...(description ? { description: description.slice(0, 500) } : {}),
            },
          },
        },
      ],
      customer_email: email,
      client_reference_id: orderId,
      success_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}paid=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cancelUrl}${cancelUrl.includes('?') ? '&' : '?'}paid=cancelled`,
      metadata,
      subscription_data: { metadata },
    },
    { idempotencyKey: `bublr-newsletter-${orderId}` }
  )
  if (!session?.url) throw new PaymentProviderError('Stripe returned a checkout without a URL')
  return { id: session.id, url: session.url }
}

async function retrieveStripeCheckout({ apiKey, checkoutId }) {
  const session = await stripeRequest(apiKey, 'GET', `/v1/checkout/sessions/${encodeURIComponent(checkoutId)}?expand[]=subscription`)
  let subscription = session.subscription && typeof session.subscription === 'object' ? session.subscription : null
  if (!subscription && typeof session.subscription === 'string') {
    subscription = await stripeRequest(apiKey, 'GET', `/v1/subscriptions/${encodeURIComponent(session.subscription)}`)
  }
  return {
    id: session.id,
    paid: session.mode === 'subscription' && session.status === 'complete' && ['paid', 'no_payment_required'].includes(session.payment_status),
    amount: session.amount_total ?? null,
    currency: session.currency ? String(session.currency).toLowerCase() : null,
    email: session.customer_details?.email || session.customer_email || null,
    customerId: idOf(session.customer),
    metadata: session.metadata || {},
    subscription: normalizeStripeSubscription(subscription),
  }
}

async function retrieveStripeSubscription({ apiKey, subscriptionId }) {
  return normalizeStripeSubscription(await stripeRequest(apiKey, 'GET', `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`))
}

async function setStripeCancel({ apiKey, subscriptionId, cancel }) {
  return normalizeStripeSubscription(
    await stripeRequest(apiKey, 'POST', `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, { cancel_at_period_end: cancel ? 'true' : 'false' })
  )
}

async function stripePortal({ apiKey, customerId, returnUrl }) {
  const session = await stripeRequest(apiKey, 'POST', '/v1/billing_portal/sessions', { customer: customerId, return_url: returnUrl })
  if (!session?.url) throw new PaymentProviderError('Stripe returned no portal link')
  return session.url
}

async function verifyStripeSubscriptions(apiKey) {
  await stripeRequest(apiKey, 'GET', '/v1/subscriptions?limit=1')
}

// ---------------------------------------------------------------- Creem

const CREEM_PERIOD = { month: 'every-month', year: 'every-year' }
const CREEM_INTERVAL = { 'every-month': 'month', 'every-year': 'year' }

export function normalizeCreemSubscription(sub) {
  if (!sub || typeof sub !== 'object' || !sub.id) return null
  const product = sub.product && typeof sub.product === 'object' ? sub.product : null
  let status
  switch (sub.status) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'unpaid':
    case 'paused':
      status = sub.status
      break
    case 'scheduled_cancel':
      status = 'active'
      break
    case 'canceled':
      // Creem keeps a cancelled subscription paid up until its period ends.
      status = 'canceled'
      break
    default:
      status = 'incomplete'
  }
  return {
    id: sub.id,
    status,
    currentPeriodEnd: toMs(sub.current_period_end_date),
    cancelAtPeriodEnd: sub.status === 'scheduled_cancel' || sub.status === 'canceled',
    customerId: idOf(sub.customer),
    amount: Number.isFinite(product?.price) ? product.price : null,
    currency: product?.currency ? String(product.currency).toLowerCase() : null,
    interval: CREEM_INTERVAL[product?.billing_period] || null,
    metadata: sub.metadata || {},
  }
}

/** The Creem product a paid newsletter price is sold as (one per price). */
export async function createCreemNewsletterProduct({ apiKey, name, description, amount, currency, interval, writerId }) {
  const created = await creemRequest(apiKey, 'POST', '/v1/products', {
    name: name.slice(0, 200),
    description: (description || name).slice(0, 1000),
    price: amount,
    currency: currency.toUpperCase(),
    billing_type: 'recurring',
    billing_period: CREEM_PERIOD[interval],
    tax_mode: 'inclusive',
    tax_category: 'digital-goods-service',
    metadata: { source: 'bublr', bublr_kind: 'newsletter', bublr_user: writerId, bublr_interval: interval },
  })
  if (!created?.id) throw new PaymentProviderError('Creem returned a product without an id')
  return created.id
}

async function createCreemCheckout({ apiKey, creemProductId, email, orderId, successUrl, metadata }) {
  const checkout = await creemRequest(apiKey, 'POST', '/v1/checkouts', {
    product_id: creemProductId,
    units: 1,
    request_id: orderId,
    customer: { email },
    success_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}paid=success`,
    metadata,
  })
  if (!checkout?.checkout_url) throw new PaymentProviderError('Creem returned a checkout without a URL')
  return { id: checkout.id, url: checkout.checkout_url }
}

async function retrieveCreemSubscription({ apiKey, subscriptionId }) {
  return normalizeCreemSubscription(await creemRequest(apiKey, 'GET', `/v1/subscriptions?subscription_id=${encodeURIComponent(subscriptionId)}`))
}

async function retrieveCreemCheckout({ apiKey, checkoutId }) {
  const checkout = await creemRequest(apiKey, 'GET', `/v1/checkouts?checkout_id=${encodeURIComponent(checkoutId)}`)
  const order = checkout?.order && typeof checkout.order === 'object' ? checkout.order : null
  const customer = checkout?.customer && typeof checkout.customer === 'object' ? checkout.customer : null
  let subscription = checkout?.subscription && typeof checkout.subscription === 'object' ? normalizeCreemSubscription(checkout.subscription) : null
  if (!subscription && typeof checkout?.subscription === 'string' && checkout.subscription) {
    subscription = await retrieveCreemSubscription({ apiKey, subscriptionId: checkout.subscription })
  }
  return {
    id: checkout?.id,
    paid: checkout?.status === 'completed' && (!order || order.status === 'paid'),
    amount: order?.amount ?? null,
    currency: order?.currency ? String(order.currency).toLowerCase() : null,
    email: customer?.email || null,
    customerId: idOf(checkout?.customer) || subscription?.customerId || null,
    metadata: checkout?.metadata || {},
    subscription,
  }
}

async function setCreemCancel({ apiKey, subscriptionId, cancel }) {
  const path = `/v1/subscriptions/${encodeURIComponent(subscriptionId)}/${cancel ? 'cancel' : 'resume'}`
  return normalizeCreemSubscription(await creemRequest(apiKey, 'POST', path, cancel ? { mode: 'scheduled' } : {}))
}

async function creemPortal({ apiKey, customerId }) {
  const links = await creemRequest(apiKey, 'POST', '/v1/customers/billing', { customer_id: customerId })
  if (!links?.customer_portal_link) throw new PaymentProviderError('Creem returned no portal link')
  return links.customer_portal_link
}

// ---------------------------------------------------------------- shared

const pick = (provider, stripe, creem) => {
  if (provider === 'stripe') return stripe
  if (provider === 'creem') return creem
  throw new PaymentProviderError('Unknown payment provider')
}

/** Check the key may read subscriptions (Stripe); Creem keys are checked when first used. */
export async function verifySubscriptionKey(provider, apiKey) {
  if (provider === 'stripe') return verifyStripeSubscriptions(apiKey)
  if (provider === 'creem') return undefined
  throw new PaymentProviderError('Unknown payment provider')
}

export const createSubscriptionCheckout = (provider, params) => pick(provider, createStripeCheckout, createCreemCheckout)(params)
export const retrieveSubscriptionCheckout = (provider, params) => pick(provider, retrieveStripeCheckout, retrieveCreemCheckout)(params)
export const retrieveSubscription = (provider, params) => pick(provider, retrieveStripeSubscription, retrieveCreemSubscription)(params)
/** Stop renewing at the end of the period that's paid for. */
export const cancelAtPeriodEnd = (provider, params) => pick(provider, setStripeCancel, setCreemCancel)({ ...params, cancel: true })
/** Undo cancelAtPeriodEnd while the period is still open. */
export const resumeSubscription = (provider, params) => pick(provider, setStripeCancel, setCreemCancel)({ ...params, cancel: false })
export const billingPortalUrl = (provider, params) => pick(provider, stripePortal, creemPortal)(params)

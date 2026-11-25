/**
 * Creem is the merchant of record for the custom domain plans: it runs the
 * checkout page, charges the card, handles tax and hosts the billing portal.
 *
 * This talks to its REST API with fetch. Only two calls are needed (start a
 * checkout, open the portal), so there is no SDK to keep up to date.
 * https://docs.creem.io/api-reference/introduction
 */

const LIVE_API = 'https://api.creem.io'
const TEST_API = 'https://test-api.creem.io'

// Keys made with the dashboard's "Test mode" switch on start with creem_test_
// and only work against the test API, where no real money moves.
const TEST_KEY_PREFIX = 'creem_test_'

export function apiBase(apiKey = process.env.CREEM_API_KEY) {
  return String(apiKey || '').startsWith(TEST_KEY_PREFIX) ? TEST_API : LIVE_API
}

/** Product ID of the monthly custom domain plan. */
export function customDomainProductId() {
  return process.env.CREEM_CUSTOM_DOMAIN_PRODUCT_ID || null
}

/**
 * Product ID of the Pro + Shop plan: everything the custom domain plan has,
 * plus a shop on the writer's profile ($2 + $1 a month).
 */
export function shopProductId() {
  return process.env.CREEM_SHOP_PRODUCT_ID || null
}

/** Whether a Creem product ID is the Pro + Shop plan. */
export function isShopProduct(productId) {
  const shop = shopProductId()
  return Boolean(shop && productId && productId === shop)
}

/**
 * Creem product IDs for the plans this deployment sells (custom domain monthly
 * and yearly, and Pro + Shop). A Creem store can hold other apps' products
 * too, and every webhook endpoint in it receives every event, so the webhook
 * route needs to tell ours apart.
 */
export function customDomainProductIds() {
  return [
    process.env.CREEM_CUSTOM_DOMAIN_PRODUCT_ID,
    process.env.CREEM_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID,
    process.env.CREEM_SHOP_PRODUCT_ID,
  ].filter(Boolean)
}

export class CreemError extends Error {
  constructor(message, { status = null, traceId = null } = {}) {
    super(message)
    this.name = 'CreemError'
    this.status = status
    // Creem support asks for this when something needs looking into.
    this.traceId = traceId
  }
}

async function post(path, body) {
  const apiKey = process.env.CREEM_API_KEY
  if (!apiKey) throw new CreemError('CREEM_API_KEY not configured')

  const response = await fetch(`${apiBase(apiKey)}${path}`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch (_) {
    // An error page instead of JSON: reported below by its status.
  }

  if (!response.ok) {
    const detail = Array.isArray(data?.message) ? data.message.join('; ') : data?.message || data?.error
    throw new CreemError(`Creem answered ${response.status} to ${path}${detail ? `: ${detail}` : ''}`, {
      status: response.status,
      traceId: data?.trace_id || null,
    })
  }
  return data
}

/**
 * Start a checkout for one product. `metadata` comes back on the subscription
 * in every webhook, which is how a payment is matched to a writer.
 * Returns `{ id, url }`; send the writer to `url`.
 */
export async function createCheckout({ productId, email, successUrl, metadata }) {
  const checkout = await post('/v1/checkouts', {
    product_id: productId,
    customer: { email },
    success_url: successUrl,
    metadata,
  })
  if (!checkout?.checkout_url) throw new CreemError('Creem returned a checkout without a URL')
  return { id: checkout.id, url: checkout.checkout_url }
}

/**
 * Move a writer's existing subscription to another plan (Pro -> Pro + Shop).
 * Creem charges the prorated difference straight away and sends
 * subscription.update, which the webhook applies like any other change.
 * Needs an API key that may write subscriptions.
 */
export async function upgradeSubscription(subscriptionId, productId) {
  if (!subscriptionId || !productId) throw new CreemError('upgradeSubscription needs a subscription and a product')
  return post(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}/upgrade`, {
    product_id: productId,
    update_behavior: 'proration-charge-immediately',
  })
}

/** A link to Creem's billing portal for one customer (cancel, change card, invoices). */
export async function createPortalLink(customerId) {
  const links = await post('/v1/customers/billing', { customer_id: customerId })
  if (!links?.customer_portal_link) throw new CreemError('Creem returned no portal link')
  return links.customer_portal_link
}

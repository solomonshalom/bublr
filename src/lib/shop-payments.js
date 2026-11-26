/**
 * Shop payments go straight to the writer. Each writer connects their own
 * payment account and Bublr starts checkouts on it with their API key:
 *
 *   - Stripe: any product, physical or digital, in any supported currency.
 *     Checkout Sessions with inline prices, so nothing is created in their
 *     Stripe account ahead of time. A restricted key with "Checkout Sessions:
 *     Write" is enough.
 *   - Creem: digital products only (Creem, a merchant of record, does not
 *     allow physical goods), in USD or EUR. Creem checkouts need a product, so
 *     one is created in the writer's store the first time an item is bought.
 *
 * Bublr takes no cut and never holds the money. Talks to both REST APIs with
 * fetch, like lib/creem.js.
 */

const STRIPE_API = 'https://api.stripe.com'
const CREEM_LIVE_API = 'https://api.creem.io'
const CREEM_TEST_API = 'https://test-api.creem.io'

export class PaymentProviderError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message)
    this.name = 'PaymentProviderError'
    this.status = status
    this.code = code
  }
}

export function detectProvider(apiKey) {
  const key = String(apiKey || '').trim()
  if (/^(sk|rk)_(live|test)_[A-Za-z0-9]{10,}$/.test(key)) return 'stripe'
  if (/^creem_(test_)?[A-Za-z0-9]{10,}$/.test(key)) return 'creem'
  return null
}

export function keyMode(apiKey) {
  const key = String(apiKey || '')
  return /^(sk|rk)_test_/.test(key) || key.startsWith('creem_test_') ? 'test' : 'live'
}

// ---------------------------------------------------------------- Stripe

// Stripe takes form-encoded bodies with bracketed keys for nested objects.
export function toFormBody(value, prefix = '', out = new URLSearchParams()) {
  if (value === undefined || value === null) return out
  if (Array.isArray(value)) {
    value.forEach((item, i) => toFormBody(item, `${prefix}[${i}]`, out))
  } else if (typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      toFormBody(inner, prefix ? `${prefix}[${key}]` : key, out)
    }
  } else {
    out.append(prefix, String(value))
  }
  return out
}

export async function stripeRequest(apiKey, method, path, body, { idempotencyKey } = {}) {
  const headers = { Authorization: `Bearer ${apiKey}` }
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded'
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers,
    body: body ? toFormBody(body).toString() : undefined,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data?.error?.message || `Stripe answered ${response.status}`
    throw new PaymentProviderError(message, { status: response.status, code: data?.error?.code || data?.error?.type || null })
  }
  return data
}

async function verifyStripeKey(apiKey) {
  // Needs only what the shop uses: reading/creating Checkout Sessions.
  await stripeRequest(apiKey, 'GET', '/v1/checkout/sessions?limit=1')
  let accountName = null
  try {
    const account = await stripeRequest(apiKey, 'GET', '/v1/account')
    accountName = account?.settings?.dashboard?.display_name || account?.business_profile?.name || null
  } catch (_) {
    // Restricted keys usually can't read the account; that's fine.
  }
  return { accountName }
}

function stripeShipping(buyer) {
  if (!buyer?.address1) return undefined
  return {
    name: `${buyer.first_name} ${buyer.last_name}`.trim(),
    phone: buyer.phone || undefined,
    address: {
      line1: buyer.address1,
      line2: buyer.address2 || undefined,
      city: buyer.city,
      state: buyer.region || undefined,
      postal_code: buyer.zip,
      country: buyer.country,
    },
  }
}

async function createStripeCheckout({ apiKey, product, variantTitle, buyer, orderId, successUrl, cancelUrl, metadata }) {
  const name = variantTitle ? `${product.title} (${variantTitle})` : product.title
  const lineItems = [
    {
      quantity: 1,
      price_data: {
        currency: product.currency,
        unit_amount: product.price,
        product_data: {
          name: name.slice(0, 250),
          ...(product.description ? { description: product.description.slice(0, 500) } : {}),
          ...(product.images?.[0] ? { images: [product.images[0]] } : {}),
        },
      },
    },
  ]
  if (product.kind === 'physical' && product.shipping > 0) {
    lineItems.push({
      quantity: 1,
      price_data: { currency: product.currency, unit_amount: product.shipping, product_data: { name: 'Shipping' } },
    })
  }

  const session = await stripeRequest(
    apiKey,
    'POST',
    '/v1/checkout/sessions',
    {
      mode: 'payment',
      line_items: lineItems,
      customer_email: buyer.email,
      client_reference_id: orderId,
      success_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cancelUrl}${cancelUrl.includes('?') ? '&' : '?'}checkout=cancelled`,
      metadata,
      payment_intent_data: {
        description: `${name} — Bublr shop`.slice(0, 1000),
        metadata,
        shipping: product.kind === 'physical' ? stripeShipping(buyer) : undefined,
      },
    },
    { idempotencyKey: `bublr-${orderId}` }
  )
  if (!session?.url) throw new PaymentProviderError('Stripe returned a checkout without a URL')
  return { id: session.id, url: session.url }
}

async function retrieveStripeCheckout({ apiKey, checkoutId }) {
  const session = await stripeRequest(
    apiKey,
    'GET',
    `/v1/checkout/sessions/${encodeURIComponent(checkoutId)}?expand[]=payment_intent`
  )
  const shipping = session.payment_intent && typeof session.payment_intent === 'object' ? session.payment_intent.shipping : null
  return {
    id: session.id,
    paid: session.payment_status === 'paid' && session.status === 'complete',
    amount: session.amount_total,
    currency: session.currency,
    email: session.customer_details?.email || session.customer_email || null,
    name: session.customer_details?.name || shipping?.name || null,
    shipping: shipping
      ? {
          name: shipping.name || null,
          phone: shipping.phone || null,
          address: shipping.address || null,
        }
      : null,
    metadata: session.metadata || {},
  }
}

// ---------------------------------------------------------------- Creem

export function creemBase(apiKey) {
  return String(apiKey || '').startsWith('creem_test_') ? CREEM_TEST_API : CREEM_LIVE_API
}

export async function creemRequest(apiKey, method, path, body) {
  const response = await fetch(`${creemBase(apiKey)}${path}`, {
    method,
    headers: { 'x-api-key': apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch (_) {
    // reported below by status
  }
  if (!response.ok) {
    const detail = Array.isArray(data?.message) ? data.message.join('; ') : data?.message || data?.error
    throw new PaymentProviderError(detail || `Creem answered ${response.status}`, { status: response.status, code: data?.code || null })
  }
  return data
}

async function verifyCreemKey(apiKey) {
  await creemRequest(apiKey, 'GET', '/v1/products/search?page_number=1&page_size=1')
  return { accountName: null }
}

/** Create the Creem product a Bublr item is sold as (one per price). */
export async function createCreemProduct({ apiKey, product }) {
  const created = await creemRequest(apiKey, 'POST', '/v1/products', {
    name: product.title.slice(0, 200),
    description: (product.description || product.title).slice(0, 1000),
    ...(product.images?.[0] ? { image_url: product.images[0] } : {}),
    price: product.price,
    currency: product.currency.toUpperCase(),
    billing_type: 'onetime',
    tax_mode: 'inclusive',
    tax_category: 'digital-goods-service',
    metadata: { source: 'bublr', bublr_product: product.id },
  })
  if (!created?.id) throw new PaymentProviderError('Creem returned a product without an id')
  return created.id
}

async function createCreemCheckout({ apiKey, creemProductId, buyer, orderId, successUrl, metadata }) {
  const checkout = await creemRequest(apiKey, 'POST', '/v1/checkouts', {
    product_id: creemProductId,
    units: 1,
    request_id: orderId,
    customer: { email: buyer.email },
    success_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}checkout=success`,
    metadata,
  })
  if (!checkout?.checkout_url) throw new PaymentProviderError('Creem returned a checkout without a URL')
  return { id: checkout.id, url: checkout.checkout_url }
}

async function retrieveCreemCheckout({ apiKey, checkoutId }) {
  const checkout = await creemRequest(apiKey, 'GET', `/v1/checkouts?checkout_id=${encodeURIComponent(checkoutId)}`)
  const order = checkout?.order && typeof checkout.order === 'object' ? checkout.order : null
  const customer = checkout?.customer && typeof checkout.customer === 'object' ? checkout.customer : null
  return {
    id: checkout?.id,
    name: customer?.name || null,
    shipping: null,
    paid: checkout?.status === 'completed' && (!order || order.status === 'paid'),
    amount: order?.amount ?? null,
    currency: order?.currency ? String(order.currency).toLowerCase() : null,
    email: customer?.email || null,
    metadata: checkout?.metadata || {},
  }
}

// ---------------------------------------------------------------- shared

export async function verifyKey(provider, apiKey) {
  if (provider === 'stripe') return verifyStripeKey(apiKey)
  if (provider === 'creem') return verifyCreemKey(apiKey)
  throw new PaymentProviderError('Unknown payment provider')
}

export async function createProviderCheckout(provider, params) {
  if (provider === 'stripe') return createStripeCheckout(params)
  if (provider === 'creem') return createCreemCheckout(params)
  throw new PaymentProviderError('Unknown payment provider')
}

export async function retrieveProviderCheckout(provider, params) {
  if (provider === 'stripe') return retrieveStripeCheckout(params)
  if (provider === 'creem') return retrieveCreemCheckout(params)
  throw new PaymentProviderError('Unknown payment provider')
}

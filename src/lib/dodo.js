import crypto from 'crypto'

/**
 * Dodo Payments, server side only.
 *
 * A small REST client instead of the `dodopayments` SDK: we use four
 * endpoints, and plain fetch keeps the Next 11 server bundle simple and lets
 * the tests stub the network. Webhooks follow the Standard Webhooks spec
 * (https://www.standardwebhooks.com), verified here with Node's crypto.
 *
 * Environment:
 *   DODO_PAYMENTS_API_KEY       API key from Dodo (Developer -> API keys)
 *   DODO_PAYMENTS_WEBHOOK_KEY   signing secret of the webhook endpoint ("whsec_...")
 *   DODO_PAYMENTS_PRODUCT_ID    the $4.99/month subscription product ("pdt_...")
 *   DODO_PAYMENTS_ENVIRONMENT   "test_mode" or "live_mode" (optional, see below)
 */

const BASE_URLS = {
  live_mode: 'https://live.dodopayments.com',
  test_mode: 'https://test.dodopayments.com',
}

const REQUEST_TIMEOUT_MS = 15000

// Standard Webhooks: reject deliveries signed more than 5 minutes away from now
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60

export function dodoEnvironment() {
  const explicit = String(process.env.DODO_PAYMENTS_ENVIRONMENT || '').trim().toLowerCase()
  if (explicit === 'live' || explicit === 'live_mode') return 'live_mode'
  if (explicit === 'test' || explicit === 'test_mode') return 'test_mode'
  // Keys only work in their own mode, so a test key implies test mode
  if (String(process.env.DODO_PAYMENTS_API_KEY || '').startsWith('dodo_test')) return 'test_mode'
  return process.env.NODE_ENV === 'production' ? 'live_mode' : 'test_mode'
}

export function dodoConfig() {
  const environment = dodoEnvironment()
  return {
    apiKey: process.env.DODO_PAYMENTS_API_KEY || '',
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY || '',
    productId: process.env.DODO_PAYMENTS_PRODUCT_ID || '',
    environment,
    baseUrl: BASE_URLS[environment],
  }
}

/** Can we start checkouts? (API key and product configured) */
export function isBillingConfigured() {
  const { apiKey, productId } = dodoConfig()
  return Boolean(apiKey && productId)
}

export class DodoError extends Error {
  constructor(message, { status = 0, body = null } = {}) {
    super(message)
    this.name = 'DodoError'
    this.status = status
    this.body = body
  }
}

async function dodoRequest(method, path, body) {
  const { apiKey, baseUrl } = dodoConfig()
  if (!apiKey) throw new DodoError('DODO_PAYMENTS_API_KEY is not set')

  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null

  let res
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller ? controller.signal : undefined,
    })
  } catch (error) {
    throw new DodoError(`Could not reach Dodo Payments: ${error.message}`)
  } finally {
    if (timer) clearTimeout(timer)
  }

  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch (_) {
      data = { raw: text }
    }
  }

  if (!res.ok) {
    const detail = data?.message || data?.error?.message || data?.error || data?.code || `HTTP ${res.status}`
    throw new DodoError(`Dodo Payments ${method} ${path} failed: ${detail}`, { status: res.status, body: data })
  }
  return data
}

const enc = encodeURIComponent

/**
 * Start a hosted checkout for the Pro subscription.
 * Dodo sends the buyer back to `returnUrl` with `subscription_id` and
 * `status` added to the query string.
 */
export function createCheckoutSession({ productId, email, name, returnUrl, cancelUrl, metadata }) {
  const body = {
    product_cart: [{ product_id: productId, quantity: 1 }],
    return_url: returnUrl,
    metadata,
  }
  if (cancelUrl) body.cancel_url = cancelUrl
  if (email) body.customer = name ? { email, name } : { email }
  return dodoRequest('POST', '/checkouts', body)
}

export function getSubscription(subscriptionId) {
  return dodoRequest('GET', `/subscriptions/${enc(subscriptionId)}`)
}

export function updateSubscription(subscriptionId, patch) {
  return dodoRequest('PATCH', `/subscriptions/${enc(subscriptionId)}`, patch)
}

/** A one-off link to Dodo's customer portal (update card, invoices, cancel). */
export function createCustomerPortalSession(customerId, { returnUrl } = {}) {
  const query = returnUrl ? `?return_url=${enc(returnUrl)}` : ''
  return dodoRequest('POST', `/customers/${enc(customerId)}/customer-portal/session${query}`)
}

// ---- Webhooks ----

export class WebhookVerificationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'WebhookVerificationError'
  }
}

function webhookKeyBytes(secret) {
  const value = String(secret || '').trim()
  if (!value) throw new WebhookVerificationError('Webhook secret is not configured')
  const base64 = value.startsWith('whsec_') ? value.slice('whsec_'.length) : value
  const key = Buffer.from(base64, 'base64')
  if (!key.length) throw new WebhookVerificationError('Webhook secret is empty')
  return key
}

function headerValue(headers, name) {
  if (!headers) return undefined
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined
  const direct = headers[name] ?? headers[name.toLowerCase()]
  if (direct !== undefined) return Array.isArray(direct) ? direct[0] : direct
  const key = Object.keys(headers).find(k => k.toLowerCase() === name)
  const value = key ? headers[key] : undefined
  return Array.isArray(value) ? value[0] : value
}

export function signWebhook(secret, { id, timestamp, payload }) {
  const signed = `${id}.${timestamp}.${typeof payload === 'string' ? payload : payload.toString('utf8')}`
  return `v1,${crypto.createHmac('sha256', webhookKeyBytes(secret)).update(signed).digest('base64')}`
}

/**
 * Check a webhook delivery's signature and return the parsed event.
 * Throws WebhookVerificationError when it can't be trusted.
 *
 * @param {string|Buffer} payload  the raw request body, byte for byte
 */
export function verifyWebhook(payload, headers, secret, { now = Date.now() } = {}) {
  const id = headerValue(headers, 'webhook-id')
  const timestamp = headerValue(headers, 'webhook-timestamp')
  const signatures = headerValue(headers, 'webhook-signature')
  if (!id || !timestamp || !signatures) throw new WebhookVerificationError('Missing webhook signature headers')

  const seconds = Number.parseInt(timestamp, 10)
  if (!Number.isFinite(seconds) || String(seconds) !== String(timestamp).trim()) {
    throw new WebhookVerificationError('Invalid webhook timestamp')
  }
  const nowSeconds = Math.floor(now / 1000)
  if (nowSeconds - seconds > WEBHOOK_TOLERANCE_SECONDS) throw new WebhookVerificationError('Webhook timestamp too old')
  if (seconds - nowSeconds > WEBHOOK_TOLERANCE_SECONDS) throw new WebhookVerificationError('Webhook timestamp too new')

  const expected = Buffer.from(signWebhook(secret, { id, timestamp: seconds, payload }).slice(3), 'base64')
  const matches = String(signatures)
    .split(' ')
    .map(entry => entry.trim())
    .filter(Boolean)
    .some(entry => {
      const [version, signature] = entry.split(',')
      if (version !== 'v1' || !signature) return false
      const given = Buffer.from(signature, 'base64')
      return given.length === expected.length && crypto.timingSafeEqual(given, expected)
    })
  if (!matches) throw new WebhookVerificationError('No matching webhook signature')

  try {
    return JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8'))
  } catch (_) {
    throw new WebhookVerificationError('Webhook body is not JSON')
  }
}

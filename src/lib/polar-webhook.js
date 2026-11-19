import crypto from 'crypto'

/**
 * Reads a webhook delivery from Polar: checks the signature, then returns the
 * event in the shape the subscription route uses.
 *
 * This stands in for `validateEvent` from @polar-sh/sdk 0.x, which can't be
 * relied on any more:
 *
 *  - Secrets Polar has generated since 8 September 2026 sign with the Standard
 *    Webhooks key. The 0.x SDK only knows the older key, so it rejects every
 *    delivery from an endpoint created after that date.
 *  - It throws on any event type newer than itself (subscription.cycled,
 *    subscription.past_due, ...), which the route answered with a 500. Polar
 *    retries those and switches the endpoint off after ten failures in a row.
 *
 * So the signature is checked here against both keys, and the payload is read
 * as plain JSON: only the few subscription fields Bublr stores, whatever API
 * version the endpoint is set to.
 * https://polar.sh/docs/integrate/webhooks/delivery
 */

// How far the delivery's timestamp may be from our clock (Standard Webhooks).
const TOLERANCE_SECONDS = 5 * 60

const STANDARD_PREFIX = 'whsec_'

export class WebhookVerificationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'WebhookVerificationError'
  }
}

function header(headers, name) {
  const value = headers?.[name]
  return Array.isArray(value) ? value[0] : value
}

/**
 * The keys Polar may have signed with for this secret. Which one depends on
 * when the secret was made, and the secret alone doesn't say, so try both.
 */
function signingKeys(secret) {
  const keys = [
    // Before 8 September 2026: the secret's own UTF-8 bytes.
    Buffer.from(secret, 'utf8'),
  ]
  if (secret.startsWith(STANDARD_PREFIX)) {
    // Since then (Standard Webhooks): what follows the prefix, base64-decoded.
    keys.push(Buffer.from(secret.slice(STANDARD_PREFIX.length), 'base64'))
  }
  // An empty key would accept a signature anyone can compute.
  return keys.filter(key => key.length > 0)
}

/**
 * Throws WebhookVerificationError unless `body` (the raw request body, exactly
 * as received) was signed by Polar with `secret`.
 */
export function verifySignature(body, headers, secret, { now = Date.now() } = {}) {
  const id = header(headers, 'webhook-id')
  const timestamp = header(headers, 'webhook-timestamp')
  const signatures = header(headers, 'webhook-signature')
  if (!id || !timestamp || !signatures) {
    throw new WebhookVerificationError('Missing webhook signature headers')
  }

  const sentAt = Number(timestamp)
  if (!Number.isFinite(sentAt)) throw new WebhookVerificationError('Invalid webhook timestamp')
  if (Math.abs(now / 1000 - sentAt) > TOLERANCE_SECONDS) {
    throw new WebhookVerificationError('Webhook timestamp is too old or too new')
  }

  const signedContent = `${id}.${timestamp}.${body}`
  const expected = signingKeys(String(secret || '')).map(key =>
    crypto.createHmac('sha256', key).update(signedContent).digest()
  )

  // The header is a space-separated list of `v1,<base64 signature>`.
  const provided = String(signatures)
    .split(' ')
    .map(part => part.split(','))
    .filter(([version, value]) => version === 'v1' && value)
    .map(([, value]) => Buffer.from(value, 'base64'))

  const matches = provided.some(signature =>
    expected.some(mac => signature.length === mac.length && crypto.timingSafeEqual(signature, mac))
  )
  if (!matches) throw new WebhookVerificationError('No matching signature found')
}

function toDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * A subscription from a webhook payload, with the names the route already
 * uses. Nothing is left undefined: Firestore refuses undefined values.
 */
function subscriptionFromPayload(data) {
  return {
    id: data.id ?? null,
    status: data.status ?? null,
    customerId: data.customer_id ?? null,
    productId: data.product_id ?? null,
    recurringInterval: data.recurring_interval ?? null,
    currentPeriodStart: toDate(data.current_period_start),
    currentPeriodEnd: toDate(data.current_period_end),
    cancelAtPeriodEnd: data.cancel_at_period_end === true,
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},
  }
}

/**
 * Verify a delivery and return `{ type, data }`. Subscription events get the
 * shape above; any other event keeps Polar's own payload. Event types we've
 * never heard of come back like any other, for the caller to acknowledge.
 */
export function validateEvent(body, headers, secret, options) {
  verifySignature(body, headers, secret, options)

  const payload = JSON.parse(body)
  const type = typeof payload?.type === 'string' ? payload.type : ''
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {}

  return {
    type,
    data: type.startsWith('subscription.') ? subscriptionFromPayload(data) : data,
  }
}

/**
 * Polar product IDs for the custom domain plans this deployment sells. A Polar
 * organization can hold other products too, and every webhook endpoint in it
 * receives every event, so the route needs to tell ours apart.
 */
export function customDomainProductIds() {
  return [
    process.env.POLAR_CUSTOM_DOMAIN_PRODUCT_ID,
    process.env.POLAR_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID,
  ].filter(Boolean)
}

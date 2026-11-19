import crypto from 'crypto'

/**
 * Reads a webhook delivery from Creem: checks the signature, then returns the
 * event with its subscription in the shape Bublr stores.
 *
 * Creem signs the raw request body with HMAC-SHA256, keyed with the endpoint's
 * signing secret, and sends the hex digest in the `creem-signature` header.
 * The payload is `{ id, eventType, created_at, object }`.
 * https://docs.creem.io/code/webhooks
 */

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
 * Throws WebhookVerificationError unless `body` (the raw request body, exactly
 * as received) was signed by Creem with `secret`.
 */
export function verifySignature(body, headers, secret) {
  const signature = header(headers, 'creem-signature')
  if (!signature) throw new WebhookVerificationError('Missing creem-signature header')

  // An empty key would accept a signature anyone can compute.
  const key = String(secret || '')
  if (!key) throw new WebhookVerificationError('Webhook secret is empty')

  const expected = crypto.createHmac('sha256', key).update(body).digest()
  const provided = Buffer.from(String(signature).trim(), 'hex')
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new WebhookVerificationError('Signature does not match')
  }
}

function toDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// Creem sends related objects either whole or as just their ID.
function idOf(value) {
  if (typeof value === 'string') return value
  return value && typeof value === 'object' && typeof value.id === 'string' ? value.id : null
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

/**
 * A subscription from a webhook payload, with the names Bublr stores. Nothing
 * is left undefined: Firestore refuses undefined values.
 *
 * `checkout` is the checkout the subscription arrived inside, when there is
 * one. Its customer, product and metadata fill in what the nested subscription
 * only carries as IDs, or not at all.
 */
function subscriptionFromPayload(subscription, checkout = {}) {
  const customer = plainObject(subscription.customer)
  const checkoutCustomer = plainObject(checkout.customer)
  const status = typeof subscription.status === 'string' ? subscription.status : null

  return {
    id: subscription.id ?? null,
    status,
    customerId: idOf(subscription.customer) ?? idOf(checkout.customer),
    customerEmail: customer.email || checkoutCustomer.email || null,
    productId: idOf(subscription.product) ?? idOf(checkout.product),
    currentPeriodStart: toDate(subscription.current_period_start_date),
    currentPeriodEnd: toDate(subscription.current_period_end_date),
    // Creem has no separate flag: a subscription that won't renew is
    // "scheduled_cancel" until its paid period is over, then "canceled".
    cancelAtPeriodEnd: status === 'scheduled_cancel' || status === 'canceled',
    metadata: { ...plainObject(checkout.metadata), ...plainObject(subscription.metadata) },
  }
}

/**
 * Verify a delivery and return `{ id, type, createdAt, subscription, object }`.
 *
 * `subscription` is set for every `subscription.*` event and for a completed
 * checkout that started one; it is null for everything else. Event types we've
 * never heard of come back like any other, for the caller to acknowledge.
 */
export function validateEvent(body, headers, secret) {
  verifySignature(body, headers, secret)

  const payload = JSON.parse(body)
  const type = typeof payload?.eventType === 'string' ? payload.eventType : ''
  const object = plainObject(payload?.object)

  let subscription = null
  if (type.startsWith('subscription.')) {
    subscription = subscriptionFromPayload(object)
  } else if (type === 'checkout.completed' && idOf(object.subscription)) {
    subscription = subscriptionFromPayload(plainObject(object.subscription), object)
    subscription.id = idOf(object.subscription)
  }

  return {
    id: typeof payload?.id === 'string' ? payload.id : null,
    type,
    // Milliseconds. Retries of one event keep it, so it orders deliveries.
    createdAt: Number.isFinite(payload?.created_at) ? payload.created_at : null,
    subscription,
    object,
  }
}

import { dodoConfig, getSubscription, isBillingConfigured, verifyWebhook, WebhookVerificationError } from '../../../lib/dodo'
import { applyDodoSubscription } from '../../../lib/billing'

// The signature covers the exact bytes Dodo sent, so read the raw body
export const config = {
  api: {
    bodyParser: false,
  },
}

const MAX_BODY_BYTES = 1024 * 1024

async function readRawBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    size += buf.length
    if (size > MAX_BODY_BYTES) throw new Error('Webhook body too large')
    chunks.push(buf)
  }
  return Buffer.concat(chunks)
}

/**
 * Dodo Payments webhook endpoint: https://<your site>/api/subscription/webhook
 *
 * Answers 2xx once an event is stored (or deliberately ignored), 401 for a bad
 * signature, and 5xx when something on our side failed so Dodo retries.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { webhookKey } = dodoConfig()
  if (!webhookKey) {
    console.error('DODO_PAYMENTS_WEBHOOK_KEY is not set; refusing webhook so Dodo retries later')
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }

  let raw
  try {
    raw = await readRawBody(req)
  } catch (error) {
    return res.status(413).json({ error: error.message })
  }

  let event
  try {
    event = verifyWebhook(raw, req.headers, webhookKey)
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      console.warn('Rejected Dodo webhook:', error.message)
      return res.status(401).json({ error: 'Invalid webhook signature' })
    }
    throw error
  }

  const type = String(event?.type || '')
  const data = event?.data

  // Payment, refund, dispute events: the subscription events carry what we need
  if (!type.startsWith('subscription.') || !data?.subscription_id) {
    return res.status(200).json({ received: true, ignored: true })
  }

  // Deliveries can be late or out of order: ask Dodo for the current state
  // and use the payload only if that fails
  let subscription = data
  // How current our copy is: the event time for the payload, or when we asked Dodo
  let snapshotAt = Date.parse(event.timestamp) || Date.now()
  if (isBillingConfigured()) {
    try {
      const askedAt = Date.now()
      const fresh = await getSubscription(data.subscription_id)
      if (fresh?.subscription_id) {
        subscription = { ...data, ...fresh }
        snapshotAt = askedAt
      }
    } catch (error) {
      console.warn(`Using webhook payload for ${data.subscription_id}; refresh failed:`, error.message)
    }
  }

  try {
    const result = await applyDodoSubscription(subscription, { source: `webhook:${type}`, snapshotAt })
    return res.status(200).json({ received: true, applied: result.applied, reason: result.reason || null })
  } catch (error) {
    console.error('Error processing Dodo webhook:', error)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}

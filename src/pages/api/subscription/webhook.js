import { validateEvent, WebhookVerificationError } from '../../../lib/creem-webhook'
import { customDomainProductIds, isShopProduct } from '../../../lib/creem'
import firebase, { firestore } from '../../../lib/firebase'
import { sendSubscriptionEmail } from '../../../lib/resend'
import { signShopGrant } from '../../../lib/shop-trust'

// Disable body parsing, we need the raw body for webhook verification
export const config = {
  api: {
    bodyParser: false,
  },
}

// Helper to get raw body
async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const rawBody = await getRawBody(req)
    const bodyString = rawBody.toString('utf8')

    const secret = process.env.CREEM_WEBHOOK_SECRET
    if (!secret) {
      console.error('CREEM_WEBHOOK_SECRET not configured')
      return res.status(500).json({ error: 'Webhook secret not configured' })
    }

    // Verify webhook signature
    let event
    try {
      event = validateEvent(bodyString, req.headers, secret)
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        console.error('Webhook verification failed:', error.message)
        return res.status(403).json({ error: 'Invalid webhook signature' })
      }
      throw error
    }

    // Creem retries anything that isn't a 2xx, so everything we have no use
    // for is acknowledged: refunds, disputes, one-time purchases, new event types.
    const subscription = event.subscription
    if (!subscription?.id) {
      console.log('Nothing to do for event type:', event.type)
      return res.status(200).json({ received: true })
    }

    // The Creem store may sell other products as well, and this endpoint is
    // sent their events too. Acknowledge those and leave them be.
    if (!(await isCustomDomainSubscription(subscription))) {
      console.log('Ignoring', event.type, 'for another product:', subscription.productId)
      return res.status(200).json({ received: true })
    }

    const userId = await findUserId(subscription)
    if (!userId) {
      console.error('No user found for subscription:', subscription.id)
      return res.status(200).json({ received: true })
    }

    const outcome = await applyEvent(userId, event)
    if (outcome?.email && outcome.sendTo) {
      await sendSubscriptionEmail({ userEmail: outcome.sendTo, userName: outcome.userName, ...outcome.email })
    }
    console.log('Subscription', subscription.id, event.type, 'for user', userId, '->', outcome ? outcome.summary : 'no change')

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}

// Whether a subscription event is about a custom domain plan.
async function isCustomDomainSubscription(subscription) {
  if (customDomainProductIds().includes(subscription.productId)) return true

  // A subscription already on a writer's record stays ours, even if the
  // product IDs in the environment have changed since they bought it.
  return (await findUserBy('subscription.id', subscription.id)) !== null
}

async function findUserBy(field, value) {
  if (!value) return null
  const snapshot = await firestore.collection('users').where(field, '==', value).limit(1).get()
  return snapshot.empty ? null : snapshot.docs[0].id
}

// The writer a subscription belongs to. The checkout carries their ID in its
// metadata; Creem copies that onto the subscription, but not onto every event.
async function findUserId(subscription) {
  const fromMetadata = subscription.metadata?.userId
  if (typeof fromMetadata === 'string' && fromMetadata && !fromMetadata.includes('/')) {
    const doc = await firestore.collection('users').doc(fromMetadata).get()
    if (doc.exists) return fromMetadata
  }
  return (
    (await findUserBy('subscription.id', subscription.id)) ||
    (await findUserBy('subscription.customerId', subscription.customerId))
  )
}

/**
 * Whether this event leaves the writer with the paid features.
 *
 * Cancelling doesn't take away what was paid for: a cancelled subscription
 * keeps access until the end of its period (checkSubscriptionAccess in
 * lib/subscription.js ends it then). A failed renewal does take it away, and
 * the next successful payment brings it back.
 */
function grantsAccess(type, subscription, now) {
  const periodOpen = subscription.currentPeriodEnd ? subscription.currentPeriodEnd > now : false

  // Sent up to a day after a period ran out unpaid. The status in it is
  // whatever it was, often still "active", so go by the dates.
  if (type === 'subscription.expired' && !periodOpen) return false

  switch (subscription.status) {
    case 'active':
    case 'trialing':
      return true
    case 'scheduled_cancel':
    case 'canceled':
      return periodOpen
    default:
      // past_due, unpaid, paused, incomplete, and anything new
      return false
  }
}

/**
 * Work out what an event changes on a writer's record: the fields to write and
 * the email to send, or null when the event should be left alone.
 */
function planChange(user, event, now = new Date()) {
  const subscription = event.subscription
  const before = user.subscription || null
  const sameSubscription = before?.id === subscription.id
  const access = grantsAccess(event.type, subscription, now)

  // An event about a subscription other than the one on record only counts if
  // it gives access (a new purchase). An old subscription winding down must
  // not take away what a newer one pays for.
  if (before?.id && !sameSubscription && !access) return null

  // Creem retries failed deliveries for up to a day, so an old event can
  // arrive after a newer one. Applying it would undo the newer state.
  if (sameSubscription && before.lastEventAt && event.createdAt && event.createdAt < before.lastEventAt) {
    return null
  }

  const hadAccess = sameSubscription && user.hasCustomDomainAccess === true
  const wasEnding = sameSubscription && before.cancelAtPeriodEnd === true

  let email = null
  if (access && !hadAccess) {
    // Creem sends several events for one new subscription. Only the first to
    // arrive finds no access yet, so there is one welcome.
    email = { type: 'activated' }
  } else if (hadAccess && subscription.cancelAtPeriodEnd && !wasEnding) {
    email = { type: 'canceled', periodEndDate: access ? subscription.currentPeriodEnd : null }
  } else if (hadAccess && !access) {
    email = { type: 'expired' }
  }

  const productId = subscription.productId ?? (sameSubscription ? before.productId ?? null : null)

  return {
    update: {
      subscription: {
        id: subscription.id,
        status: subscription.status,
        customerId: subscription.customerId ?? (sameSubscription ? before.customerId ?? null : null),
        productId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        lastEventAt: event.createdAt,
        updatedAt: now.toISOString(),
      },
      hasCustomDomainAccess: access,
      // The shop is part of the Pro + Shop plan only. Moving back to plain Pro
      // closes it; the products stay saved for when it reopens.
      hasShopAccess: access && isShopProduct(productId),
    },
    email,
    summary: `${subscription.status}, access ${access ? 'on' : 'off'}${access && isShopProduct(productId) ? ' (with shop)' : ''}${email ? `, ${email.type} email` : ''}`,
  }
}

// Read the writer's record and write the change in one transaction, so two
// deliveries arriving together can't both act on the same old state.
async function applyEvent(userId, event) {
  const userRef = firestore.collection('users').doc(userId)

  return firestore.runTransaction(async transaction => {
    const snapshot = await transaction.get(userRef)
    if (!snapshot.exists) return null

    const user = snapshot.data()
    const change = planChange(user, event)
    if (!change) return null

    // The shop opens only with the server's signature over this subscription
    // (user documents can be written without signing in; see lib/shop-trust).
    const grant = change.update.hasShopAccess ? signShopGrant(userId, change.update.subscription) : null
    if (change.update.hasShopAccess && !grant) console.error('Shop plan active but INTEGRATIONS_SECRET is missing; the shop stays closed')
    change.update.shopGrant = grant || firebase.firestore.FieldValue.delete()

    transaction.update(userRef, change.update)
    return {
      email: change.email,
      summary: change.summary,
      // Writers who signed up without an email on their profile still gave one at checkout.
      sendTo: user.email || event.subscription.customerEmail || null,
      userName: user.displayName || user.name,
    }
  })
}

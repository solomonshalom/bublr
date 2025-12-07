import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks'
import { firestore } from '../../../lib/firebase'
import { WEBHOOK_SECRET } from '../../../lib/polar'

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

    if (!WEBHOOK_SECRET) {
      console.error('POLAR_WEBHOOK_SECRET not configured')
      return res.status(500).json({ error: 'Webhook secret not configured' })
    }

    // Verify webhook signature
    let event
    try {
      event = validateEvent(bodyString, req.headers, WEBHOOK_SECRET)
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        console.error('Webhook verification failed:', error.message)
        return res.status(403).json({ error: 'Invalid webhook signature' })
      }
      throw error
    }

    // Handle different event types
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.active':
        await handleSubscriptionActive(event.data)
        break

      case 'subscription.updated':
        await handleSubscriptionUpdated(event.data)
        break

      case 'subscription.canceled':
      case 'subscription.revoked':
        await handleSubscriptionCanceled(event.data)
        break

      case 'order.paid':
        // Order has been paid - subscription should be active
        console.log('Order paid:', event.data.id)
        break

      default:
        console.log('Unhandled event type:', event.type)
    }

    return res.status(202).json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}

async function handleSubscriptionActive(subscription) {
  const userId = subscription.metadata?.userId
  if (!userId) {
    console.error('No userId in subscription metadata')
    return
  }

  // Update user's subscription status in Firestore
  await firestore.collection('users').doc(userId).update({
    subscription: {
      id: subscription.id,
      status: subscription.status,
      customerId: subscription.customerId,
      productId: subscription.productId,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
      updatedAt: new Date().toISOString(),
    },
    hasCustomDomainAccess: true,
  })

  console.log('Subscription activated for user:', userId)
}

async function handleSubscriptionUpdated(subscription) {
  const userId = subscription.metadata?.userId
  if (!userId) {
    // Try to find user by subscription ID
    const usersSnapshot = await firestore
      .collection('users')
      .where('subscription.id', '==', subscription.id)
      .limit(1)
      .get()

    if (usersSnapshot.empty) {
      console.error('No user found for subscription:', subscription.id)
      return
    }

    const userDoc = usersSnapshot.docs[0]
    await updateUserSubscription(userDoc.id, subscription)
    return
  }

  await updateUserSubscription(userId, subscription)
}

async function updateUserSubscription(userId, subscription) {
  const isActive = ['active', 'trialing'].includes(subscription.status)

  await firestore.collection('users').doc(userId).update({
    subscription: {
      id: subscription.id,
      status: subscription.status,
      customerId: subscription.customerId,
      productId: subscription.productId,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
      updatedAt: new Date().toISOString(),
    },
    hasCustomDomainAccess: isActive,
  })

  console.log('Subscription updated for user:', userId, 'Status:', subscription.status)
}

async function handleSubscriptionCanceled(subscription) {
  const userId = subscription.metadata?.userId

  // Try to find user by subscription ID if not in metadata
  let targetUserId = userId
  if (!targetUserId) {
    const usersSnapshot = await firestore
      .collection('users')
      .where('subscription.id', '==', subscription.id)
      .limit(1)
      .get()

    if (!usersSnapshot.empty) {
      targetUserId = usersSnapshot.docs[0].id
    }
  }

  if (!targetUserId) {
    console.error('No user found for canceled subscription:', subscription.id)
    return
  }

  // Update subscription status but keep the custom domain data
  // until period ends (if cancelAtPeriodEnd was true)
  await firestore.collection('users').doc(targetUserId).update({
    'subscription.status': subscription.status,
    'subscription.cancelAtPeriodEnd': true,
    'subscription.updatedAt': new Date().toISOString(),
    hasCustomDomainAccess: false,
  })

  console.log('Subscription canceled for user:', targetUserId)
}

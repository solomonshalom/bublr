import { firestore } from '../../../lib/firebase'
import { clientIp, isRateLimited } from '../../../lib/rate-limit'
import { sendConfirmationEmail } from '../../../lib/resend'
import { isPending, subscriberEmail } from '../../../lib/subscribers'
import { notifyNewSubscriber } from '../../../lib/subscriber-notify'

// Simple email validation
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (isRateLimited(`subscribe:${clientIp(req)}`, { max: 10, windowMs: 10 * 60 * 1000 })) {
    return res.status(429).json({ error: 'Too many attempts. Please try again in a few minutes.' })
  }

  const { email, authorUsername } = req.body

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email is required' })
  }

  if (!authorUsername) {
    return res.status(400).json({ error: 'Author username is required' })
  }

  try {
    // Find the author by username
    const usersSnapshot = await firestore
      .collection('users')
      .where('name', '==', authorUsername)
      .limit(1)
      .get()

    if (usersSnapshot.empty) {
      return res.status(404).json({ error: 'Author not found' })
    }

    const authorDoc = usersSnapshot.docs[0]
    const authorData = authorDoc.data()

    // Get current subscribers array or initialize empty
    const subscribers = authorData.subscribers || []

    const normalizedEmail = email.trim().toLowerCase()
    const existing = subscribers.find(sub => subscriberEmail(sub) === normalizedEmail)

    if (existing && !isPending(existing)) {
      return res.status(200).json({
        success: true,
        message: 'Already subscribed',
        alreadySubscribed: true
      })
    }

    // With email configured, new sign-ups must confirm from their inbox
    // first, so nobody can be signed up (or flood a list) with addresses
    // they don't own. Without email there is nothing to confirm with.
    const needsConfirmation = !!process.env.RESEND_API_KEY

    if (existing) {
      // Still waiting for confirmation: send the email again, at most once a minute
      const last = Date.parse(existing.lastRequestedAt || existing.subscribedAt || '') || 0
      if (Date.now() - last > 60 * 1000) {
        const mail = await sendConfirmationEmail({
          subscriberEmail: normalizedEmail,
          authorName: authorData.displayName,
          authorUsername: authorData.name,
        })
        if (mail.success) {
          await firestore.collection('users').doc(authorDoc.id).update({
            subscribers: subscribers.map(sub =>
              sub === existing ? { ...existing, lastRequestedAt: new Date().toISOString() } : sub
            ),
          })
        }
      }
      return res.status(200).json({
        success: true,
        message: 'Check your email to confirm your subscription',
        pendingConfirmation: true,
      })
    }

    const newSubscriber = {
      email: normalizedEmail,
      subscribedAt: new Date().toISOString(),
      ...(needsConfirmation ? { pending: true, lastRequestedAt: new Date().toISOString() } : {}),
    }

    if (needsConfirmation) {
      const mail = await sendConfirmationEmail({
        subscriberEmail: normalizedEmail,
        authorName: authorData.displayName,
        authorUsername: authorData.name,
      })
      if (!mail.success) {
        return res.status(502).json({ error: "We couldn't send the confirmation email. Please try again." })
      }
      await firestore.collection('users').doc(authorDoc.id).update({
        subscribers: [...subscribers, newSubscriber],
      })
      return res.status(200).json({
        success: true,
        message: 'Check your email to confirm your subscription',
        pendingConfirmation: true,
      })
    }

    await firestore.collection('users').doc(authorDoc.id).update({
      subscribers: [...subscribers, newSubscriber],
    })
    await notifyNewSubscriber(authorDoc.id, normalizedEmail, subscribers.filter(s => !isPending(s)).length + 1)

    return res.status(200).json({
      success: true,
      message: 'Successfully subscribed!'
    })
  } catch (error) {
    console.error('Subscribe error:', error)
    return res.status(500).json({ error: 'Failed to subscribe' })
  }
}

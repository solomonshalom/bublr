import firebase from '../../../lib/firebase'
import { firestore } from '../../../lib/firebase'

// Simple email validation
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Helper to create notification
async function createNotification(data) {
  try {
    await firestore.collection('notifications').add({
      ...data,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
  } catch (error) {
    console.error('Failed to create notification:', error)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
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

    // Check if already subscribed
    const isAlreadySubscribed = subscribers.some(
      (sub) => (typeof sub === 'string' ? sub : sub.email) === email.toLowerCase()
    )

    if (isAlreadySubscribed) {
      return res.status(200).json({
        success: true,
        message: 'Already subscribed',
        alreadySubscribed: true
      })
    }

    // Add subscriber with timestamp
    const newSubscriber = {
      email: email.toLowerCase(),
      subscribedAt: new Date().toISOString(),
    }

    await firestore.collection('users').doc(authorDoc.id).update({
      subscribers: [...subscribers, newSubscriber],
    })

    // Create notification for the author about new subscriber
    try {
      // Mask email for privacy (show first few chars and domain)
      const emailParts = email.toLowerCase().split('@')
      const maskedEmail = emailParts[0].substring(0, 3) + '***@' + emailParts[1]

      await createNotification({
        recipientId: authorDoc.id,
        type: 'subscriber',
        actorId: null, // Anonymous subscriber
        actorName: maskedEmail,
        actorPhoto: `https://api.dicebear.com/7.x/initials/svg?seed=${email}`,
        postId: null,
        postTitle: null,
        postSlug: null,
        postAuthorName: null,
        message: `${maskedEmail} subscribed to your newsletter`,
        metadata: {
          subscriberCount: subscribers.length + 1,
        },
      })
    } catch (notifError) {
      console.error('Failed to create subscriber notification:', notifError)
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully subscribed!'
    })
  } catch (error) {
    console.error('Subscribe error:', error)
    return res.status(500).json({ error: 'Failed to subscribe' })
  }
}

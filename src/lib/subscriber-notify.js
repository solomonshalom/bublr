import firebase, { firestore } from './firebase'

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

// Tell the writer about a (confirmed) subscriber, with the address masked
export async function notifyNewSubscriber(authorId, email, subscriberCount) {
  try {
    const emailParts = email.split('@')
    const maskedEmail = emailParts[0].substring(0, 3) + '***@' + emailParts[1]
    await createNotification({
      recipientId: authorId,
      type: 'subscriber',
      actorId: null, // Anonymous subscriber
      actorName: maskedEmail,
      actorPhoto: `https://api.dicebear.com/7.x/initials/svg?seed=${email}`,
      postId: null,
      postTitle: null,
      postSlug: null,
      postAuthorName: null,
      message: `${maskedEmail} subscribed to your newsletter`,
      metadata: { subscriberCount },
    })
  } catch (notifError) {
    console.error('Failed to create subscriber notification:', notifError)
  }
}



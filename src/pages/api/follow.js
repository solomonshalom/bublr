import firebase from '../../lib/firebase'
import { firestore } from '../../lib/firebase'

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

  const { targetUserId, action, currentUserId } = req.body

  if (!targetUserId || !currentUserId) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (!['follow', 'unfollow'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' })
  }

  // Can't follow yourself
  if (targetUserId === currentUserId) {
    return res.status(400).json({ error: 'Cannot follow yourself' })
  }

  try {
    const currentUserRef = firestore.collection('users').doc(currentUserId)
    const targetUserRef = firestore.collection('users').doc(targetUserId)

    const [currentUserDoc, targetUserDoc] = await Promise.all([
      currentUserRef.get(),
      targetUserRef.get(),
    ])

    if (!currentUserDoc.exists) {
      return res.status(404).json({ error: 'Current user not found' })
    }

    if (!targetUserDoc.exists) {
      return res.status(404).json({ error: 'Target user not found' })
    }

    const currentUserData = currentUserDoc.data()
    const targetUserData = targetUserDoc.data()

    // Get current following/followers arrays or initialize empty
    const currentUserFollowing = currentUserData.following || []
    const targetUserFollowers = targetUserData.followers || []

    if (action === 'follow') {
      // Check if already following
      if (currentUserFollowing.includes(targetUserId)) {
        return res.status(200).json({
          success: true,
          isFollowing: true,
          message: 'Already following',
        })
      }

      // Update both users atomically using batch write
      const batch = firestore.batch()

      // Add to current user's following
      batch.update(currentUserRef, {
        following: firebase.firestore.FieldValue.arrayUnion(targetUserId),
      })

      // Add to target user's followers
      batch.update(targetUserRef, {
        followers: firebase.firestore.FieldValue.arrayUnion(currentUserId),
      })

      await batch.commit()

      // Create notification for the target user
      await createNotification({
        recipientId: targetUserId,
        type: 'follow',
        actorId: currentUserId,
        actorName: currentUserData.displayName || currentUserData.name,
        actorUsername: currentUserData.name, // Username for profile linking
        actorPhoto: currentUserData.photo || `https://api.dicebear.com/7.x/initials/svg?seed=${currentUserData.name}`,
        postId: null,
        postTitle: null,
        postSlug: null,
        postAuthorName: currentUserData.name,
        message: `${currentUserData.displayName || currentUserData.name} started following you`,
        metadata: {
          followerCount: targetUserFollowers.length + 1,
        },
      })

      return res.status(200).json({
        success: true,
        isFollowing: true,
        message: 'Successfully followed user',
      })
    } else {
      // Unfollow
      // Check if not following
      if (!currentUserFollowing.includes(targetUserId)) {
        return res.status(200).json({
          success: true,
          isFollowing: false,
          message: 'Not following',
        })
      }

      // Update both users atomically using batch write
      const batch = firestore.batch()

      // Remove from current user's following
      batch.update(currentUserRef, {
        following: firebase.firestore.FieldValue.arrayRemove(targetUserId),
      })

      // Remove from target user's followers
      batch.update(targetUserRef, {
        followers: firebase.firestore.FieldValue.arrayRemove(currentUserId),
      })

      await batch.commit()

      return res.status(200).json({
        success: true,
        isFollowing: false,
        message: 'Successfully unfollowed user',
      })
    }
  } catch (error) {
    console.error('Follow error:', error)
    return res.status(500).json({ error: 'Failed to update follow status' })
  }
}

import firebase from '../../../lib/firebase'
import { firestore } from '../../../lib/firebase'

/**
 * Notification types and their importance colors:
 * - subscriber: New newsletter subscriber (green: #2ECC71)
 * - follow: New follower (blue: #4D96FF)
 * - new_post: New post from followed user (purple: #cf52f2)
 */

export const NOTIFICATION_TYPES = {
  SUBSCRIBER: 'subscriber',
  FOLLOW: 'follow',
  NEW_POST: 'new_post',
}

export const NOTIFICATION_COLORS = {
  subscriber: '#2ECC71', // Green - new subscriber
  follow: '#4D96FF', // Blue - new follower
  new_post: '#cf52f2', // Purple - new post from followed user
}

export default async function handler(req, res) {
  const { method } = req

  // GET - Fetch notifications for a user
  if (method === 'GET') {
    const { userId, unreadOnly, limit = 50 } = req.query

    if (!userId) {
      return res.status(400).json({
        error: { message: 'Missing userId parameter', code: 'MISSING_USER_ID' },
      })
    }

    try {
      let query = firestore
        .collection('notifications')
        .where('recipientId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(parseInt(limit))

      const snapshot = await query.get()
      const notifications = []
      let unreadCount = 0

      snapshot.forEach((doc) => {
        const data = doc.data()
        const notification = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.getTime() || Date.now(),
        }
        notifications.push(notification)
        if (!data.read) unreadCount++
      })

      // If unreadOnly filter is set, filter after fetching
      const filteredNotifications = unreadOnly === 'true'
        ? notifications.filter(n => !n.read)
        : notifications

      return res.status(200).json({
        notifications: filteredNotifications,
        unreadCount,
      })
    } catch (error) {
      console.error('Get notifications error:', error.message, error.code)
      return res.status(500).json({
        error: { message: 'Failed to get notifications', code: 'INTERNAL_ERROR', details: error.message },
      })
    }
  }

  // POST - Create a new notification
  if (method === 'POST') {
    const {
      recipientId,
      type,
      actorId,
      actorName,
      actorPhoto,
      postId,
      postTitle,
      postSlug,
      postAuthorName,
      message,
      metadata,
    } = req.body

    if (!recipientId || !type) {
      return res.status(400).json({
        error: { message: 'Missing required fields', code: 'MISSING_FIELDS' },
      })
    }

    // Don't notify yourself
    if (recipientId === actorId) {
      return res.status(200).json({ success: true, skipped: true, reason: 'self-action' })
    }

    try {
      const notificationData = {
        recipientId,
        type,
        actorId: actorId || null,
        actorName: actorName || 'Someone',
        actorPhoto: actorPhoto || '',
        postId: postId || null,
        postTitle: postTitle || null,
        postSlug: postSlug || null,
        postAuthorName: postAuthorName || null,
        message: message || null,
        metadata: metadata || {},
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }

      const docRef = await firestore.collection('notifications').add(notificationData)

      return res.status(201).json({
        id: docRef.id,
        ...notificationData,
        createdAt: Date.now(),
      })
    } catch (error) {
      console.error('Create notification error:', error.message, error.code)
      return res.status(500).json({
        error: { message: 'Failed to create notification', code: 'INTERNAL_ERROR', details: error.message },
      })
    }
  }

  // PATCH - Mark notification(s) as read
  if (method === 'PATCH') {
    const { notificationId, userId, markAllRead } = req.body

    if (!userId) {
      return res.status(400).json({
        error: { message: 'Missing userId', code: 'MISSING_USER_ID' },
      })
    }

    try {
      if (markAllRead) {
        // Mark all notifications as read for this user
        const snapshot = await firestore
          .collection('notifications')
          .where('recipientId', '==', userId)
          .where('read', '==', false)
          .get()

        const batch = firestore.batch()
        snapshot.forEach((doc) => {
          batch.update(doc.ref, { read: true })
        })
        await batch.commit()

        return res.status(200).json({ success: true, updated: snapshot.size })
      } else if (notificationId) {
        // Mark single notification as read
        const notifRef = firestore.collection('notifications').doc(notificationId)
        const notifDoc = await notifRef.get()

        if (!notifDoc.exists) {
          return res.status(404).json({
            error: { message: 'Notification not found', code: 'NOT_FOUND' },
          })
        }

        // Verify ownership
        if (notifDoc.data().recipientId !== userId) {
          return res.status(403).json({
            error: { message: 'Not authorized', code: 'FORBIDDEN' },
          })
        }

        await notifRef.update({ read: true })
        return res.status(200).json({ success: true })
      }

      return res.status(400).json({
        error: { message: 'Must provide notificationId or markAllRead', code: 'MISSING_FIELDS' },
      })
    } catch (error) {
      console.error('Update notification error:', error.message, error.code)
      return res.status(500).json({
        error: { message: 'Failed to update notification', code: 'INTERNAL_ERROR', details: error.message },
      })
    }
  }

  // DELETE - Delete old notifications (cleanup)
  if (method === 'DELETE') {
    const { userId, olderThanDays = 30 } = req.body

    if (!userId) {
      return res.status(400).json({
        error: { message: 'Missing userId', code: 'MISSING_USER_ID' },
      })
    }

    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThanDays))

      const snapshot = await firestore
        .collection('notifications')
        .where('recipientId', '==', userId)
        .where('createdAt', '<', cutoffDate)
        .get()

      const batch = firestore.batch()
      snapshot.forEach((doc) => {
        batch.delete(doc.ref)
      })
      await batch.commit()

      return res.status(200).json({ success: true, deleted: snapshot.size })
    } catch (error) {
      console.error('Delete notifications error:', error.message, error.code)
      return res.status(500).json({
        error: { message: 'Failed to delete notifications', code: 'INTERNAL_ERROR', details: error.message },
      })
    }
  }

  return res.status(405).json({ error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } })
}

import { firestore } from '../../../lib/firebase'
import { requireSelf } from '../../../lib/server-auth'

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
  LIKE: 'like',
}

export const NOTIFICATION_COLORS = {
  subscriber: '#2ECC71', // Green - new subscriber
  follow: '#4D96FF', // Blue - new follower
  new_post: '#cf52f2', // Purple - new post from followed user
  like: '#E53E3E', // Red - post like
}

export default async function handler(req, res) {
  const { method } = req

  if (!['GET', 'PATCH', 'DELETE'].includes(method)) {
    return res.status(405).json({ error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } })
  }

  // Everything here acts on the signed-in user's own notifications
  const claimedUserId = method === 'GET' ? req.query?.userId : req.body?.userId
  const userId = await requireSelf(req, res, claimedUserId)
  if (!userId) return

  // GET - Fetch notifications for a user
  if (method === 'GET') {
    const { unreadOnly, limit = 50 } = req.query
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100)

    try {
      let query = firestore
        .collection('notifications')
        .where('recipientId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(safeLimit)

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

  // Notifications are created server-side only (follow, like, subscribe and
  // new-post routes), so there is no public POST: it let anyone forge them.

  // PATCH - Mark notification(s) as read
  if (method === 'PATCH') {
    const { notificationId, markAllRead } = req.body || {}

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
    const { olderThanDays = 30 } = req.body || {}

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

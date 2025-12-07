import firebase from '../../../lib/firebase'
import { firestore } from '../../../lib/firebase'
import crypto from 'crypto'

// View milestones that trigger notifications
const VIEW_MILESTONES = [100, 500, 1000, 5000, 10000, 50000, 100000]

// Helper to create notification
async function createMilestoneNotification(postId, postData, postAuthorData, views) {
  try {
    await firestore.collection('notifications').add({
      recipientId: postData.author,
      type: 'milestone',
      actorId: null,
      actorName: 'Bublr',
      actorPhoto: '',
      postId: postId,
      postTitle: postData.title || 'Your post',
      postSlug: postData.slug,
      postAuthorName: postAuthorData?.name || '',
      message: `Your post hit ${views.toLocaleString()} views!`,
      metadata: { views },
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
  } catch (error) {
    console.error('Failed to create milestone notification:', error)
  }
}

// YouTube-like view counting:
// - Deduplicate views from same visitor within a time window
// - Allow up to MAX_VIEWS_PER_DAY repeated views per visitor per post per day
// - Use IP + User-Agent hash for visitor identification (privacy-friendly)

const MAX_VIEWS_PER_DAY = 5 // YouTube allows 4-5 repeated views per day
const VIEW_COOLDOWN_MS = 30 * 1000 // 30 seconds minimum between views from same visitor

// Generate a privacy-friendly visitor hash from IP + User-Agent
function getVisitorHash(req) {
  const forwarded = req.headers['x-forwarded-for']
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown'
  const userAgent = req.headers['user-agent'] || 'unknown'

  // Create a hash that can't be reversed to identify the user
  return crypto
    .createHash('sha256')
    .update(`${ip}:${userAgent}`)
    .digest('hex')
    .substring(0, 16) // Use first 16 chars for shorter storage
}

// Get the start of today (UTC) for daily view limits
function getTodayKey() {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}

export default async function handler(req, res) {
  const { id, incr } = req.query

  if (!id) {
    return res.status(400).json({
      error: {
        message: 'Missing "id" query parameter',
        code: 'MISSING_ID',
      },
    })
  }

  try {
    const viewsRef = firestore.collection('views').doc(id)

    if (incr !== undefined) {
      const visitorHash = getVisitorHash(req)
      const todayKey = getTodayKey()
      const visitorKey = `${visitorHash}_${todayKey}`

      // Check visitor's view history for this post
      const visitorViewsRef = viewsRef.collection('visitors').doc(visitorHash)
      const visitorDoc = await visitorViewsRef.get()
      const visitorData = visitorDoc.exists ? visitorDoc.data() : null

      let shouldCount = true
      const now = Date.now()

      if (visitorData) {
        const lastViewTime = visitorData.lastViewTime?.toMillis?.() || visitorData.lastViewTime || 0
        const viewsToday = visitorData.viewsToday || 0
        const lastViewDate = visitorData.lastViewDate || ''

        // Reset daily counter if it's a new day
        const isNewDay = lastViewDate !== todayKey
        const currentViewsToday = isNewDay ? 0 : viewsToday

        // Check cooldown (prevent rapid refreshing)
        if (now - lastViewTime < VIEW_COOLDOWN_MS) {
          shouldCount = false
        }
        // Check daily limit (YouTube-style: max 4-5 views per day from same visitor)
        else if (currentViewsToday >= MAX_VIEWS_PER_DAY) {
          shouldCount = false
        }

        if (shouldCount) {
          // Update visitor record
          await visitorViewsRef.set({
            lastViewTime: firebase.firestore.FieldValue.serverTimestamp(),
            lastViewDate: todayKey,
            viewsToday: isNewDay ? 1 : firebase.firestore.FieldValue.increment(1),
            totalViews: firebase.firestore.FieldValue.increment(1),
          }, { merge: true })
        }
      } else {
        // First view from this visitor
        await visitorViewsRef.set({
          lastViewTime: firebase.firestore.FieldValue.serverTimestamp(),
          lastViewDate: todayKey,
          viewsToday: 1,
          totalViews: 1,
          firstSeen: firebase.firestore.FieldValue.serverTimestamp(),
        })
      }

      // Only increment the public view count if this is a valid view
      if (shouldCount) {
        // Get current count before increment to check milestones
        const currentDoc = await viewsRef.get()
        const currentCount = currentDoc.exists ? currentDoc.data().count || 0 : 0

        await viewsRef.set(
          {
            count: firebase.firestore.FieldValue.increment(1),
            lastViewed: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )

        const newCount = currentCount + 1

        // Check if we hit a milestone
        if (VIEW_MILESTONES.includes(newCount)) {
          try {
            // Get post data for notification
            const postDoc = await firestore.collection('posts').doc(id).get()
            if (postDoc.exists) {
              const postData = postDoc.data()
              // Get post author's username for the notification link
              const postAuthorDoc = await firestore.collection('users').doc(postData.author).get()
              const postAuthorData = postAuthorDoc.exists ? postAuthorDoc.data() : null

              await createMilestoneNotification(id, postData, postAuthorData, newCount)
            }
          } catch (milestoneError) {
            console.error('Failed to check milestone:', milestoneError)
          }
        }
      }
    }

    // Get current view count
    const doc = await viewsRef.get()
    const views = doc.exists ? doc.data().count || 0 : 0

    // Format number with commas
    const viewsFormatted = views.toLocaleString()

    return res.status(200).json({
      id,
      views,
      viewsFormatted,
    })
  } catch (error) {
    console.error('View tracking error:', error)
    return res.status(500).json({
      error: {
        message: 'Failed to track view',
        code: 'INTERNAL_ERROR',
      },
    })
  }
}

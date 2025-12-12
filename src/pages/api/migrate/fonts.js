import { firestore } from '../../../lib/firebase'

/**
 * Migration API to update users' bodyFont from Newsreader to Inter
 *
 * Usage: POST /api/migrate/fonts
 * Headers: Authorization: Bearer <MODERATION_SECRET_KEY>
 * Body: { "dryRun": true } // optional, defaults to false
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  // Verify secret key
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.MODERATION_SECRET_KEY}`) {
    return res.status(401).json({ error: { message: 'Unauthorized' } })
  }

  const { dryRun = false } = req.body

  try {
    // Get all users
    const usersSnapshot = await firestore.collection('users').get()

    const results = {
      totalUsers: usersSnapshot.size,
      usersWithNewsreader: 0,
      usersUpdated: 0,
      usersWithNoFontSettings: 0,
      errors: 0,
      details: [],
    }

    for (const doc of usersSnapshot.docs) {
      const user = doc.data()
      const userId = doc.id

      try {
        // Check if user has fontSettings with Newsreader as bodyFont
        if (user.fontSettings?.bodyFont === 'Newsreader') {
          results.usersWithNewsreader++

          if (!dryRun) {
            // Update the bodyFont to Inter
            await firestore.collection('users').doc(userId).update({
              'fontSettings.bodyFont': 'Inter',
            })
            results.usersUpdated++
          }

          results.details.push({
            userId,
            username: user.name || 'unknown',
            action: dryRun ? 'would_update' : 'updated',
            oldFont: 'Newsreader',
            newFont: 'Inter',
          })
        } else if (!user.fontSettings) {
          // User has no fontSettings at all (will use default Inter now)
          results.usersWithNoFontSettings++
        }
      } catch (error) {
        console.error(`Error updating user ${userId}:`, error)
        results.errors++
        results.details.push({
          userId,
          username: user.name || 'unknown',
          action: 'error',
          error: error.message,
        })
      }
    }

    return res.status(200).json({
      message: dryRun ? 'Dry run completed (no changes made)' : 'Migration completed',
      results,
    })
  } catch (error) {
    console.error('Font migration error:', error)
    return res.status(500).json({ error: { message: 'Internal server error' } })
  }
}

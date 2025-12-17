import { firestore } from '../../../lib/firebase'

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { username, limit = 20, cursor } = req.query

  if (!username) {
    return res.status(400).json({ error: 'Username is required' })
  }

  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50)

  try {
    // Find the author by username
    const usersSnapshot = await firestore
      .collection('users')
      .where('name', '==', username)
      .limit(1)
      .get()

    if (usersSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' })
    }

    const authorDoc = usersSnapshot.docs[0]
    const authorId = authorDoc.id

    // Fetch ALL guestbook entries (no composite index needed), filter in memory
    const entriesSnapshot = await firestore
      .collection('users')
      .doc(authorId)
      .collection('guestbook')
      .limit(200)
      .get()

    // Filter, transform, and sort in memory
    let entries = entriesSnapshot.docs
      .map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          name: data.name,
          message: data.message || '',
          signaturePath: data.signaturePath,
          signatureViewBox: data.signatureViewBox,
          moderationStatus: data.moderationStatus,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        }
      })
      // Filter for approved only
      .filter(entry => entry.moderationStatus === 'approved')
      // Remove moderationStatus from response
      .map(({ moderationStatus, ...entry }) => entry)
      // Sort by createdAt descending
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    // Handle cursor-based pagination
    let startIndex = 0
    if (cursor) {
      const cursorIndex = entries.findIndex(e => e.id === cursor)
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1
      }
    }

    entries = entries.slice(startIndex, startIndex + limitNum)

    // Get next cursor
    const lastEntry = entries[entries.length - 1]
    const nextCursor = lastEntry?.id || null

    // Check if there are more entries by looking at total approved entries vs what we've paginated through
    const totalApprovedCount = entriesSnapshot.docs.filter(doc => doc.data().moderationStatus === 'approved').length
    const hasMore = (startIndex + entries.length) < totalApprovedCount

    return res.status(200).json({
      entries,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
    })
  } catch (error) {
    console.error('Guestbook entries fetch error:', error)
    return res.status(500).json({ error: 'Failed to fetch guest book entries' })
  }
}

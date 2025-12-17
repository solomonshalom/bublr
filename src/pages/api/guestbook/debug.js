import { firestore } from '../../../lib/firebase'

// DEBUG ONLY - Remove in production
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { username } = req.query

  if (!username) {
    return res.status(400).json({ error: 'Username is required' })
  }

  try {
    // Find the author by username
    const usersSnapshot = await firestore
      .collection('users')
      .where('name', '==', username)
      .limit(1)
      .get()

    if (usersSnapshot.empty) {
      return res.status(404).json({ error: 'User not found', username })
    }

    const authorDoc = usersSnapshot.docs[0]
    const authorId = authorDoc.id

    // Get ALL guestbook entries (not just approved)
    const allEntriesSnapshot = await firestore
      .collection('users')
      .doc(authorId)
      .collection('guestbook')
      .limit(50)
      .get()

    const allEntries = allEntriesSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name,
        message: data.message || '',
        moderationStatus: data.moderationStatus,
        moderationCategory: data.moderationCategory,
        signaturePathLength: data.signaturePath?.length || 0,
        signatureViewBox: data.signatureViewBox,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || 'no timestamp',
      }
    })

    return res.status(200).json({
      userId: authorId,
      username,
      totalEntries: allEntries.length,
      entries: allEntries,
    })
  } catch (error) {
    console.error('Debug error:', error)
    return res.status(500).json({
      error: 'Failed to fetch entries',
      message: error.message
    })
  }
}

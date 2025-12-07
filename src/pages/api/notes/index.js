import firebase from '../../../lib/firebase'
import { firestore } from '../../../lib/firebase'

export default async function handler(req, res) {
  const { method } = req

  if (method === 'GET') {
    // Get notes for a specific post
    const { postId } = req.query

    if (!postId) {
      return res.status(400).json({
        error: { message: 'Missing postId parameter', code: 'MISSING_POST_ID' },
      })
    }

    try {
      const notesRef = firestore
        .collection('communityNotes')
        .where('postId', '==', postId)
        .orderBy('createdAt', 'desc')

      const snapshot = await notesRef.get()
      const notes = []

      snapshot.forEach((doc) => {
        const data = doc.data()
        notes.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.getTime() || Date.now(),
        })
      })

      // Filter notes that have reached the helpful threshold (2+ net helpful votes)
      const approvedNotes = notes.filter(
        (note) => (note.helpfulCount || 0) - (note.unhelpfulCount || 0) >= 2
      )

      // Also return all notes if user is authenticated (for voting)
      return res.status(200).json({
        approvedNotes,
        allNotes: notes,
      })
    } catch (error) {
      console.error('Get notes error:', error)
      return res.status(500).json({
        error: { message: 'Failed to get notes', code: 'INTERNAL_ERROR' },
      })
    }
  }

  if (method === 'POST') {
    // Create a new note
    const { postId, authorId, authorName, authorPhoto, content } = req.body

    if (!postId || !authorId || !content) {
      return res.status(400).json({
        error: { message: 'Missing required fields', code: 'MISSING_FIELDS' },
      })
    }

    if (content.length < 20) {
      return res.status(400).json({
        error: { message: 'Note must be at least 20 characters', code: 'TOO_SHORT' },
      })
    }

    if (content.length > 500) {
      return res.status(400).json({
        error: { message: 'Note must be less than 500 characters', code: 'TOO_LONG' },
      })
    }

    try {
      const noteData = {
        postId,
        authorId,
        authorName: authorName || 'Anonymous',
        authorPhoto: authorPhoto || '',
        content,
        helpfulCount: 0,
        unhelpfulCount: 0,
        helpfulVoters: [],
        unhelpfulVoters: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending', // pending, approved, rejected
      }

      const docRef = await firestore.collection('communityNotes').add(noteData)

      return res.status(201).json({
        id: docRef.id,
        ...noteData,
        createdAt: Date.now(),
      })
    } catch (error) {
      console.error('Create note error:', error)
      return res.status(500).json({
        error: { message: 'Failed to create note', code: 'INTERNAL_ERROR' },
      })
    }
  }

  return res.status(405).json({ error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } })
}

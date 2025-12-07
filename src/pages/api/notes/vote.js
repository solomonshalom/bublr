import firebase from '../../../lib/firebase'
import { firestore } from '../../../lib/firebase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } })
  }

  const { noteId, odId, voteType } = req.body

  if (!noteId || !odId || !voteType) {
    return res.status(400).json({
      error: { message: 'Missing required fields', code: 'MISSING_FIELDS' },
    })
  }

  if (!['helpful', 'unhelpful', 'remove'].includes(voteType)) {
    return res.status(400).json({
      error: { message: 'Invalid vote type', code: 'INVALID_VOTE_TYPE' },
    })
  }

  try {
    const noteRef = firestore.collection('communityNotes').doc(noteId)
    const noteDoc = await noteRef.get()

    if (!noteDoc.exists) {
      return res.status(404).json({
        error: { message: 'Note not found', code: 'NOTE_NOT_FOUND' },
      })
    }

    const noteData = noteDoc.data()
    const helpfulVoters = noteData.helpfulVoters || []
    const unhelpfulVoters = noteData.unhelpfulVoters || []

    const alreadyVotedHelpful = helpfulVoters.includes(odId)
    const alreadyVotedUnhelpful = unhelpfulVoters.includes(odId)

    let updateData = {}

    if (voteType === 'remove') {
      // Remove any existing vote
      if (alreadyVotedHelpful) {
        updateData = {
          helpfulCount: firebase.firestore.FieldValue.increment(-1),
          helpfulVoters: firebase.firestore.FieldValue.arrayRemove(odId),
        }
      } else if (alreadyVotedUnhelpful) {
        updateData = {
          unhelpfulCount: firebase.firestore.FieldValue.increment(-1),
          unhelpfulVoters: firebase.firestore.FieldValue.arrayRemove(odId),
        }
      }
    } else if (voteType === 'helpful') {
      if (alreadyVotedHelpful) {
        // Already voted helpful, remove vote
        updateData = {
          helpfulCount: firebase.firestore.FieldValue.increment(-1),
          helpfulVoters: firebase.firestore.FieldValue.arrayRemove(odId),
        }
      } else {
        // Add helpful vote
        updateData = {
          helpfulCount: firebase.firestore.FieldValue.increment(1),
          helpfulVoters: firebase.firestore.FieldValue.arrayUnion(odId),
        }
        // Remove unhelpful vote if exists
        if (alreadyVotedUnhelpful) {
          updateData.unhelpfulCount = firebase.firestore.FieldValue.increment(-1)
          updateData.unhelpfulVoters = firebase.firestore.FieldValue.arrayRemove(odId)
        }
      }
    } else if (voteType === 'unhelpful') {
      if (alreadyVotedUnhelpful) {
        // Already voted unhelpful, remove vote
        updateData = {
          unhelpfulCount: firebase.firestore.FieldValue.increment(-1),
          unhelpfulVoters: firebase.firestore.FieldValue.arrayRemove(odId),
        }
      } else {
        // Add unhelpful vote
        updateData = {
          unhelpfulCount: firebase.firestore.FieldValue.increment(1),
          unhelpfulVoters: firebase.firestore.FieldValue.arrayUnion(odId),
        }
        // Remove helpful vote if exists
        if (alreadyVotedHelpful) {
          updateData.helpfulCount = firebase.firestore.FieldValue.increment(-1)
          updateData.helpfulVoters = firebase.firestore.FieldValue.arrayRemove(odId)
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await noteRef.update(updateData)
    }

    // Get updated note
    const updatedDoc = await noteRef.get()
    const updatedData = updatedDoc.data()

    return res.status(200).json({
      id: noteId,
      helpfulCount: updatedData.helpfulCount,
      unhelpfulCount: updatedData.unhelpfulCount,
      helpfulVoters: updatedData.helpfulVoters,
      unhelpfulVoters: updatedData.unhelpfulVoters,
    })
  } catch (error) {
    console.error('Vote error:', error)
    return res.status(500).json({
      error: { message: 'Failed to vote', code: 'INTERNAL_ERROR' },
    })
  }
}

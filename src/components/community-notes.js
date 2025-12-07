/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth } from '../lib/firebase'
import { useDocumentData } from 'react-firebase-hooks/firestore'
import { firestore } from '../lib/firebase'

// Note icon
const NoteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
)

// Thumbs up icon
const ThumbsUpIcon = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
)

// Thumbs down icon
const ThumbsDownIcon = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
  </svg>
)

function NoteCard({ note, userId, onVote }) {
  const hasVotedHelpful = note.helpfulVoters?.includes(userId)
  const hasVotedUnhelpful = note.unhelpfulVoters?.includes(userId)
  const netScore = (note.helpfulCount || 0) - (note.unhelpfulCount || 0)

  return (
    <div
      css={css`
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.2);
        border-radius: 0.5rem;
        padding: 1rem;
        margin-bottom: 0.75rem;
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        `}
      >
        <div
          css={css`
            color: #3b82f6;
            flex-shrink: 0;
            margin-top: 2px;
          `}
        >
          <NoteIcon />
        </div>
        <div css={css`flex: 1;`}>
          <p
            css={css`
              font-size: 0.8rem;
              color: #3b82f6;
              font-weight: 500;
              margin-bottom: 0.5rem;
            `}
          >
            Community Note
          </p>
          <p
            css={css`
              font-size: 0.9rem;
              color: var(--grey-4);
              line-height: 1.5;
              margin-bottom: 0.75rem;
            `}
          >
            {note.content}
          </p>
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 1rem;
              font-size: 0.75rem;
              color: var(--grey-3);
            `}
          >
            <span>
              Added by {note.authorName}
            </span>
            {userId && (
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  margin-left: auto;
                `}
              >
                <span css={css`font-size: 0.7rem;`}>
                  Was this helpful?
                </span>
                <button
                  onClick={() => onVote(note.id, 'helpful')}
                  css={css`
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0.25rem;
                    color: ${hasVotedHelpful ? '#22c55e' : 'var(--grey-3)'};
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    transition: color 0.2s;

                    &:hover {
                      color: #22c55e;
                    }
                  `}
                >
                  <ThumbsUpIcon filled={hasVotedHelpful} />
                  <span>{note.helpfulCount || 0}</span>
                </button>
                <button
                  onClick={() => onVote(note.id, 'unhelpful')}
                  css={css`
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0.25rem;
                    color: ${hasVotedUnhelpful ? '#ef4444' : 'var(--grey-3)'};
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    transition: color 0.2s;

                    &:hover {
                      color: #ef4444;
                    }
                  `}
                >
                  <ThumbsDownIcon filled={hasVotedUnhelpful} />
                  <span>{note.unhelpfulCount || 0}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AddNoteForm({ postId, onSubmit, onCancel }) {
  const [user] = useAuthState(auth)
  const [userData] = useDocumentData(
    user ? firestore.doc(`users/${user.uid}`) : null,
    { idField: 'id' }
  )
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user || !content.trim()) return

    if (content.length < 20) {
      setError('Note must be at least 20 characters')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          authorId: user.uid,
          authorName: userData?.displayName || user.displayName || 'Anonymous',
          authorPhoto: userData?.photo || user.photoURL || '',
          content: content.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to add note')
      }

      setContent('')
      onSubmit()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add context that might help readers understand this post better..."
        maxLength={500}
        css={css`
          width: 100%;
          min-height: 100px;
          padding: 0.75rem;
          border: 1px solid var(--grey-2);
          border-radius: 0.5rem;
          font-family: inherit;
          font-size: 0.9rem;
          resize: vertical;
          background: var(--grey-1);
          color: var(--grey-4);

          &:focus {
            outline: none;
            border-color: #3b82f6;
          }

          &::placeholder {
            color: var(--grey-3);
          }
        `}
      />
      <div
        css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.5rem;
        `}
      >
        <span
          css={css`
            font-size: 0.75rem;
            color: var(--grey-3);
          `}
        >
          {content.length}/500 characters
        </span>
        <div css={css`display: flex; gap: 0.5rem;`}>
          <button
            type="button"
            onClick={onCancel}
            css={css`
              padding: 0.5rem 1rem;
              background: none;
              border: 1px solid var(--grey-2);
              border-radius: 0.25rem;
              color: var(--grey-4);
              font-size: 0.85rem;
              cursor: pointer;
              transition: all 0.2s;

              &:hover {
                border-color: var(--grey-3);
              }
            `}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || content.length < 20}
            css={css`
              padding: 0.5rem 1rem;
              background: #3b82f6;
              border: none;
              border-radius: 0.25rem;
              color: white;
              font-size: 0.85rem;
              cursor: pointer;
              transition: all 0.2s;

              &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
              }

              &:hover:not(:disabled) {
                background: #2563eb;
              }
            `}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Note'}
          </button>
        </div>
      </div>
      {error && (
        <p
          css={css`
            color: #ef4444;
            font-size: 0.8rem;
            margin-top: 0.5rem;
          `}
        >
          {error}
        </p>
      )}
      <p
        css={css`
          font-size: 0.75rem;
          color: var(--grey-3);
          margin-top: 0.75rem;
        `}
      >
        Notes appear publicly once they receive enough helpful votes from readers.
      </p>
    </form>
  )
}

// Small icon button for triggering community notes
export function CommunityNotesIcon({ onClick, hasNotes }) {
  return (
    <button
      onClick={onClick}
      title="Community Notes"
      css={css`
        background: none;
        border: none;
        border-radius: 1rem;
        width: 2rem;
        height: 2rem;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        transition: all 200ms ease;
        color: ${hasNotes ? '#3b82f6' : 'var(--grey-3)'};

        &:hover {
          background: var(--grey-2);
          opacity: 0.6;
        }
      `}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    </button>
  )
}

export default function CommunityNotes({ postId, isExpanded = true, onToggle }) {
  const [user] = useAuthState(auth)
  const [notes, setNotes] = useState([])
  const [allNotes, setAllNotes] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showAllNotes, setShowAllNotes] = useState(false)

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/api/notes?postId=${encodeURIComponent(postId)}`)
      if (response.ok) {
        const data = await response.json()
        setNotes(data.approvedNotes || [])
        setAllNotes(data.allNotes || [])
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchNotes()
  }, [postId])

  const handleVote = async (noteId, voteType) => {
    if (!user) return

    try {
      const response = await fetch('/api/notes/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId,
          odId: user.uid,
          voteType,
        }),
      })

      if (response.ok) {
        fetchNotes() // Refresh notes after voting
      }
    } catch (err) {
      console.error('Vote error:', err)
    }
  }

  // Export the notes count for the icon
  const hasNotes = notes.length > 0

  if (isLoading) return null

  // If not expanded, don't render anything (the icon is rendered separately)
  if (!isExpanded) return null

  const displayNotes = showAllNotes ? allNotes : notes
  const pendingNotes = allNotes.filter(
    (n) => (n.helpfulCount || 0) - (n.unhelpfulCount || 0) < 2
  )

  return (
    <div
      css={css`
        margin-bottom: 1.5rem;
      `}
    >
      {/* Display approved notes */}
      {notes.length > 0 && (
        <div css={css`margin-bottom: 1rem;`}>
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              userId={user?.uid}
              onVote={handleVote}
            />
          ))}
        </div>
      )}

      {/* Show pending notes toggle */}
      {user && pendingNotes.length > 0 && !showAllNotes && (
        <button
          onClick={() => setShowAllNotes(true)}
          css={css`
            background: none;
            border: none;
            color: var(--grey-3);
            font-size: 0.8rem;
            cursor: pointer;
            margin-bottom: 1rem;

            &:hover {
              color: var(--grey-4);
              text-decoration: underline;
            }
          `}
        >
          View {pendingNotes.length} pending note{pendingNotes.length > 1 ? 's' : ''} needing votes
        </button>
      )}

      {/* Display all notes (including pending) when toggled */}
      {showAllNotes && pendingNotes.length > 0 && (
        <div css={css`margin-bottom: 1rem;`}>
          <p
            css={css`
              font-size: 0.8rem;
              color: var(--grey-3);
              margin-bottom: 0.75rem;
            `}
          >
            Pending notes (need 2+ net helpful votes to appear):
          </p>
          {pendingNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              userId={user?.uid}
              onVote={handleVote}
            />
          ))}
          <button
            onClick={() => setShowAllNotes(false)}
            css={css`
              background: none;
              border: none;
              color: var(--grey-3);
              font-size: 0.8rem;
              cursor: pointer;

              &:hover {
                color: var(--grey-4);
                text-decoration: underline;
              }
            `}
          >
            Hide pending notes
          </button>
        </div>
      )}

      {/* Add note button/form */}
      {user && !showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          css={css`
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: none;
            border: 1px dashed var(--grey-2);
            border-radius: 0.5rem;
            padding: 0.75rem 1rem;
            color: var(--grey-3);
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.2s;
            width: 100%;
            justify-content: center;

            &:hover {
              border-color: #3b82f6;
              color: #3b82f6;
            }
          `}
        >
          <NoteIcon />
          Add Community Note
        </button>
      )}

      {showAddForm && (
        <AddNoteForm
          postId={postId}
          onSubmit={() => {
            setShowAddForm(false)
            fetchNotes()
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  )
}

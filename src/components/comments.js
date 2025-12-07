/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth } from '../lib/firebase'
import { useDocumentData } from 'react-firebase-hooks/firestore'
import { firestore } from '../lib/firebase'

// Comment icon
const CommentIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

// Heart icon
const HeartIcon = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

// Trash icon
const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

// Reply icon
const ReplyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 17 4 12 9 7" />
    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </svg>
)

// Format relative time
function formatRelativeTime(timestamp) {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 7) {
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } else if (days > 0) {
    return `${days}d ago`
  } else if (hours > 0) {
    return `${hours}h ago`
  } else if (minutes > 0) {
    return `${minutes}m ago`
  } else {
    return 'Just now'
  }
}

function CommentCard({ comment, userId, onLike, onDelete, onReply, isReply }) {
  const hasLiked = comment.likedBy?.includes(userId)
  const isAuthor = comment.authorId === userId

  return (
    <div
      css={css`
        background: var(--grey-1);
        border: 1px solid var(--grey-2);
        border-radius: 0.5rem;
        padding: 1rem;
        margin-bottom: 0.75rem;
        margin-left: ${isReply ? '2rem' : '0'};
        transition: border-color 0.2s;

        &:hover {
          border-color: var(--grey-3);
        }
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        `}
      >
        {/* Avatar */}
        <img
          src={comment.authorPhoto || `https://api.dicebear.com/7.x/initials/svg?seed=${comment.authorName}`}
          alt={comment.authorName}
          css={css`
            width: 32px;
            height: 32px;
            border-radius: 50%;
            object-fit: cover;
            flex-shrink: 0;
          `}
        />
        <div css={css`flex: 1; min-width: 0;`}>
          {/* Header */}
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
              margin-bottom: 0.25rem;
            `}
          >
            <span
              css={css`
                font-size: 0.85rem;
                font-weight: 500;
                color: var(--grey-4);
              `}
            >
              {comment.authorName}
            </span>
            <span
              css={css`
                font-size: 0.75rem;
                color: var(--grey-3);
              `}
            >
              {formatRelativeTime(comment.createdAt)}
            </span>
          </div>

          {/* Content */}
          <p
            css={css`
              font-size: 0.9rem;
              color: var(--grey-4);
              line-height: 1.5;
              margin-bottom: 0.75rem;
              white-space: pre-wrap;
              word-break: break-word;
            `}
          >
            {comment.content}
          </p>

          {/* Actions */}
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 1rem;
              font-size: 0.75rem;
            `}
          >
            {userId && (
              <>
                <button
                  onClick={() => onLike(comment.id)}
                  css={css`
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0.25rem;
                    color: ${hasLiked ? '#ef4444' : 'var(--grey-3)'};
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    transition: color 0.2s;

                    &:hover {
                      color: #ef4444;
                    }
                  `}
                >
                  <HeartIcon filled={hasLiked} />
                  <span>{comment.likeCount || 0}</span>
                </button>

                {!isReply && (
                  <button
                    onClick={() => onReply(comment)}
                    css={css`
                      background: none;
                      border: none;
                      cursor: pointer;
                      padding: 0.25rem;
                      color: var(--grey-3);
                      display: flex;
                      align-items: center;
                      gap: 0.25rem;
                      transition: color 0.2s;

                      &:hover {
                        color: var(--grey-4);
                      }
                    `}
                  >
                    <ReplyIcon />
                    Reply
                  </button>
                )}

                {isAuthor && (
                  <button
                    onClick={() => onDelete(comment.id)}
                    css={css`
                      background: none;
                      border: none;
                      cursor: pointer;
                      padding: 0.25rem;
                      color: var(--grey-3);
                      display: flex;
                      align-items: center;
                      gap: 0.25rem;
                      transition: color 0.2s;
                      margin-left: auto;

                      &:hover {
                        color: #ef4444;
                      }
                    `}
                  >
                    <TrashIcon />
                    Delete
                  </button>
                )}
              </>
            )}
            {!userId && (
              <span css={css`color: var(--grey-3);`}>
                {comment.likeCount || 0} likes
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AddCommentForm({ postId, onSubmit, onCancel, replyTo, placeholder }) {
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

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          authorId: user.uid,
          authorName: userData?.displayName || user.displayName || 'Anonymous',
          authorPhoto: userData?.photo || user.photoURL || '',
          content: content.trim(),
          parentId: replyTo?.id || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to add comment')
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
    <form onSubmit={handleSubmit} css={css`margin-bottom: 1rem;`}>
      {replyTo && (
        <div
          css={css`
            font-size: 0.8rem;
            color: var(--grey-3);
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          `}
        >
          Replying to {replyTo.authorName}
          <button
            type="button"
            onClick={onCancel}
            css={css`
              background: none;
              border: none;
              color: var(--grey-3);
              cursor: pointer;
              font-size: 0.75rem;
              text-decoration: underline;

              &:hover {
                color: var(--grey-4);
              }
            `}
          >
            Cancel
          </button>
        </div>
      )}
      <div
        css={css`
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
        `}
      >
        {user && (
          <img
            src={userData?.photo || user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${userData?.displayName || user.displayName}`}
            alt="Your avatar"
            css={css`
              width: 32px;
              height: 32px;
              border-radius: 50%;
              object-fit: cover;
              flex-shrink: 0;
            `}
          />
        )}
        <div css={css`flex: 1;`}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder || "Share your thoughts..."}
            maxLength={1000}
            css={css`
              width: 100%;
              min-height: 80px;
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
                border-color: var(--grey-3);
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
              {content.length}/1000
            </span>
            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              css={css`
                padding: 0.5rem 1rem;
                background: var(--grey-4);
                border: none;
                border-radius: 0.25rem;
                color: var(--grey-1);
                font-size: 0.85rem;
                cursor: pointer;
                transition: all 0.2s;

                &:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
                }

                &:hover:not(:disabled) {
                  opacity: 0.9;
                }
              `}
            >
              {isSubmitting ? 'Posting...' : replyTo ? 'Reply' : 'Comment'}
            </button>
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
        </div>
      </div>
    </form>
  )
}

export default function Comments({ postId }) {
  const [user] = useAuthState(auth)
  const [comments, setComments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState(null)
  const [showComments, setShowComments] = useState(false)

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/comments?postId=${encodeURIComponent(postId)}`)
      const data = await response.json()

      if (!response.ok) {
        console.error('Failed to fetch comments:', data.error)
        return
      }

      setComments(data.comments || [])
    } catch (err) {
      console.error('Failed to fetch comments:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchComments()
  }, [postId])

  const handleLike = async (commentId) => {
    if (!user) return

    try {
      const response = await fetch('/api/comments/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId,
          userId: user.uid,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Like error:', data.error)
        return
      }

      fetchComments()
    } catch (err) {
      console.error('Like error:', err)
    }
  }

  const handleDelete = async (commentId) => {
    if (!user) return
    if (!confirm('Are you sure you want to delete this comment?')) return

    try {
      const response = await fetch('/api/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId,
          authorId: user.uid,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Delete error:', data.error)
        alert('Failed to delete comment: ' + (data.error?.message || 'Unknown error'))
        return
      }

      fetchComments()
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete comment')
    }
  }

  const handleReply = (comment) => {
    setReplyingTo(comment)
  }

  // Organize comments into threads
  const parentComments = comments.filter((c) => !c.parentId)
  const replies = comments.filter((c) => c.parentId)

  const getRepliesToComment = (parentId) => {
    return replies.filter((r) => r.parentId === parentId)
  }

  const commentCount = comments.length

  if (isLoading) return null

  return (
    <div
      css={css`
        margin-top: 2rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--grey-2);
      `}
    >
      {/* Header */}
      <button
        onClick={() => setShowComments(!showComments)}
        css={css`
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--grey-4);
          font-size: 0.95rem;
          font-weight: 500;
          padding: 0;
          margin-bottom: 1rem;

          &:hover {
            color: var(--grey-3);
          }

          svg {
            color: var(--grey-3);
          }
        `}
      >
        <CommentIcon />
        {commentCount} Comment{commentCount !== 1 ? 's' : ''}
        <span
          css={css`
            font-size: 0.8rem;
            color: var(--grey-3);
            font-weight: 400;
          `}
        >
          {showComments ? '(hide)' : '(show)'}
        </span>
      </button>

      {showComments && (
        <>
          {/* Add comment form - only show when not replying */}
          {user && !replyingTo ? (
            <AddCommentForm
              postId={postId}
              onSubmit={() => {
                fetchComments()
              }}
              onCancel={() => {}}
              replyTo={null}
            />
          ) : !user ? (
            <p
              css={css`
                font-size: 0.85rem;
                color: var(--grey-3);
                margin-bottom: 1rem;
                padding: 1rem;
                background: var(--grey-1);
                border: 1px dashed var(--grey-2);
                border-radius: 0.5rem;
                text-align: center;
              `}
            >
              Sign in to leave a comment
            </p>
          ) : null}

          {/* Comments list */}
          {parentComments.length > 0 ? (
            <div css={css`margin-top: 1rem;`}>
              {parentComments.map((comment) => (
                <div key={comment.id}>
                  <CommentCard
                    comment={comment}
                    userId={user?.uid}
                    onLike={handleLike}
                    onDelete={handleDelete}
                    onReply={handleReply}
                    isReply={false}
                  />
                  {/* Replies */}
                  {getRepliesToComment(comment.id).map((reply) => (
                    <CommentCard
                      key={reply.id}
                      comment={reply}
                      userId={user?.uid}
                      onLike={handleLike}
                      onDelete={handleDelete}
                      onReply={handleReply}
                      isReply={true}
                    />
                  ))}
                  {/* Reply form for this comment */}
                  {replyingTo?.id === comment.id && (
                    <div css={css`margin-left: 2rem; margin-bottom: 1rem;`}>
                      <AddCommentForm
                        postId={postId}
                        onSubmit={() => {
                          setReplyingTo(null)
                          fetchComments()
                        }}
                        onCancel={() => setReplyingTo(null)}
                        replyTo={replyingTo}
                        placeholder={`Reply to ${replyingTo.authorName}...`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p
              css={css`
                font-size: 0.85rem;
                color: var(--grey-3);
                text-align: center;
                padding: 2rem 1rem;
              `}
            >
              No comments yet. Be the first to share your thoughts!
            </p>
          )}
        </>
      )}
    </div>
  )
}

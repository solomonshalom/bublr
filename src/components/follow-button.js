/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'

// Follow icon (user plus)
const FollowIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    css={css`
      margin-right: 8px;
      vertical-align: middle;
      margin-top: -2px;
    `}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />
    <path d="M16 19h6" />
    <path d="M19 16v6" />
    <path d="M6 21v-2a4 4 0 0 1 4 -4h4" />
  </svg>
)

// Following icon (user check)
const FollowingIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    css={css`
      margin-right: 8px;
      vertical-align: middle;
      margin-top: -2px;
    `}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />
    <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
    <path d="M15 11l2 2l4 -4" />
  </svg>
)

// Loading spinner
const LoadingSpinner = () => (
  <span
    css={css`
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-bottom-color: transparent;
      border-radius: 50%;
      display: inline-block;
      margin-right: 8px;
      animation: spin 0.8s linear infinite;
      vertical-align: middle;
      margin-top: -2px;

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `}
  />
)

export default function FollowButton({
  targetUserId,
  targetUsername,
  targetDisplayName,
  currentUserId,
  initialIsFollowing = false,
  colors,
}) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [status, setStatus] = useState('idle') // idle, loading

  useEffect(() => {
    setIsFollowing(initialIsFollowing)
  }, [initialIsFollowing])

  // Don't show follow button if viewing own profile or not signed in
  if (!currentUserId || currentUserId === targetUserId) {
    return null
  }

  const handleFollow = async () => {
    setStatus('loading')

    try {
      const response = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId,
          action: isFollowing ? 'unfollow' : 'follow',
          currentUserId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update follow status')
      }

      setIsFollowing(data.isFollowing)
    } catch (err) {
      console.error('Follow error:', err)
    } finally {
      setStatus('idle')
    }
  }

  return (
    <button
      onClick={handleFollow}
      disabled={status === 'loading'}
      css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 12px 16px;
        background: ${isFollowing ? colors.bg : colors.text};
        color: ${isFollowing ? colors.muted : colors.bg};
        border: 1px solid ${isFollowing ? colors.border : colors.text};
        border-radius: 6px;
        font-size: 14px;
        font-family: Inter, sans-serif;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover:not(:disabled) {
          ${isFollowing
            ? `
            color: ${colors.text};
            border-color: ${colors.text};
          `
            : `
            opacity: 0.9;
          `}
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}
    >
      {status === 'loading' ? (
        <>
          <LoadingSpinner />
          {isFollowing ? 'Unfollowing...' : 'Following...'}
        </>
      ) : isFollowing ? (
        <>
          <FollowingIcon />
          Following
        </>
      ) : (
        <>
          <FollowIcon />
          Follow {targetDisplayName}
        </>
      )}
    </button>
  )
}

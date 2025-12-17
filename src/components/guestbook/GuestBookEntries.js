/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { useState, useEffect, useCallback } from 'react'

// Format date like "2nd Nov'25"
const formatShortDate = (dateString) => {
  const d = new Date(dateString)
  const day = d.getDate()
  const month = d.toLocaleString('en-US', { month: 'short' })
  const year = d.getFullYear().toString().slice(-2)

  const suffix = (day === 1 || day === 21 || day === 31) ? 'st'
    : (day === 2 || day === 22) ? 'nd'
    : (day === 3 || day === 23) ? 'rd'
    : 'th'

  return `${day}${suffix} ${month}'${year}`
}

// Loading spinner animation
const spinKeyframes = keyframes`
  to { transform: rotate(360deg); }
`

// Signature card component
const SignatureCard = ({ entry, colors, index }) => {
  const colorPalette = ['#cf52f2', '#6BCB77', '#4D96FF', '#A66CFF', '#E23E57', '#ff3e00']
  const accentColor = colorPalette[index % colorPalette.length]

  return (
    <div
      css={css`
        background: ${colors.bg};
        border: 1px solid ${colors.border};
        border-radius: 8px;
        padding: 16px;
        transition: all 0.2s ease;

        &:hover {
          border-color: ${colors.mutedLight};
        }
      `}
    >
      {/* Signature SVG */}
      <div
        css={css`
          height: 80px;
          margin-bottom: 12px;
          border-radius: 4px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        `}
      >
        <svg
          viewBox={entry.signatureViewBox}
          css={css`
            width: 100%;
            height: 100%;
            max-height: 80px;
          `}
        >
          <path
            d={entry.signaturePath}
            fill="none"
            stroke={colors.text}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Name and date */}
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: ${entry.message ? '8px' : '0'};
        `}
      >
        <span
          css={css`
            font-size: 14px;
            font-weight: 500;
            color: ${colors.text};
            display: flex;
            align-items: center;
          `}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill={accentColor}
            stroke="none"
            css={css`margin-right: 6px;`}
          >
            <circle cx="12" cy="12" r="10" />
          </svg>
          {entry.name}
        </span>
        <span
          css={css`
            font-size: 12px;
            color: ${colors.muted};
          `}
        >
          {formatShortDate(entry.createdAt)}
        </span>
      </div>

      {/* Message (if any) */}
      {entry.message && (
        <p
          css={css`
            font-size: 13px;
            color: ${colors.muted};
            line-height: 1.5;
            margin: 0;
            font-style: italic;
          `}
        >
          {entry.message}
        </p>
      )}
    </div>
  )
}

export default function GuestBookEntries({
  authorUsername,
  initialEntries = [],
  colors,
  sectionTitle = 'Guest Book',
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Track if we need to do an initial client-side fetch
  const [needsClientFetch, setNeedsClientFetch] = useState(initialEntries.length === 0)

  const fetchEntries = useCallback(async (cursor = null) => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        username: authorUsername,
        limit: '12',
        ...(cursor && { cursor }),
      })

      const response = await fetch(`/api/guestbook/entries?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load entries')
      }

      if (cursor) {
        setEntries(prev => [...prev, ...data.entries])
      } else {
        setEntries(data.entries)
      }
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [authorUsername])

  const loadMore = useCallback(() => {
    if (nextCursor && !isLoading) {
      fetchEntries(nextCursor)
    }
  }, [nextCursor, isLoading, fetchEntries])

  // Initial fetch if no entries provided from SSR
  useEffect(() => {
    if (needsClientFetch && entries.length === 0 && !isLoading) {
      fetchEntries()
      setNeedsClientFetch(false)
    }
  }, [needsClientFetch, entries.length, isLoading, fetchEntries, authorUsername])

  // If no entries, not loading, no error, AND we don't need to fetch - don't render anything
  // But if we're about to do a client fetch, show the section with loading state
  if (entries.length === 0 && !isLoading && !error && !needsClientFetch) {
    return null
  }

  // Determine how many entries to show
  const displayEntries = isExpanded ? entries : entries.slice(0, 6)
  const hasMoreToShow = !isExpanded && entries.length > 6

  return (
    <div>
      {/* Section Title */}
      <p
        css={css`
          font-weight: 500;
          margin-bottom: 8px;
          color: ${colors.text};
        `}
      >
        {sectionTitle}
      </p>

      {/* Error state */}
      {error && (
        <p
          css={css`
            font-size: 13px;
            color: #E23E57;
            margin: 16px 0;
          `}
        >
          {error}
        </p>
      )}

      {/* Entries Grid */}
      <div
        css={css`
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 12px;
          margin-top: 16px;
        `}
      >
        {displayEntries.map((entry, index) => (
          <SignatureCard
            key={entry.id}
            entry={entry}
            colors={colors}
            index={index}
          />
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div
          css={css`
            display: flex;
            justify-content: center;
            padding: 24px;
          `}
        >
          <span
            css={css`
              width: 20px;
              height: 20px;
              border: 2px solid ${colors.border};
              border-bottom-color: ${colors.text};
              border-radius: 50%;
              display: inline-block;
              animation: ${spinKeyframes} 0.8s linear infinite;
            `}
          />
        </div>
      )}

      {/* Show More / Load More buttons */}
      {(hasMoreToShow || hasMore) && !isLoading && (
        <div
          css={css`
            display: flex;
            justify-content: center;
            margin-top: 16px;
          `}
        >
          {hasMoreToShow ? (
            <button
              onClick={() => setIsExpanded(true)}
              css={css`
                padding: 8px 16px;
                background: transparent;
                color: ${colors.muted};
                border: 1px solid ${colors.border};
                border-radius: 4px;
                font-size: 13px;
                font-family: Inter, sans-serif;
                cursor: pointer;
                transition: all 0.2s ease;

                &:hover {
                  color: ${colors.text};
                  border-color: ${colors.text};
                }
              `}
            >
              Show {entries.length - 6} more signatures
            </button>
          ) : hasMore ? (
            <button
              onClick={loadMore}
              css={css`
                padding: 8px 16px;
                background: transparent;
                color: ${colors.muted};
                border: 1px solid ${colors.border};
                border-radius: 4px;
                font-size: 13px;
                font-family: Inter, sans-serif;
                cursor: pointer;
                transition: all 0.2s ease;

                &:hover {
                  color: ${colors.text};
                  border-color: ${colors.text};
                }
              `}
            >
              Load more signatures
            </button>
          ) : null}
        </div>
      )}

      {/* Show Less button when expanded */}
      {isExpanded && entries.length > 6 && (
        <div
          css={css`
            display: flex;
            justify-content: center;
            margin-top: 16px;
          `}
        >
          <button
            onClick={() => setIsExpanded(false)}
            css={css`
              padding: 8px 16px;
              background: transparent;
              color: ${colors.muted};
              border: 1px solid ${colors.border};
              border-radius: 4px;
              font-size: 13px;
              font-family: Inter, sans-serif;
              cursor: pointer;
              transition: all 0.2s ease;

              &:hover {
                color: ${colors.text};
                border-color: ${colors.text};
              }
            `}
          >
            Show less
          </button>
        </div>
      )}

    </div>
  )
}

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState } from 'react'

// Newsletter icon (envelope with notification dot)
const NewsletterIcon = () => (
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
    <path d="M22 7.535v9.465a3 3 0 0 1 -2.824 2.995l-.176 .005h-14a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-9.465l9.445 6.297l.116 .066a1 1 0 0 0 .878 0l.116 -.066l9.445 -6.297z" strokeWidth="0" fill="currentColor" />
    <path d="M19 4c1.08 0 2.027 .57 2.555 1.427l-9.555 6.37l-9.555 -6.37a2.999 2.999 0 0 1 2.354 -1.42l.201 -.007h14z" strokeWidth="0" fill="currentColor" />
  </svg>
)

// Success checkmark icon
const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    css={css`
      margin-right: 6px;
      vertical-align: middle;
      margin-top: -2px;
    `}
  >
    <polyline points="20 6 9 17 4 12" />
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

export default function SubscribeNewsletter({
  authorUsername,
  authorDisplayName,
  colors, // Theme colors passed from parent
}) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle, loading, success, error, already
  const [errorMessage, setErrorMessage] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email')
      setStatus('error')
      return
    }

    setStatus('loading')
    setErrorMessage('')

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          authorUsername,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to subscribe')
      }

      if (data.alreadySubscribed) {
        setStatus('already')
      } else {
        setStatus('success')
      }

      // Reset after a few seconds
      setTimeout(() => {
        setStatus('idle')
        setEmail('')
        setIsExpanded(false)
      }, 3000)
    } catch (err) {
      setErrorMessage(err.message || 'Something went wrong')
      setStatus('error')
    }
  }

  // Success/Already subscribed state
  if (status === 'success' || status === 'already') {
    return (
      <div
        css={css`
          padding: 12px 16px;
          border-radius: 6px;
          background: ${colors.bg};
          border: 1px solid ${colors.border};
          display: flex;
          align-items: center;
          color: #6BCB77;
          font-size: 14px;
        `}
      >
        <CheckIcon />
        {status === 'already' ? 'Already subscribed!' : 'Successfully subscribed!'}
      </div>
    )
  }

  // Collapsed state - just a button
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        css={css`
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 12px 16px;
          background: ${colors.bg};
          color: ${colors.muted};
          border: 1px solid ${colors.border};
          border-radius: 6px;
          font-size: 14px;
          font-family: Inter, sans-serif;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover {
            color: ${colors.text};
            border-color: ${colors.text};
          }
        `}
      >
        <NewsletterIcon />
        Subscribe to {authorDisplayName}'s newsletter
      </button>
    )
  }

  // Expanded state - email input form
  return (
    <form
      onSubmit={handleSubmit}
      css={css`
        border: 1px solid ${colors.border};
        border-radius: 6px;
        overflow: hidden;
        background: ${colors.bg};
      `}
    >
      {/* Header */}
      <div
        css={css`
          padding: 12px 16px;
          border-bottom: 1px solid ${colors.border};
          display: flex;
          align-items: center;
          justify-content: space-between;
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
          <NewsletterIcon />
          Subscribe to newsletter
        </span>
        <button
          type="button"
          onClick={() => {
            setIsExpanded(false)
            setEmail('')
            setStatus('idle')
            setErrorMessage('')
          }}
          css={css`
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            color: ${colors.muted};
            display: flex;
            align-items: center;
            justify-content: center;

            &:hover {
              color: ${colors.text};
            }
          `}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div
        css={css`
          padding: 16px;
        `}
      >
        <p
          css={css`
            font-size: 13px;
            color: ${colors.muted};
            margin: 0 0 16px 0;
            padding-bottom: 12px;
            line-height: 1.5;
          `}
        >
          Get notified when {authorDisplayName} publishes new posts. No spam, unsubscribe anytime.
        </p>

        {/* Input and button */}
        <div
          css={css`
            display: flex;
            flex-direction: column;
            gap: 10px;
          `}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (status === 'error') {
                setStatus('idle')
                setErrorMessage('')
              }
            }}
            placeholder="your@email.com"
            autoFocus
            css={css`
              flex: 1;
              padding: 10px 14px;
              border: 1px solid ${status === 'error' ? '#E23E57' : colors.border};
              border-radius: 4px;
              background: ${colors.bg};
              color: ${colors.text};
              font-size: 14px;
              font-family: Inter, sans-serif;
              outline: none;
              transition: border-color 0.2s ease;

              &:focus {
                border-color: ${status === 'error' ? '#E23E57' : colors.text};
              }

              &::placeholder {
                color: ${colors.muted};
              }
            `}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            css={css`
              width: 100%;
              padding: 10px 20px;
              background: ${colors.text};
              color: ${colors.bg};
              border: none;
              border-radius: 4px;
              font-size: 14px;
              font-family: Inter, sans-serif;
              font-weight: 500;
              cursor: pointer;
              transition: opacity 0.2s ease;
              display: flex;
              align-items: center;
              justify-content: center;
              white-space: nowrap;

              &:hover:not(:disabled) {
                opacity: 0.9;
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
                Subscribing...
              </>
            ) : (
              'Subscribe'
            )}
          </button>
        </div>

        {/* Error message */}
        {status === 'error' && errorMessage && (
          <p
            css={css`
              font-size: 12px;
              color: #E23E57;
              margin: 8px 0 0 0;
            `}
          >
            {errorMessage}
          </p>
        )}
      </div>
    </form>
  )
}

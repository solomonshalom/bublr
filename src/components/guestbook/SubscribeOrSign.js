/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { useState } from 'react'
import SignatureCanvas from './SignatureCanvas'

// Newsletter icon
const NewsletterIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    css={css`vertical-align: middle;`}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M22 7.535v9.465a3 3 0 0 1 -2.824 2.995l-.176 .005h-14a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-9.465l9.445 6.297l.116 .066a1 1 0 0 0 .878 0l.116 -.066l9.445 -6.297z" strokeWidth="0" fill="currentColor" />
    <path d="M19 4c1.08 0 2.027 .57 2.555 1.427l-9.555 6.37l-9.555 -6.37a2.999 2.999 0 0 1 2.354 -1.42l.201 -.007h14z" strokeWidth="0" fill="currentColor" />
  </svg>
)

// Pen/Sign icon
const PenIcon = () => (
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
    css={css`vertical-align: middle;`}
  >
    <path d="M12 20h9M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z" />
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
const spinKeyframes = keyframes`
  to { transform: rotate(360deg); }
`

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
      animation: ${spinKeyframes} 0.8s linear infinite;
      vertical-align: middle;
      margin-top: -2px;
    `}
  />
)

export default function SubscribeOrSign({
  authorUsername,
  authorDisplayName,
  colors,
  enableNewsletter = true,
  enableGuestbook = true,
  newsletterButtonText = '',
  guestbookButtonText = '',
}) {
  // Use custom text or fallback to default
  const newsletterText = newsletterButtonText || `Subscribe to ${authorDisplayName}'s newsletter`
  const guestbookText = guestbookButtonText || `Sign ${authorDisplayName}'s Guest Book`
  const [mode, setMode] = useState(null) // null, 'newsletter', 'guestbook'
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle, loading, success, error, already
  const [errorMessage, setErrorMessage] = useState('')
  const [signName, setSignName] = useState('')
  const [signMessage, setSignMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Newsletter submit handler
  const handleNewsletterSubmit = async (e) => {
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
        setMode(null)
      }, 3000)
    } catch (err) {
      setErrorMessage(err.message || 'Something went wrong')
      setStatus('error')
    }
  }

  // Guestbook sign handler
  const handleSignatureComplete = async (signatureData) => {
    console.log('🖊️ Signing guestbook with data:', {
      authorUsername,
      name: signatureData.name,
      messageLength: signatureData.message?.length || 0,
      pathLength: signatureData.path?.length || 0,
      viewBox: signatureData.viewBox,
    })

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/guestbook/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorUsername,
          signature: signatureData,
        }),
      })

      const data = await response.json()
      console.log('📝 Guestbook API response:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign guest book')
      }

      setStatus('success')

      // Reset after a few seconds
      setTimeout(() => {
        setStatus('idle')
        setSignName('')
        setSignMessage('')
        setMode(null)
      }, 3000)
    } catch (err) {
      console.error('❌ Guestbook sign error:', err)
      setErrorMessage(err.message || 'Something went wrong')
      setStatus('error')
      setIsSubmitting(false)
    }
  }

  // Handle cancel/close
  const handleCancel = () => {
    setMode(null)
    setStatus('idle')
    setErrorMessage('')
    setEmail('')
    setSignName('')
    setSignMessage('')
    setIsSubmitting(false)
  }

  // Success state
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
        {mode === 'guestbook'
          ? 'Successfully signed the guest book!'
          : status === 'already'
            ? 'Already subscribed!'
            : 'Successfully subscribed!'
        }
      </div>
    )
  }

  // Collapsed state - show the combined button
  if (mode === null) {
    // If only one option is enabled, show a simpler button
    if (!enableGuestbook && enableNewsletter) {
      return (
        <button
          onClick={() => setMode('newsletter')}
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
            gap: 8px;

            &:hover {
              color: ${colors.text};
              border-color: ${colors.text};
            }
          `}
        >
          <NewsletterIcon />
          {newsletterText}
        </button>
      )
    }

    if (enableGuestbook && !enableNewsletter) {
      return (
        <button
          onClick={() => setMode('guestbook')}
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
            gap: 8px;

            &:hover {
              color: ${colors.text};
              border-color: ${colors.text};
            }
          `}
        >
          <PenIcon />
          {guestbookText}
        </button>
      )
    }

    // Show segmented button for both options
    return (
      <div
        css={css`
          display: flex;
          border: 1px solid ${colors.border};
          border-radius: 6px;
          overflow: hidden;
        `}
      >
        <button
          onClick={() => setMode('newsletter')}
          css={css`
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 12px 12px;
            background: ${colors.bg};
            color: ${colors.muted};
            border: none;
            border-right: 1px solid ${colors.border};
            font-size: 14px;
            font-family: Inter, sans-serif;
            cursor: pointer;
            transition: all 0.2s ease;
            gap: 6px;

            &:hover {
              color: ${colors.text};
              background: ${colors.border}22;
            }
          `}
        >
          <NewsletterIcon />
          Subscribe
        </button>
        <button
          onClick={() => setMode('guestbook')}
          css={css`
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 12px 12px;
            background: ${colors.bg};
            color: ${colors.muted};
            border: none;
            font-size: 14px;
            font-family: Inter, sans-serif;
            cursor: pointer;
            transition: all 0.2s ease;
            gap: 6px;

            &:hover {
              color: ${colors.text};
              background: ${colors.border}22;
            }
          `}
        >
          <PenIcon />
          Sign Guest Book
        </button>
      </div>
    )
  }

  // Guest book mode - render as fixed overlay to not affect page layout
  if (mode === 'guestbook') {
    return (
      <>
        {/* Placeholder to maintain layout */}
        <div css={css`height: 44px; border: 1px solid transparent;`} />
        {/* Fixed overlay */}
        <div
          css={css`
            position: fixed;
            inset: 0;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
          `}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) {
              handleCancel()
            }
          }}
        >
          <div
            css={css`
              width: 100%;
              max-width: 420px;
              max-height: 90vh;
              overflow-y: auto;
            `}
          >
            <SignatureCanvas
              colors={colors}
              onSignatureComplete={handleSignatureComplete}
              onCancel={handleCancel}
              isSubmitting={isSubmitting}
              name={signName}
              setName={setSignName}
              message={signMessage}
              setMessage={setSignMessage}
              authorDisplayName={authorDisplayName}
              errorMessage={errorMessage}
            />
          </div>
        </div>
      </>
    )
  }

  // Newsletter mode - render as fixed overlay to not affect page layout
  return (
    <>
      {/* Placeholder to maintain layout */}
      <div css={css`height: 44px; border: 1px solid transparent;`} />
      {/* Fixed overlay */}
      <div
        css={css`
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
        `}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleCancel()
          }
        }}
      >
        <form
          onSubmit={handleNewsletterSubmit}
          css={css`
            width: 100%;
            max-width: 420px;
            border: 1px solid ${colors.border};
            border-radius: 6px;
            overflow: hidden;
            background: ${colors.bg};
          `}
        >
      {/* Header with tabs */}
      <div
        css={css`
          display: flex;
          border-bottom: 1px solid ${colors.border};
        `}
      >
        <button
          type="button"
          css={css`
            flex: 1;
            padding: 12px 16px;
            font-size: 14px;
            font-weight: 500;
            color: ${colors.text};
            background: ${colors.bg};
            border: none;
            border-bottom: 2px solid ${colors.text};
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          `}
        >
          <NewsletterIcon />
          Subscribe
        </button>
        {enableGuestbook && (
          <button
            type="button"
            onClick={() => {
              setMode('guestbook')
              setStatus('idle')
              setErrorMessage('')
            }}
            css={css`
              flex: 1;
              padding: 12px 16px;
              font-size: 14px;
              font-weight: 500;
              color: ${colors.muted};
              background: ${colors.bg};
              border: none;
              border-bottom: 2px solid transparent;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
              transition: color 0.2s ease;

              &:hover {
                color: ${colors.text};
              }
            `}
          >
            <PenIcon />
            Sign
          </button>
        )}
        <button
          type="button"
          onClick={handleCancel}
          css={css`
            padding: 12px 16px;
            background: none;
            border: none;
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
      </div>
    </>
  )
}

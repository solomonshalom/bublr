/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { authedFetch } from '../lib/authed-fetch'
import { formatPrice } from '../lib/shop'

/**
 * The reader's side of a paid newsletter: subscribing (on the writer's own
 * Stripe or Creem checkout), signing in to read paid posts, and confirming
 * the payment when they come back. Used on profiles, at the end of posts and
 * on paid posts' paywall.
 */

export const planPrice = (plan, interval = 'month') => {
  const amount = interval === 'year' ? plan?.yearly : plan?.monthly
  return amount ? `${formatPrice(amount, plan.currency)}/${interval === 'year' ? 'year' : 'month'}` : ''
}

const RETURN_PARAMS = ['paid', 'session_id', 'checkout_id', 'order_id', 'customer_id', 'subscription_id', 'product_id', 'request_id', 'signature']

function cleanReturnUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  let changed = false
  for (const key of RETURN_PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key)
      changed = true
    }
  }
  if (changed) window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

/**
 * After the checkout page sends the reader back (?paid=success&session_id=…),
 * confirm the payment with the server, which also signs this browser in.
 */
export function usePaidReturn(username) {
  const [state, setState] = useState({ status: 'idle' })
  useEffect(() => {
    if (typeof window === 'undefined' || !username) return undefined
    const params = new URL(window.location.href).searchParams
    const paid = params.get('paid')
    if (paid === 'cancelled') {
      cleanReturnUrl()
      setState({ status: 'cancelled' })
      return undefined
    }
    const id = params.get('session_id') || params.get('checkout_id')
    if (paid !== 'success' || !id) return undefined

    let cancelled = false
    let tries = 0
    setState({ status: 'confirming' })
    const attempt = async () => {
      try {
        const response = await fetch(`/api/newsletter/paid/complete?user=${encodeURIComponent(username)}&checkout_id=${encodeURIComponent(id)}`, {
          credentials: 'same-origin',
        })
        const data = await response.json().catch(() => ({}))
        if (cancelled) return
        if (response.status === 202 && tries++ < 6) {
          setTimeout(attempt, 2500)
          return
        }
        if (response.ok && data.paid) {
          cleanReturnUrl()
          setState({ status: 'done', email: data.email, priceText: data.priceText })
        } else {
          setState({ status: 'error', message: data.error || data.message || 'We couldn’t confirm the payment yet. Refresh in a moment.' })
        }
      } catch (_) {
        if (!cancelled) setState({ status: 'error', message: 'We couldn’t confirm the payment yet. Refresh in a moment.' })
      }
    }
    attempt()
    return () => {
      cancelled = true
    }
  }, [username])
  return state
}

// The profile passes the writer's own colours; elsewhere the site's theme is used.
const palette = colors => ({
  bg: colors?.bg || 'var(--grey-1)',
  text: colors?.text || 'var(--grey-4)',
  muted: colors?.muted || 'var(--grey-3)',
  border: colors?.border || 'var(--grey-2)',
})

const fieldStyle = p => css`
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid ${p.border};
  border-radius: 4px;
  background: ${p.bg};
  color: ${p.text};
  font-size: 14px;
  font-family: Inter, sans-serif;
  outline: none;
  &:focus {
    border-color: ${p.text};
  }
  &::placeholder {
    color: ${p.muted};
  }
`

const primaryButton = p => css`
  width: 100%;
  padding: 10px 20px;
  background: ${p.text};
  color: ${p.bg};
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-family: Inter, sans-serif;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s ease;
  &:hover:not(:disabled) {
    opacity: 0.9;
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const linkButton = p => css`
  font: inherit;
  font-size: 12px;
  color: ${p.muted};
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  &:hover {
    color: ${p.text};
  }
`

const note = p => css`
  font-size: 12px;
  color: ${p.muted};
  line-height: 1.5;
  margin: 0;
`

function IntervalChoice({ plan, value, onChange, p }) {
  if (!plan?.yearly) return null
  const option = (interval, label) => {
    const selected = value === interval
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => onChange(interval)}
        css={css`
          flex: 1;
          font: inherit;
          font-size: 13px;
          padding: 8px 10px;
          border-radius: 4px;
          border: 1px solid ${selected ? p.text : p.border};
          background: ${p.bg};
          color: ${selected ? p.text : p.muted};
          cursor: pointer;
          text-align: left;
        `}
      >
        <span css={css`display: block; font-weight: 500;`}>{label}</span>
        <span css={css`font-size: 12px;`}>{planPrice(plan, interval)}</span>
      </button>
    )
  }
  return (
    <div role="radiogroup" aria-label="Billing" css={css`display: flex; gap: 8px;`}>
      {option('month', 'Monthly')}
      {option('year', 'Yearly')}
    </div>
  )
}

/** "Already a paid subscriber? Sign in": emails a sign-in link. */
export function PaidSignInForm({ authorUsername, onCancel, autoFocus = true, colors }) {
  const p = palette(colors)
  const [email, setEmail] = useState('')
  const [state, setState] = useState({ status: 'idle' })
  const submit = async event => {
    event.preventDefault()
    if (!email.includes('@')) return setState({ status: 'error', message: 'Enter the address you subscribed with.' })
    setState({ status: 'sending' })
    try {
      const response = await fetch('/api/newsletter/paid/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authorUsername, email: email.trim(), next: window.location.pathname }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Something went wrong')
      setState({ status: 'sent', message: data.message })
    } catch (error) {
      setState({ status: 'error', message: error.message })
    }
  }
  if (state.status === 'sent') {
    return (
      <div css={css`display: flex; flex-direction: column; gap: 8px;`}>
        <p css={[note(p), css`color: ${p.text};`]} role="status">{state.message}</p>
        {onCancel ? <button type="button" css={linkButton(p)} onClick={onCancel}>Back</button> : null}
      </div>
    )
  }
  return (
    <form onSubmit={submit} css={css`display: flex; flex-direction: column; gap: 10px;`}>
      <p css={note(p)}>Enter the email you subscribed with and we’ll send you a link to read on this device.</p>
      <input
        type="email"
        value={email}
        onChange={event => setEmail(event.target.value)}
        placeholder="your@email.com"
        autoComplete="email"
        autoFocus={autoFocus}
        aria-label="Your email"
        css={fieldStyle(p)}
      />
      <button type="submit" css={primaryButton(p)} disabled={state.status === 'sending'}>
        {state.status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {state.status === 'error' ? <p css={[note(p), css`color: #E23E57;`]}>{state.message}</p> : null}
      {onCancel ? <button type="button" css={linkButton(p)} onClick={onCancel}>Back</button> : null}
    </form>
  )
}

/** Subscribe as a paid reader: interval, email, then the writer's checkout page. */
export function PaidSubscribeForm({ authorUsername, authorDisplayName, plan, autoFocus = false, colors }) {
  const p = palette(colors)
  const [period, setPeriod] = useState('month')
  const [email, setEmail] = useState('')
  const [state, setState] = useState({ status: 'idle' })
  const [signingIn, setSigningIn] = useState(false)

  if (signingIn) return <PaidSignInForm authorUsername={authorUsername} onCancel={() => setSigningIn(false)} colors={colors} />

  if (!plan?.open) {
    return <p css={note(p)}>{authorDisplayName} isn’t taking new paid subscribers right now.</p>
  }

  const submit = async event => {
    event.preventDefault()
    if (!email.includes('@')) return setState({ status: 'error', message: 'Enter a valid email address.' })
    setState({ status: 'working' })
    try {
      const response = await authedFetch('/api/newsletter/paid/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authorUsername, email: email.trim(), interval: period, returnPath: window.location.pathname }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Subscribing isn’t available right now.')
      if (data.alreadySubscribed) return setState({ status: 'already', message: data.message })
      if (!data.checkoutUrl) throw new Error('Subscribing isn’t available right now.')
      window.location.assign(data.checkoutUrl)
    } catch (error) {
      setState({ status: 'error', message: error.message })
    }
  }

  return (
    <form onSubmit={submit} css={css`display: flex; flex-direction: column; gap: 10px;`}>
      {plan.description ? <p css={[note(p), css`color: ${p.text}; white-space: pre-line;`]}>{plan.description}</p> : null}
      <IntervalChoice plan={plan} value={period} onChange={setPeriod} p={p} />
      <input
        type="email"
        value={email}
        onChange={event => setEmail(event.target.value)}
        placeholder="your@email.com"
        autoComplete="email"
        autoFocus={autoFocus}
        aria-label="Your email"
        css={fieldStyle(p)}
      />
      <button type="submit" css={primaryButton(p)} disabled={state.status === 'working'}>
        {state.status === 'working' ? 'Opening checkout…' : `Subscribe · ${planPrice(plan, period)}`}
      </button>
      {state.status === 'error' || state.status === 'already' ? (
        <p role="status" css={[note(p), css`color: ${state.status === 'error' ? '#E23E57' : p.text};`]}>{state.message}</p>
      ) : null}
      <p css={note(p)}>
        You pay {authorDisplayName} directly{plan.testMode ? ' (test mode: only the writer can subscribe)' : ''}. Cancel any time from any email.{' '}
        <button type="button" css={linkButton(p)} onClick={() => setSigningIn(true)}>Already a paid subscriber? Sign in</button>
      </p>
    </form>
  )
}

/** A thank-you line after paying, for pages without a paywall (the profile). */
export function PaidReturnNotice({ authorUsername, authorDisplayName, colors }) {
  const p = palette(colors)
  const state = usePaidReturn(authorUsername)
  if (state.status === 'idle' || state.status === 'cancelled') return null
  return (
    <p
      role="status"
      css={css`
        margin: 0 0 12px 0;
        padding: 10px 14px;
        border-radius: 6px;
        border: 1px solid ${p.border};
        font-size: 14px;
        color: ${state.status === 'error' ? '#E23E57' : p.text};
      `}
    >
      {state.status === 'confirming'
        ? 'Confirming your payment…'
        : state.status === 'done'
          ? `Thank you! You’re a paid subscriber to ${authorDisplayName}. Check your inbox for a welcome email.`
          : state.message}
    </p>
  )
}

/**
 * The paywall on a paid post. Asks the server whether this reader (or the
 * writer) may read the whole post, and hands it to the page if so; otherwise
 * shows the plan, the subscribe form and a way to sign in.
 */
export function PaidPostGate({ postId, author, plan, hasPreview = false, onUnlocked, colors }) {
  const p = palette(colors)
  const returned = usePaidReturn(author.name)
  const [state, setState] = useState({ status: 'checking' })
  const [signingIn, setSigningIn] = useState(false)
  const unlockedRef = useRef(onUnlocked)
  unlockedRef.current = onUnlocked

  const check = useCallback(async () => {
    try {
      const response = await authedFetch(`/api/newsletter/paid/content?postId=${encodeURIComponent(postId)}`, { credentials: 'same-origin' })
      const data = await response.json().catch(() => ({}))
      if (response.ok && typeof data.html === 'string') {
        setState({ status: 'unlocked' })
        unlockedRef.current?.({ html: data.html, reader: data.reader || null, author: Boolean(data.author) })
      } else if (response.ok && data.locked) {
        setState({ status: 'locked', signedIn: data.signedIn || null })
      } else {
        setState({ status: 'error', message: data.error || 'This post can’t be shown right now.' })
      }
    } catch (_) {
      setState({ status: 'error', message: 'This post can’t be shown right now.' })
    }
  }, [postId])

  useEffect(() => {
    if (returned.status === 'confirming') return
    check()
  }, [check, returned.status])

  if (state.status === 'unlocked') return null

  return (
    <aside
      aria-label="For paid subscribers"
      css={css`
        margin: 0 0 2rem 0;
        padding: 20px;
        border: 1px solid ${p.border};
        border-radius: 8px;
        background: ${p.bg};
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-family: Inter, sans-serif;
      `}
    >
      <div css={css`display: flex; align-items: center; gap: 8px; color: ${p.text}; font-weight: 500; font-size: 15px;`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        {hasPreview ? 'The rest of this post is for paid subscribers' : 'This post is for paid subscribers'}
      </div>
      {returned.status === 'confirming' || state.status === 'checking' ? (
        <p css={note(p)}>{returned.status === 'confirming' ? 'Confirming your payment…' : 'Checking…'}</p>
      ) : state.status === 'error' ? (
        <p css={note(p)}>{state.message}</p>
      ) : (
        <>
          {returned.status === 'error' ? <p css={[note(p), css`color: #E23E57;`]}>{returned.message}</p> : null}
          {state.signedIn ? (
            <p css={note(p)}>
              You’re signed in as {state.signedIn}, which doesn’t have a paid subscription to {author.displayName}.{' '}
              <button
                type="button"
                css={linkButton(p)}
                onClick={async () => {
                  await fetch('/api/newsletter/paid/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {})
                  check()
                }}
              >
                Sign out
              </button>
            </p>
          ) : null}
          {signingIn ? (
            <PaidSignInForm authorUsername={author.name} onCancel={() => setSigningIn(false)} colors={colors} />
          ) : (
            <PaidSubscribeForm authorUsername={author.name} authorDisplayName={author.displayName} plan={plan} colors={colors} />
          )}
          {!signingIn && !plan?.open ? (
            <button type="button" css={linkButton(p)} onClick={() => setSigningIn(true)}>Already a paid subscriber? Sign in</button>
          ) : null}
        </>
      )}
    </aside>
  )
}

/** "Reading as … · Manage subscription · Sign out", under an unlocked paid post. */
export function PaidReaderBar({ reader, onSignOut, colors }) {
  const p = palette(colors)
  if (!reader) return null
  return (
    <p css={[note(p), css`margin: 0 0 2rem 0;`]}>
      Reading as {reader.email} (paid subscriber) ·{' '}
      <a href={reader.manageUrl} css={css`color: inherit;`}>Manage subscription</a> ·{' '}
      <button
        type="button"
        css={linkButton(p)}
        onClick={async () => {
          await fetch('/api/newsletter/paid/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {})
          onSignOut?.()
        }}
      >
        Sign out
      </button>
    </p>
  )
}

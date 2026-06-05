/** @jsxImportSource @emotion/react */
import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { css } from '@emotion/react'
import { useAuthState } from 'react-firebase-hooks/auth'

import firebase, { auth } from '../lib/firebase'
import { ensureUserDocument } from '../lib/db'

import meta from '../components/meta'
import Spinner from '../components/spinner'
import CTAButton from '../components/cta-button'
import { FadeInGroup, FadeInItem } from '../components/fade-in'

// Map Firebase auth error codes to friendly, human messages
function friendlyError(err) {
  switch (err?.code) {
    case 'auth/invalid-email':
      return 'That doesn’t look like a valid email address.'
    case 'auth/weak-password':
      return 'Password is too weak — use at least 6 characters.'
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect password for that email. Please try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/operation-not-allowed':
      return 'Email sign-up isn’t enabled yet. Please continue with Google.'
    case 'auth/user-disabled':
      return 'This account has been disabled.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    default:
      return err?.message || 'Something went wrong. Please try again.'
  }
}

export default function SignUp() {
  const router = useRouter()
  const [user, loading] = useAuthState(auth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState(null)

  const busy = submitting || googleLoading

  // Already authenticated? Send them straight to the dashboard.
  useEffect(() => {
    if (user && !loading) {
      router.replace('/dashboard')
    }
  }, [user, loading, router])

  // Complete the Google redirect flow (mobile/Safari fallback) on return.
  useEffect(() => {
    auth
      .getRedirectResult()
      .then(async result => {
        if (result?.user) {
          await ensureUserDocument(result.user)
          router.push('/dashboard')
        }
      })
      .catch(err => {
        if (err.code && err.code !== 'auth/popup-closed-by-user') {
          setError('Sign-in was interrupted. Please try again.')
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGoogle = async () => {
    if (busy) return
    setGoogleLoading(true)
    setError(null)

    const provider = new firebase.auth.GoogleAuthProvider()
    provider.addScope('email')
    provider.addScope('profile')

    try {
      const cred = await auth.signInWithPopup(provider)
      await ensureUserDocument(cred.user)
      router.push('/dashboard')
    } catch (err) {
      // Popup unavailable (mobile/Safari/blocked) — fall back to redirect.
      if (
        err.code === 'auth/network-request-failed' ||
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await auth.signInWithRedirect(provider)
          return // page navigates away; keep the loading state
        } catch (redirectErr) {
          setError('Unable to sign in. Please check your connection and try again.')
        }
      } else if (
        err.code !== 'auth/popup-closed-by-user' &&
        err.code !== 'auth/cancelled-popup-request'
      ) {
        setError(friendlyError(err))
      }
      setGoogleLoading(false)
    }
  }

  // One form, two outcomes: create the account, or sign in if it already exists.
  const handleEmailSubmit = async e => {
    e.preventDefault()
    if (busy) return
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)
    try {
      let cred
      let isNewUser = false

      try {
        cred = await auth.createUserWithEmailAndPassword(trimmedEmail, password)
        isNewUser = true
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          // Account exists — treat this as a log in instead.
          cred = await auth.signInWithEmailAndPassword(trimmedEmail, password)
        } else {
          throw err
        }
      }

      if (isNewUser) {
        const displayName = trimmedEmail.split('@')[0]
        try {
          await cred.user.updateProfile({ displayName })
        } catch (_) {
          // non-fatal — the profile doc is the source of truth
        }
        await ensureUserDocument(cred.user, { displayName })
      } else {
        await ensureUserDocument(cred.user)
      }

      router.push('/dashboard')
    } catch (err) {
      setError(friendlyError(err))
      setSubmitting(false)
    }
  }

  // While the initial auth check runs (or we're bouncing a signed-in user),
  // show a quiet spinner instead of flashing the form.
  if (loading || user) {
    return (
      <div
        css={css`
          display: flex;
          justify-content: center;
          color: var(--grey-3);
        `}
      >
        <Spinner />
      </div>
    )
  }

  return (
    <FadeInGroup staggerDelay={0.08}>
      <FadeInItem>
        <Link href="/" passHref>
          <a
            aria-label="Back to Bublr home"
            css={css`
              display: inline-block;
              font-size: 2.5rem;
              line-height: 1;
              margin-bottom: 1.25rem;
              text-decoration: none;
              font-family: 'Apple Color Emoji', 'Segoe UI Emoji',
                'Segoe UI Symbol', 'Noto Color Emoji', emoji, sans-serif;
            `}
          >
            🍱
          </a>
        </Link>
      </FadeInItem>
      <FadeInItem>
        <h1
          css={css`
            font-size: 1.5rem;
            letter-spacing: -0.02rem;
            margin-bottom: 0.4rem;
          `}
        >
          Welcome to Bublr
        </h1>
        <p
          css={css`
            color: var(--grey-3);
            font-size: 0.9rem;
            margin-bottom: 1.75rem;
          `}
        >
          Sign up or log in to continue.
        </p>
      </FadeInItem>
      <FadeInItem>
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          css={buttonBaseStyles}
        >
          {googleLoading ? (
            <Spinner />
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>
      </FadeInItem>
      <FadeInItem>
        <div css={dividerStyles}>
          <span />
          <span css={dividerLabelStyles}>or</span>
          <span />
        </div>
      </FadeInItem>
      <FadeInItem>
        <form onSubmit={handleEmailSubmit} noValidate>
          <div css={fieldStyles}>
            <label htmlFor="email" css={labelStyles}>
              Email
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={busy}
              css={inputStyles}
            />
          </div>

          <div css={fieldStyles}>
            <label htmlFor="password" css={labelStyles}>
              Password
            </label>
            <div css={passwordWrapStyles}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={busy}
                css={[inputStyles, css`padding-right: 3rem;`]}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                css={revealStyles}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {error && <p css={errorStyles}>{error}</p>}

          <CTAButton
            block
            whiteArrow
            type="submit"
            disabled={busy}
            style={{ marginTop: '1.25rem' }}
          >
            {submitting ? <Spinner /> : 'Continue'}
          </CTAButton>
        </form>
      </FadeInItem>
      <FadeInItem>
        <p css={fineprintStyles}>
          By continuing you agree to our{' '}
          <Link href="/terms">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy">
            Privacy Policy
          </Link>
          .
        </p>
      </FadeInItem>
    </FadeInGroup>
  );
}

/* ---------- styles ---------- */

const buttonBaseStyles = css`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;

  width: 100%;
  min-height: 2.95rem;
  padding: 0.8em 1em;

  font: 500 0.95rem 'Inter', sans-serif;
  color: var(--grey-4);
  background: var(--grey-1);
  border: 1px solid var(--grey-2);
  border-radius: 0.5rem;
  cursor: pointer;

  transition: border-color 200ms ease, background 200ms ease, opacity 200ms ease;

  &:hover:not(:disabled) {
    border-color: var(--grey-3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const dividerStyles = css`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.25rem 0;

  span:first-of-type,
  span:last-of-type {
    flex: 1;
    height: 1px;
    background: var(--border);
  }
`

const dividerLabelStyles = css`
  color: var(--grey-3);
  font-size: 0.8rem;
`

const fieldStyles = css`
  margin-bottom: 0.9rem;
`

const labelStyles = css`
  display: block;
  margin-bottom: 0.4rem;
  font-size: 0.8rem;
  color: var(--grey-3);
`

const inputStyles = css`
  display: block;
  width: 100%;
  padding: 0.8em 1em;

  font: 400 0.95rem 'Inter', sans-serif;
  color: var(--grey-4);
  background: rgba(128, 128, 128, 0.07);
  border: 1px solid var(--grey-2);
  border-radius: 0.5rem;
  outline: none;

  transition: border-color 200ms ease, background 200ms ease,
    box-shadow 200ms ease;

  &::placeholder {
    color: var(--grey-3);
  }

  &:focus {
    border-color: var(--grey-3);
    background: rgba(128, 128, 128, 0.1);
    box-shadow: 0 0 0 3px rgba(128, 128, 128, 0.08);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const passwordWrapStyles = css`
  position: relative;
`

const revealStyles = css`
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;

  background: none;
  border: none;
  color: var(--grey-3);
  cursor: pointer;

  transition: color 200ms ease;

  &:hover {
    color: var(--grey-4);
  }
`

const errorStyles = css`
  margin: 0.25rem 0 0;
  color: #e53e3e;
  font-size: 0.875rem;
`

const fineprintStyles = css`
  margin-top: 1.5rem;
  color: var(--grey-3);
  font-size: 0.78rem;
  line-height: 1.5;

  a {
    color: var(--grey-4);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
`

/* ---------- icons ---------- */

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

/* ---------- split-screen layout ---------- */

// Pexels — Lion's Head, Cape Town. Compressed delivery keeps the load light.
const SIGNUP_IMAGE =
  'https://images.pexels.com/photos/34568018/pexels-photo-34568018.jpeg?auto=compress&cs=tinysrgb&w=1600'

const splitWrapStyles = css`
  display: flex;
  min-height: 100vh;
  width: 100%;
`

const formPaneStyles = css`
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem;
  background: var(--grey-1);

  @media (max-width: 880px) {
    padding: 2rem 1.5rem;
  }
`

const formInnerStyles = css`
  width: 100%;
  max-width: 360px;
`

// Floating, rounded image card with a soft bottom scrim — feels intentional
// rather than a raw edge-to-edge crop. Hidden on small screens.
const imagePaneStyles = css`
  flex: 1.1 1 0;
  min-width: 0;
  margin: 0.875rem;
  border-radius: 1.1rem;
  background-color: var(--grey-2);
  background-image: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.3) 0%,
      rgba(0, 0, 0, 0) 34%
    ),
    url('${SIGNUP_IMAGE}');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  box-shadow: 0 12px 32px -14px rgba(0, 0, 0, 0.5);

  @media (max-width: 880px) {
    display: none;
  }
`

SignUp.getLayout = function SignUpLayout(page) {
  return (
    <>
      <Head>
        {meta({
          title: 'Sign up · Bublr',
          description: 'Create your Bublr account or log in to continue.',
          url: '/signup',
        })}
        <meta name="robots" content="noindex, nofollow" />
        <link rel="preload" as="image" href={SIGNUP_IMAGE} />
      </Head>
      <div css={splitWrapStyles}>
        <div css={formPaneStyles}>
          <div css={formInnerStyles}>{page}</div>
        </div>
        <div css={imagePaneStyles} aria-hidden="true" />
      </div>
    </>
  )
}

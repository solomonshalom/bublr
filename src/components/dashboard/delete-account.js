/** @jsxImportSource @emotion/react */
import { useState } from 'react'
import { css } from '@emotion/react'

import firebase from '../../lib/firebase'
import { DELETE_CONFIRM_PHRASE, RECENT_SIGN_IN_SECONDS } from '../../lib/delete-account'
import DsButton from './ds-button'
import { DsInput, DsLabel, DsField } from './ds-input'

const rowStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
`

const labelStyle = css`
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  color: var(--grey-4);
  font-weight: 500;
`

const hintStyle = css`
  display: block;
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--grey-3);
  margin-top: 0.2rem;
  font-weight: 400;
  line-height: 1.5;
`

const listStyle = css`
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  color: var(--grey-3);
  line-height: 1.6;
  margin: 0.75rem 0 1.1rem 0;
  padding-left: 1.1rem;
`

const errorStyle = css`
  font-family: 'Inter', sans-serif;
  font-size: 0.78rem;
  color: #e5484d;
  line-height: 1.5;
  margin: 0 0 0.9rem 0;
`

const actionsStyle = css`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
`

const usesPassword = user => (user?.providerData || []).some(p => p?.providerId === 'password')

// Firebase only lets a recently signed-in user do something this final, and
// so does /api/account/delete. Leave a couple of minutes of headroom.
async function signedInRecently(user) {
  try {
    const { authTime } = await user.getIdTokenResult()
    const age = (Date.now() - new Date(authTime).getTime()) / 1000
    return age >= 0 && age < RECENT_SIGN_IN_SECONDS - 120
  } catch (_) {
    return false
  }
}

function friendlyAuthError(err) {
  switch (err?.code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'That password isn’t right.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.'
    case 'auth/user-mismatch':
      return 'That’s a different account. Sign in with the one you’re deleting.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was closed before it finished. Nothing was deleted.'
    case 'auth/popup-blocked':
    case 'auth/operation-not-supported-in-this-environment':
      return 'Your browser blocked the sign-in window. Sign out, sign back in, and delete your account straight away.'
    case 'auth/network-request-failed':
      return 'No connection. Nothing was deleted.'
    default:
      return 'We couldn’t confirm it’s you. Nothing was deleted.'
  }
}

/**
 * "Delete account" row for Settings → Advanced. Opens an inline confirmation
 * (type the phrase, sign in again), then removes everything via
 * /api/account/delete and finally the sign-in record itself.
 */
export default function DeleteAccount({ user }) {
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle') // idle | working | done
  const [error, setError] = useState(null)

  const withPassword = usesPassword(user)
  const phraseOk = phrase.trim().toLowerCase() === DELETE_CONFIRM_PHRASE
  const canSubmit = !!user && phraseOk && (!withPassword || password.length > 0) && status === 'idle'

  const close = () => {
    if (status !== 'idle') return
    setOpen(false)
    setPhrase('')
    setPassword('')
    setError(null)
  }

  const handleDelete = async e => {
    e.preventDefault()
    if (!canSubmit) return
    setStatus('working')
    setError(null)

    // 1. Confirm it's really them.
    try {
      if (withPassword) {
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, password)
        await user.reauthenticateWithCredential(credential)
      } else if (!(await signedInRecently(user))) {
        await user.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider())
      }
    } catch (err) {
      setError(friendlyAuthError(err))
      setStatus('idle')
      return
    }

    // 2. Delete everything they made.
    try {
      const token = await user.getIdToken(true)
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm: DELETE_CONFIRM_PHRASE }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Something went wrong. Please try again.')
        setStatus('idle')
        return
      }
    } catch (err) {
      setError('No connection. Please try again.')
      setStatus('idle')
      return
    }

    // 3. Remove the sign-in itself. The data is already gone, so if this
    //    fails we still sign out rather than leave them in an empty dashboard.
    setStatus('done')
    try {
      await user.delete()
    } catch (err) {
      console.error('Could not remove sign-in record:', err)
      try {
        await firebase.auth().signOut()
      } catch (_) {
        // nothing left to do
      }
    }
    window.location.replace('/')
  }

  if (!open) {
    return (
      <div css={rowStyle}>
        <div>
          <div css={labelStyle}>Delete account</div>
          <span css={hintStyle}>
            Permanently remove your profile, every post and draft, and your subscriber list.
          </span>
        </div>
        <DsButton variant="destructive" size="sm" onClick={() => setOpen(true)} disabled={!user}>
          Delete account…
        </DsButton>
      </div>
    )
  }

  return (
    <form onSubmit={handleDelete} aria-label="Delete account">
      <div css={labelStyle}>Delete your account for good?</div>
      <ul css={listStyle}>
        <li>Your profile, posts and drafts come off Bublr, and their links stop working.</li>
        <li>Your subscriber list, followers, API keys, guest book and custom domain are removed.</li>
        <li>
          This can’t be undone, and we can’t bring anything back. Use <em>Download export</em> above
          first if you want a copy.
        </li>
      </ul>

      <DsField>
        <DsLabel htmlFor="delete-account-phrase">
          Type <strong>{DELETE_CONFIRM_PHRASE}</strong> to confirm
        </DsLabel>
        <DsInput
          id="delete-account-phrase"
          value={phrase}
          onChange={e => setPhrase(e.target.value)}
          placeholder={DELETE_CONFIRM_PHRASE}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={status !== 'idle'}
        />
      </DsField>

      {withPassword ? (
        <DsField>
          <DsLabel htmlFor="delete-account-password">Your password</DsLabel>
          <DsInput
            id="delete-account-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={status !== 'idle'}
          />
        </DsField>
      ) : (
        <p css={[hintStyle, css`margin: -0.4rem 0 1rem 0;`]}>
          We may ask you to sign in with Google once more to confirm it’s you.
        </p>
      )}

      {error && (
        <p css={errorStyle} role="alert">
          {error}
        </p>
      )}

      <div css={actionsStyle}>
        <DsButton variant="outline" size="sm" onClick={close} disabled={status !== 'idle'}>
          Keep my account
        </DsButton>
        <DsButton variant="destructive" size="sm" type="submit" disabled={!canSubmit} aria-live="polite">
          {status === 'working' ? 'Deleting…' : status === 'done' ? 'Deleted' : 'Delete everything'}
        </DsButton>
      </div>
    </form>
  )
}

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useEffect, useRef, useState } from 'react'

import { authedFetch } from '../../lib/authed-fetch'
import DsButton from './ds-button'
import { DsTile } from './ds-section'

const SHARE_TOKEN = /^[a-f0-9]{48}$/

/**
 * "Share draft" tile for the editor's Visibility tray. Gives a draft a
 * private link the writer can send to a friend or editor before publishing,
 * and lets them turn it off again. The link lives on the post as
 * `shareToken`; the tile reads it from the live post, so two open tabs agree.
 */
export default function ShareDraftTile({ postId, shareToken }) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const copiedTimer = useRef(null)

  useEffect(() => () => clearTimeout(copiedTimer.current), [])

  const active = typeof shareToken === 'string' && SHARE_TOKEN.test(shareToken)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://bublr.life'
  const url = active ? `${origin}/draft/${shareToken}` : ''

  const setShared = async enabled => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const response = await authedFetch('/api/posts/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, enabled }),
      })
      if (!response.ok) throw new Error('Share request failed')
    } catch (err) {
      console.error('Share draft error:', err)
      setError(
        enabled
          ? "Couldn't create the link. Please try again."
          : "Couldn't turn the link off. Please try again."
      )
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Clipboard can be blocked; the link is on screen to copy by hand
      setError('Copy the link above by hand.')
    }
  }

  return (
    <DsTile>
      <div css={css`display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;`}>
        <div css={css`min-width: 0;`}>
          <p css={css`font-size: 0.85rem; font-weight: 500; color: var(--grey-5); margin: 0;`}>
            Share draft
          </p>
          <p css={css`font-size: 0.72rem; color: var(--grey-3); margin: 0.15rem 0 0 0; line-height: 1.4;`}>
            {active
              ? 'Anyone with this link can read the draft'
              : 'Get a private link to ask for feedback'}
          </p>
        </div>
        {!active && (
          <DsButton variant="outline" size="sm" disabled={busy} onClick={() => setShared(true)}>
            {busy ? 'Creating…' : 'Create link'}
          </DsButton>
        )}
      </div>

      {active && (
        <>
          <input
            type="text"
            readOnly
            value={url}
            aria-label="Private link to this draft"
            onFocus={e => e.target.select()}
            css={css`
              display: block;
              width: 100%;
              margin-top: 0.65rem;
              padding: 0.45rem 0.6rem;
              background: var(--grey-1);
              border: 1px solid var(--border);
              border-radius: 6px;
              outline: none;
              color: var(--grey-4);
              font-family: 'Inter', sans-serif;
              font-size: 0.75rem;
              text-overflow: ellipsis;

              &:focus {
                border-color: var(--grey-3);
              }
            `}
          />
          <div css={css`display: flex; gap: 0.4rem; margin-top: 0.5rem;`}>
            <DsButton variant="outline" size="sm" onClick={copy}>
              {copied ? 'Copied' : 'Copy link'}
            </DsButton>
            <DsButton variant="ghost" size="sm" disabled={busy} onClick={() => setShared(false)}>
              {busy ? 'Turning off…' : 'Turn off'}
            </DsButton>
          </div>
        </>
      )}

      {error && (
        <p role="alert" css={css`font-size: 0.72rem; color: #e55050; margin: 0.5rem 0 0 0; line-height: 1.4;`}>
          {error}
        </p>
      )}
    </DsTile>
  )
}

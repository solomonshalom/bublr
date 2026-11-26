/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState } from 'react'
import Link from 'next/link'

import { authedFetch } from '../../lib/authed-fetch'
import { hasActiveShopAccess } from '../../lib/subscription'
import { DsTile } from '../dashboard/ds-section'
import { Segmented } from '../dashboard/block-editor-kit'

const smallText = css`
  font-size: 0.72rem;
  color: var(--grey-3);
  margin: 0.15rem 0 0 0;
  line-height: 1.45;
  a {
    color: var(--accent-foreground);
  }
`

const linkButton = css`
  font: inherit;
  font-size: 0.72rem;
  color: var(--accent-foreground);
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
`

/**
 * "Who can read" in the editor's settings: everyone, or paid subscribers.
 * Switching saves any unsaved edits first (onBeforeChange), then asks the
 * server, which seals the post's body or opens it back up.
 */
export default function AccessTile({ post, userdata, editor, onBeforeChange, onAfterChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const paid = post.access === 'paid'
  // Display only: the server checks the signed plan and settings itself.
  const paidOn = Boolean(userdata && hasActiveShopAccess(userdata) && userdata.shopGrant && userdata.paidNewsletter?.enabled)
  const hasLine = Boolean(editor?.getHTML?.().includes('data-type="paywall"'))

  const change = async value => {
    if (busy || (value === 'paid') === paid) return
    setBusy(true)
    setError(null)
    let ok = false
    try {
      await onBeforeChange?.()
      const response = await authedFetch('/api/posts/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, access: value }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not change who can read this post')
      ok = true
    } catch (err) {
      setError(err.message)
    } finally {
      onAfterChange?.(value, ok)
      setBusy(false)
    }
  }

  return (
    <DsTile>
      <div css={css`display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;`}>
        <p css={css`font-size: 0.85rem; font-weight: 500; color: var(--grey-5); margin: 0;`}>Who can read</p>
        <Segmented
          label="Who can read"
          value={paid ? 'paid' : 'everyone'}
          onChange={change}
          options={[
            { value: 'everyone', label: 'Everyone' },
            { value: 'paid', label: 'Paid subscribers' },
          ]}
        />
      </div>
      {paid ? (
        <p css={smallText}>
          {hasLine
            ? 'Everything above the paywall line is a free preview; the rest is for paid subscribers. '
            : 'Only the title and excerpt are free. Add a paywall line to give everyone a taste. '}
          {editor ? (
            <button type="button" css={linkButton} onClick={() => editor.chain().focus().setPaywallLine().run()}>
              {hasLine ? 'Move the line here' : 'Add a paywall line here'}
            </button>
          ) : null}
          {hasLine && editor ? (
            <>
              {' · '}
              <button type="button" css={linkButton} onClick={() => editor.chain().focus().removePaywallLine().run()}>
                Remove it
              </button>
            </>
          ) : null}
        </p>
      ) : paidOn ? (
        <p css={smallText}>Anyone can read this post. Choose Paid subscribers to keep it for the readers who pay you.</p>
      ) : (
        <p css={smallText}>
          Want readers to pay for some posts? Turn on paid subscriptions in{' '}
          <Link href="/dashboard/settings/newsletter"><a>Settings → Newsletter</a></Link> (Pro + Shop plan). Readers pay you directly; Bublr takes no cut.
        </p>
      )}
      {busy ? <p css={smallText}>Saving…</p> : null}
      {error ? <p role="alert" css={[smallText, css`color: #dc2626;`]}>{error}</p> : null}
    </DsTile>
  )
}

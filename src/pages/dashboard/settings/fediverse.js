/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useCallback, useEffect, useState } from 'react'

import { authedFetch } from '../../../lib/authed-fetch'
import { DsSection, DsTray, DsTile } from '../../../components/dashboard/ds-section'
import DsSwitch from '../../../components/dashboard/ds-switch'
import { noticeStyle } from '../../../components/dashboard/payments-panel'
import { BlockSettingsPage, CopyField, LoadingContainer, helpText, useCurrentUserDoc, withBlockLayout } from '../../../components/dashboard/block-editor-kit'

/**
 * Settings → Fediverse: let people follow the writer from Mastodon and other
 * ActivityPub apps (lib/activitypub). Off until the writer turns it on.
 */
function FediverseEditor({ user }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const load = useCallback(async () => {
    const response = await authedFetch('/api/activitypub/settings')
    const data = await response.json().catch(() => ({}))
    setStatus(response.ok ? data : { error: data.error || 'Couldn’t load your setting' })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggle = async enabled => {
    if (
      !enabled &&
      !window.confirm(
        'Leave the fediverse? Your followers’ servers are told your account is gone, so they stop following you and your posts disappear from their timelines. If you turn it on again later, people have to follow you again.'
      )
    ) {
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const response = await authedFetch('/api/activitypub/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Couldn’t change it')
      setStatus(data)
      setMessage(
        enabled
          ? { type: 'success', text: `You’re on the fediverse as ${data.handle}. Paste it into Mastodon’s search to find yourself.` }
          : { type: 'info', text: 'You’ve left the fediverse.' }
      )
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  if (!status) return <p css={helpText}>Loading…</p>
  if (status.error) return <p css={noticeStyle('error')}>{status.error}</p>

  return (
    <>
      <DsSection title="Fediverse" description="Let people follow your writing from Mastodon and other apps on the fediverse. New posts show up in their timelines.">
        <DsTray>
          <DsTile css={css`display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;`}>
            <div>
              <p css={css`font-size: 0.85rem; font-weight: 500; color: var(--grey-5); margin: 0;`}>Share my posts on the fediverse</p>
              <p css={[helpText, css`margin: 0.15rem 0 0;`]}>
                {status.enabled
                  ? `${status.followers} ${status.followers === 1 ? 'follower' : 'followers'} on the fediverse`
                  : 'Off. Nothing of yours leaves Bublr this way until you turn it on.'}
              </p>
            </div>
            <DsSwitch checked={Boolean(status.enabled)} onChange={toggle} disabled={busy || !user.name} aria-label="Share my posts on the fediverse" />
          </DsTile>
          {status.enabled && status.handle ? (
            <DsTile>
              <p css={[helpText, css`margin: 0 0 0.5rem;`]}>Your fediverse address. Share it anywhere people follow each other:</p>
              <CopyField value={status.handle} />
            </DsTile>
          ) : null}
        </DsTray>
        {message ? <p role="status" css={[noticeStyle(message.type), css`margin-top: 0.9rem;`]}>{message.text}</p> : null}
      </DsSection>
      <DsSection title="What’s shared">
        <DsTray>
          <DsTile>
            <ul css={[helpText, css`margin: 0; padding-left: 1.1rem; li + li { margin-top: 0.4rem; }`]}>
              <li>Your name, picture, bio and website, and every post you publish from now on. Followers also see your recent posts on your fediverse profile.</li>
              <li>Edits reach followers a little after you stop typing. Unpublishing or deleting a post takes it off their timelines.</li>
              <li>Posts for paid subscribers go out as their free preview with a link; the rest stays on Bublr.</li>
              <li>Drafts and your subscriber list aren’t shared, and Bublr doesn’t show who follows you, only how many.</li>
              <li>Replies, likes and boosts from the fediverse aren’t shown on Bublr. Your page stays yours.</li>
              <li>Servers that copied a post may keep it after you delete it, as with any public post on the fediverse.</li>
            </ul>
          </DsTile>
        </DsTray>
      </DsSection>
    </>
  )
}

function FediverseSettings() {
  const { user, loading } = useCurrentUserDoc()
  return (
    <BlockSettingsPage title="Fediverse">
      <LoadingContainer isLoading={loading || !user}>{user ? <FediverseEditor user={user} /> : null}</LoadingContainer>
    </BlockSettingsPage>
  )
}

export default withBlockLayout(FediverseSettings, 'Fediverse')

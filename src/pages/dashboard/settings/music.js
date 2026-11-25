/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'

import { firestore } from '../../../lib/firebase'
import { authedFetch } from '../../../lib/authed-fetch'
import { MAX_TRACKS, normalizeMusic, trackTypeLabel } from '../../../lib/music'
import { DsSection, DsTray, DsTile } from '../../../components/dashboard/ds-section'
import { DsInput, DsLabel, DsField } from '../../../components/dashboard/ds-input'
import DsButton from '../../../components/dashboard/ds-button'
import DsSwitch from '../../../components/dashboard/ds-switch'
import MusicBlock, { SpotifyIcon } from '../../../components/blocks/music-block'
import { BlockStyles } from '../../../components/blocks/tokens'
import {
  BlockSettingsPage,
  CopyField,
  LoadingContainer,
  SaveIndicator,
  Segmented,
  helpText,
  iconButton,
  moveItem,
  previewFrame,
  shortId,
  useAutosave,
  useCurrentUserDoc,
  withBlockLayout,
} from '../../../components/dashboard/block-editor-kit'

const resultRow = css`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem 0.5rem;
  border-radius: 6px;
  width: 100%;
  border: 0;
  background: none;
  font: inherit;
  text-align: left;
  color: var(--grey-4);
  transition: background 120ms ease;
  &:hover {
    background: var(--accent-bg-strong);
  }
  img {
    width: 36px;
    height: 36px;
    object-fit: cover;
    flex-shrink: 0;
    background: var(--accent-bg-strong);
  }
`

const rowText = css`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  font-size: 0.82rem;
  line-height: 1.35;
  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  span + span {
    color: var(--grey-3);
    font-size: 0.75rem;
  }
`

function TrackSearch({ onAdd, disabled }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('song')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    clearTimeout(timer.current)
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return undefined
    }
    timer.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await authedFetch(`/api/music/search?${new URLSearchParams({ q, type })}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Search failed')
        setResults(data.results || [])
      } catch (err) {
        setError(err.message)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer.current)
  }, [query, type])

  return (
    <div>
      <div css={css`display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;`}>
        <DsInput
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={type === 'song' ? 'Search a song or artist…' : 'Search an album or EP…'}
          aria-label="Search music"
          disabled={disabled}
          css={css`flex: 1; min-width: 200px;`}
        />
        <Segmented
          label="What to search"
          value={type}
          onChange={setType}
          options={[
            { value: 'song', label: 'Songs' },
            { value: 'album', label: 'Albums' },
          ]}
        />
      </div>
      {loading ? <p css={[helpText, css`margin-top: 0.5rem;`]}>Searching…</p> : null}
      {error ? <p css={[helpText, css`margin-top: 0.5rem; color: #dc2626;`]}>{error}</p> : null}
      {results.length ? (
        <div css={css`margin-top: 0.5rem; display: flex; flex-direction: column; max-height: 320px; overflow-y: auto;`} data-lenis-prevent>
          {results.map((result, index) => (
            <button
              key={`${result.appleUrl}-${index}`}
              type="button"
              css={resultRow}
              onClick={() => {
                onAdd({ ...result, id: shortId() })
                setQuery('')
                setResults([])
              }}
            >
              <img src={result.image || ''} alt="" />
              <span css={rowText}>
                <span>{result.title}</span>
                <span>
                  {result.author}
                  {result.album ? ` · ${result.album}` : ''} · {trackTypeLabel(result)}
                </span>
              </span>
              <span css={css`font-size: 0.75rem; color: var(--accent-foreground);`}>Add</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const SPOTIFY_ERRORS = {
  denied: 'You chose not to allow access on Spotify.',
  expired: 'That took too long. Please try connecting again.',
  redirect: 'Spotify refused the sign-in. Check that the Redirect URI in your Spotify app matches the one below exactly.',
  spotify: 'Spotify didn’t finish the connection. Check the steps below and try again.',
}

function SpotifyPanel({ username }) {
  const router = useRouter()
  const [status, setStatus] = useState(null)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const load = useCallback(async () => {
    const response = await authedFetch('/api/integrations/spotify/status')
    if (response.ok) {
      const data = await response.json()
      setStatus(data)
      if (data.clientId) setClientId(current => current || data.clientId)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Back from Spotify's consent screen.
  useEffect(() => {
    const result = router.query.spotify
    if (!result) return
    if (result === 'connected') setMessage({ type: 'success', text: 'Spotify is connected. Your profile now shows what you’re listening to.' })
    else setMessage({ type: 'error', text: SPOTIFY_ERRORS[router.query.reason] || SPOTIFY_ERRORS.spotify })
    router.replace('/dashboard/settings/music', undefined, { shallow: true })
  }, [router.query.spotify]) // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const response = await authedFetch('/api/integrations/spotify/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      })
      const data = await response.json()
      if (!response.ok || !data.authorizeUrl) throw new Error(data.error || 'Could not connect Spotify')
      window.location.assign(data.authorizeUrl)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    await authedFetch('/api/integrations/spotify/status', { method: 'DELETE' })
    setClientSecret('')
    await load()
    setBusy(false)
    setMessage({ type: 'info', text: 'Spotify is disconnected. Your profile shows your list again.' })
  }

  if (!status) return <p css={helpText}>Loading…</p>
  const connected = status.status === 'connected'
  const expired = status.status === 'expired'

  return (
    <div css={css`display: flex; flex-direction: column; gap: 1rem;`}>
      {message ? (
        <p
          role="status"
          css={[
            helpText,
            css`
              padding: 0.6rem 0.8rem;
              border-radius: 6px;
              border: 1px solid ${message.type === 'error' ? 'rgba(220,38,38,0.3)' : message.type === 'success' ? 'var(--green-border)' : 'var(--border)'};
              background: ${message.type === 'error' ? 'rgba(220,38,38,0.08)' : message.type === 'success' ? 'var(--green-soft)' : 'var(--accent-bg)'};
              color: var(--grey-4);
            `,
          ]}
        >
          {message.text}
        </p>
      ) : null}

      {connected || expired ? (
        <DsTile>
          <div css={css`display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;`}>
            <SpotifyIcon width={20} height={20} css={css`color: #1db954;`} />
            <div css={css`flex: 1; min-width: 160px; font-size: 0.85rem; color: var(--grey-4);`}>
              {connected ? (
                <>
                  Connected{status.displayName ? <> as <strong css={css`font-weight: 500;`}>{status.displayName}</strong></> : null}
                </>
              ) : (
                'Spotify needs to be reconnected (it signs you out after six months, or if access was removed).'
              )}
            </div>
            {expired ? (
              <DsButton size="sm" variant="accent" disabled={busy} onClick={connect}>
                Reconnect
              </DsButton>
            ) : null}
            <DsButton size="sm" variant="outline" disabled={busy} onClick={disconnect}>
              Disconnect
            </DsButton>
          </div>
        </DsTile>
      ) : (
        <>
          <ol
            css={[
              helpText,
              css`
                margin: 0;
                padding-left: 1.1rem;
                display: flex;
                flex-direction: column;
                gap: 0.55rem;
              `,
            ]}
          >
            <li>
              Open the <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">Spotify developer dashboard</a>, sign in, and choose <strong>Create app</strong>. Any name and description work, like “My Bublr”. Spotify only runs an app like this if your account has <strong>Premium</strong>.
            </li>
            <li>
              In the same form, add this address under <strong>Redirect URIs</strong>, exactly as it is. If it asks which APIs you’ll use, tick <strong>Web API</strong>. Then save.
              <div css={css`margin-top: 0.4rem;`}>
                <CopyField value={status.redirectUri} />
              </div>
            </li>
            <li>
              In the app’s <strong>User Management</strong>, add the name and email of your own Spotify account.
            </li>
            <li>
              From the app’s <strong>Settings</strong>, copy the Client ID and the Client Secret into the boxes below, then connect.
            </li>
          </ol>
          <div css={css`display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;`}>
            <DsField css={css`margin: 0;`}>
              <DsLabel htmlFor="spotify-client-id">Client ID</DsLabel>
              <DsInput id="spotify-client-id" value={clientId} onChange={event => setClientId(event.target.value)} autoComplete="off" spellCheck={false} placeholder="32 letters and numbers" />
            </DsField>
            <DsField css={css`margin: 0;`}>
              <DsLabel htmlFor="spotify-client-secret" hint={status.hasSecret && status.clientId === clientId.trim() ? 'Saved. Leave empty to keep it.' : null}>
                Client Secret
              </DsLabel>
              <DsInput id="spotify-client-secret" type="password" value={clientSecret} onChange={event => setClientSecret(event.target.value)} autoComplete="off" spellCheck={false} placeholder="Stored encrypted" />
            </DsField>
          </div>
          <div>
            <DsButton variant="accent" disabled={busy || clientId.trim().length !== 32} onClick={connect}>
              <SpotifyIcon width={14} height={14} css={css`margin-right: 0.4rem;`} />
              {busy ? 'Opening Spotify…' : 'Connect Spotify'}
            </DsButton>
          </div>
          <p css={helpText}>
            Your Client Secret and Spotify sign-in are stored encrypted and only used to read what you’re playing. Your profile @{username} shows the song, artist and cover, nothing else.
          </p>
        </>
      )}
    </div>
  )
}

function MusicEditor({ user }) {
  const [music, setMusic] = useState(() => normalizeMusic(user.music))
  const [title, setTitle] = useState(user.musicSectionTitle || '')
  const [previewKey, setPreviewKey] = useState(0)

  const status = useAutosave({ music, title }, value =>
    firestore.collection('users').doc(user.id).update({
      music: normalizeMusic(value.music),
      musicSectionTitle: value.title.trim().slice(0, 40),
    })
  )

  // Spotify preview reads the saved mode, so refresh it after a save.
  useEffect(() => {
    if (status === 'saved') setPreviewKey(k => k + 1)
  }, [status])

  const setTracks = change => setMusic(current => ({ ...current, tracks: change(current.tracks) }))
  const preview = useMemo(() => normalizeMusic(music), [music])

  return (
    <>
      <BlockStyles />
      <DsSection
        title="Music"
        description="Show the music you love on your profile: a list you pick, or what you’re listening to right now on Spotify."
        action={<SaveIndicator status={status} />}
      >
        <div css={css`display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;`}>
          <DsField css={css`flex: 1; min-width: 200px; margin: 0;`}>
            <DsLabel htmlFor="music-title">Section title</DsLabel>
            <DsInput id="music-title" value={title} placeholder="Music" maxLength={40} onChange={event => setTitle(event.target.value)} />
          </DsField>
          <div>
            <DsLabel>What it shows</DsLabel>
            <Segmented
              label="What the music section shows"
              value={music.mode}
              onChange={mode => setMusic(current => ({ ...current, mode }))}
              options={[
                { value: 'list', label: 'My picks' },
                { value: 'spotify', label: 'Live from Spotify' },
              ]}
            />
          </div>
        </div>
      </DsSection>

      {music.mode === 'spotify' ? (
        <DsSection
          title="Spotify"
          description="Adaptive: your profile shows the song you’re playing right now, then what you played last. When nothing is connected it falls back to your picks."
        >
          <SpotifyPanel username={user.name} />
          <div css={css`margin-top: 1rem;`}>
            <DsSwitch
              checked={music.showRecent}
              onChange={showRecent => setMusic(current => ({ ...current, showRecent }))}
              label="Show recently played songs"
            />
          </div>
        </DsSection>
      ) : null}

      <DsSection
        title={music.mode === 'spotify' ? 'Your picks (fallback)' : 'Your picks'}
        description={`Search Apple’s catalogue to add songs and albums with their covers. Songs from the same album are grouped together. Up to ${MAX_TRACKS}.`}
      >
        <TrackSearch disabled={music.tracks.length >= MAX_TRACKS} onAdd={track => setTracks(tracks => [track, ...tracks].slice(0, MAX_TRACKS))} />
        {music.tracks.length ? (
          <DsTray css={css`margin-top: 1rem;`}>
            {music.tracks.map((track, index) => (
              <DsTile key={track.id} css={css`padding: 0.5rem 0.75rem;`}>
                <div css={css`display: flex; align-items: center; gap: 0.75rem;`}>
                  <img src={track.image || ''} alt="" css={css`width: 36px; height: 36px; object-fit: cover; background: var(--accent-bg-strong); flex-shrink: 0;`} />
                  <span css={rowText}>
                    <span>{track.title}</span>
                    <span>
                      {track.author}
                      {track.album && track.type === 'single' ? ` · ${track.album}` : ''} · {trackTypeLabel(track)}
                    </span>
                  </span>
                  <button type="button" css={iconButton} disabled={index === 0} aria-label="Move up" onClick={() => setTracks(t => moveItem(t, index, index - 1))}>↑</button>
                  <button type="button" css={iconButton} disabled={index === music.tracks.length - 1} aria-label="Move down" onClick={() => setTracks(t => moveItem(t, index, index + 1))}>↓</button>
                  <button type="button" css={iconButton} aria-label={`Remove ${track.title}`} onClick={() => setTracks(t => t.filter(x => x.id !== track.id))}>×</button>
                </div>
              </DsTile>
            ))}
          </DsTray>
        ) : (
          <p css={[helpText, css`margin-top: 0.75rem;`]}>Nothing here yet.</p>
        )}
      </DsSection>

      <DsSection
        title="Preview"
        action={user.name ? <DsButton size="sm" variant="outline" href={`/${user.name}#music`} target="_blank" rel="noreferrer">View profile</DsButton> : null}
      >
        <div css={previewFrame}>
          {preview.tracks.length || preview.mode === 'spotify' ? (
            <MusicBlock key={previewKey} music={preview} username={user.name} />
          ) : (
            <p css={helpText}>Add a song and it appears here (and on your profile).</p>
          )}
        </div>
      </DsSection>
    </>
  )
}

function MusicSettings() {
  const { user, loading } = useCurrentUserDoc()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (user) setReady(true)
  }, [user])
  return (
    <BlockSettingsPage title="Music">
      <LoadingContainer isLoading={loading || !ready}>{ready && user ? <MusicEditor user={user} /> : null}</LoadingContainer>
    </BlockSettingsPage>
  )
}

export default withBlockLayout(MusicSettings, 'Music')

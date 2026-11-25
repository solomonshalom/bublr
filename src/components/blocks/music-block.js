/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'

import { buildMusicListItems, normalizeMusic, platformSearchUrl, trackTypeLabel } from '../../lib/music'
import HoverSlideList from './hover-slide-list'
import { EASE, blockTokens, fadeIn } from './tokens'

/**
 * Music block, ported from music-list.tsx and streaming-platform-dialog.tsx
 * on jeremybosma.nl (github.com/jeremybosma/jeremybosma, by Jeremy Bosma):
 * album groups that expand, a sliding hover highlight, album art that tilts
 * on hover, and a "listen on" picker that can remember the choice.
 *
 * Bublr adds an adaptive mode: with Spotify connected, the block shows what
 * the writer is playing right now and what they played last, live.
 */

const PREFERENCE_KEY = 'preferred-music-platform'
const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#e5e5e5"/><circle cx="24" cy="24" r="9" fill="none" stroke="#a3a3a3" stroke-width="2"/><circle cx="24" cy="24" r="2" fill="#a3a3a3"/></svg>'
  )

function readPreference() {
  try {
    return window.localStorage.getItem(PREFERENCE_KEY)
  } catch (_) {
    return null
  }
}

function savePreference(platform) {
  try {
    window.localStorage.setItem(PREFERENCE_KEY, platform)
  } catch (_) {
    // private mode: just don't remember
  }
}

// ------------------------------------------------------------ icons

export const SpotifyIcon = props => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
)

const AppleIcon = props => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M16.365 1.43c0 1.14-.46 2.24-1.2 3.04-.79.86-2.08 1.52-3.12 1.44-.13-1.12.43-2.29 1.16-3.05.8-.84 2.18-1.47 3.16-1.43zM20.5 17.08c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.02-3.05-1.77-4.04-3.33C-.04 15.86-.33 10.8 1.4 8.12c1.23-1.9 3.17-3.01 4.99-3.01 1.86 0 3.03 1.02 4.57 1.02 1.49 0 2.4-1.02 4.55-1.02 1.62 0 3.34.88 4.57 2.41-4.01 2.2-3.36 7.93.42 9.56z" />
  </svg>
)

const YouTubeIcon = props => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
  </svg>
)

const PLATFORMS = [
  { id: 'apple', name: 'Apple Music', Icon: AppleIcon },
  { id: 'spotify', name: 'Spotify', Icon: SpotifyIcon },
  { id: 'youtube', name: 'YouTube', Icon: YouTubeIcon },
]

// ------------------------------------------------------------ rows

const rowStyle = css`
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 14px 16px;
  border-radius: 10px;
  width: 100%;
  text-align: left;
  touch-action: manipulation;
  cursor: pointer;
  margin: 0 -16px;
  width: calc(100% + 32px);
`

function AlbumArt({ src, alt, eager }) {
  return (
    <img
      src={src || PLACEHOLDER}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      width={100}
      height={100}
      onError={event => {
        if (event.currentTarget.src !== PLACEHOLDER) event.currentTarget.src = PLACEHOLDER
      }}
      css={css`
        width: 48px;
        height: 48px;
        flex-shrink: 0;
        object-fit: cover;
        pointer-events: none;
        transition: transform 0.3s ${EASE};
        .hover-slide-item:hover & {
          transform: scale(0.9) rotate(3deg);
        }
        @media (prefers-reduced-motion: reduce) {
          transition: none;
        }
      `}
    />
  )
}

const textCol = css`
  display: flex;
  flex-direction: column;
  min-width: 0;
  pointer-events: none;
  line-height: 1.4;
  h3 {
    font-size: 14px;
    font-weight: 500;
    margin: 0;
    color: inherit;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  p {
    font-size: 13px;
    color: var(--blk-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
  }
`

function TrackCard({ track, eager, onClick, href, animateIn = false, delay = 0, extra = null }) {
  const Tag = href ? 'a' : 'button'
  return (
    <div
      style={animateIn ? { animationDelay: `${delay}ms` } : undefined}
      css={
        animateIn
          ? css`
              opacity: 0;
              animation: ${fadeIn} 0.45s ease-out forwards;
            `
          : undefined
      }
    >
      <Tag
        {...(href ? { href, target: '_blank', rel: 'noreferrer' } : { type: 'button', onClick: () => onClick(track) })}
        className="hover-slide-item"
        css={rowStyle}
        aria-label={`Play ${track.title} by ${track.author}`}
      >
        <AlbumArt src={track.image} alt={`Album art for ${track.title} by ${track.author}`} eager={eager} />
        <div css={textCol}>
          <h3 className="hover-slide-title">{track.title}</h3>
          <p className="hover-slide-muted">{track.author}</p>
          <p className="hover-slide-muted">{extra || (track.unreleased ? `Unreleased ${trackTypeLabel(track)}` : trackTypeLabel(track))}</p>
        </div>
      </Tag>
    </div>
  )
}

function AlbumGroupCard({ group, isExpanded, eager, onToggle }) {
  return (
    <button
      type="button"
      aria-expanded={isExpanded}
      onClick={onToggle}
      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${group.album} by ${group.author}, ${group.tracks.length} tracks`}
      className={`hover-slide-item${isExpanded ? ' hover-slide-item--pinned' : ''}`}
      css={[
        rowStyle,
        css`
          cursor: zoom-in;
          box-shadow: ${isExpanded ? '0 0 0 2px var(--blk-bg), 0 0 0 4px var(--blk-ring)' : 'none'};
          transition: box-shadow 0.24s ${EASE}, transform 0.12s ${EASE};
        `,
      ]}
    >
      <AlbumArt src={group.image} alt={`Album art for ${group.album} by ${group.author}`} eager={eager} />
      <div css={textCol}>
        <h3 className="hover-slide-title">
          {group.album}
          <span css={css`color: var(--blk-muted); font-weight: 400;`}>{` (${group.tracks.length})`}</span>
        </h3>
        <p className="hover-slide-muted">{group.author}</p>
        <p className="hover-slide-muted">Album</p>
      </div>
    </button>
  )
}

// ------------------------------------------------------------ "listen on" picker

export function StreamingPlatformDialog({ isOpen, onClose, onSelect, track }) {
  const [remember, setRemember] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!isOpen) return undefined
    const onKey = event => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [isOpen, onClose])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && track ? (
        <motion.div
          key="dialog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          data-lenis-prevent
          css={[
            blockTokens,
            css`
              position: fixed;
              inset: 0;
              z-index: 1000;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 16px;
              font-family: Inter, sans-serif;
              color: var(--blk-fg);
            `,
          ]}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            css={css`
              position: absolute;
              inset: 0;
              background: rgba(0, 0, 0, 0.6);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
            `}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Listen to ${track.title}`}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={event => event.stopPropagation()}
            css={css`
              position: relative;
              z-index: 10;
              width: 100%;
              max-width: 384px;
              padding: 24px;
              background: var(--blk-bg);
            `}
          >
            <div css={css`display: flex; gap: 16px; align-items: center; margin-bottom: 24px;`}>
              {track.image ? (
                <img src={track.image} alt="" width={56} height={56} css={css`width: 56px; height: 56px; object-fit: cover;`} />
              ) : null}
              <div css={css`flex: 1; min-width: 0;`}>
                <h3 css={css`font-weight: 500; font-size: 15px; margin: 0; color: var(--blk-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`}>
                  {track.title}
                </h3>
                <p css={css`font-size: 13px; color: var(--blk-muted); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`}>
                  {track.author}
                </p>
              </div>
            </div>

            <div css={css`display: flex; flex-direction: column; gap: 4px;`}>
              {PLATFORMS.map(({ id, name, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelect(id, remember)}
                  css={css`
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 0;
                    border: 0;
                    background: none;
                    font: inherit;
                    font-size: 15px;
                    font-weight: 500;
                    color: var(--blk-muted);
                    transition: color 0.18s ${EASE};
                    &:hover,
                    &:focus-visible {
                      color: var(--blk-fg);
                      outline: none;
                    }
                  `}
                >
                  <Icon width={20} height={20} />
                  {name}
                </button>
              ))}
            </div>

            <div css={css`height: 1px; background: var(--blk-border); margin: 16px 0;`} />

            <label css={css`display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--blk-muted); cursor: pointer;`}>
              <input
                type="checkbox"
                checked={remember}
                onChange={event => setRemember(event.target.checked)}
                css={css`width: 16px; height: 16px; accent-color: var(--blk-fg); margin: 0;`}
              />
              Remember my preference
            </label>

            <button
              type="button"
              onClick={onClose}
              css={css`
                width: 100%;
                margin-top: 16px;
                padding: 8px 0;
                border: 0;
                background: none;
                font: inherit;
                font-size: 13px;
                color: var(--blk-muted);
                transition: color 0.18s ${EASE};
                &:hover {
                  color: var(--blk-fg);
                }
              `}
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}

// ------------------------------------------------------------ list mode

function MusicList({ tracks }) {
  const items = useMemo(() => buildMusicListItems(tracks), [tracks])
  const [selected, setSelected] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [expanded, setExpanded] = useState(() => new Set())

  const openInPlatform = useCallback((track, platform) => {
    const fallback = platform === 'apple' && track.appleUrl ? track.appleUrl : platformSearchUrl(platform, track)
    const win = window.open(fallback, '_blank')
    // Swap the search page for the exact song when song.link knows it.
    if (track.appleUrl && platform !== 'apple' && win) {
      fetch(`/api/music/streaming-url?${new URLSearchParams({ apple: track.appleUrl, platform })}`)
        .then(response => response.json())
        .then(data => {
          if (data?.url) win.location.href = data.url
        })
        .catch(() => {})
    }
  }, [])

  const handleTrackClick = useCallback(
    track => {
      if (track.unreleased) {
        openInPlatform(track, 'youtube')
        return
      }
      const saved = readPreference()
      if (saved && PLATFORMS.some(p => p.id === saved)) {
        openInPlatform(track, saved)
      } else {
        setSelected(track)
        setDialogOpen(true)
      }
    },
    [openInPlatform]
  )

  const handleSelect = (platform, remember) => {
    if (remember) savePreference(platform)
    if (selected) openInPlatform(selected, platform)
    setDialogOpen(false)
    setSelected(null)
  }

  const toggleGroup = useCallback(key => {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'Escape') setExpanded(current => (current.size > 0 ? new Set() : current))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const closeDialog = useCallback(() => {
    setDialogOpen(false)
    setSelected(null)
  }, [])

  return (
    <>
      <HoverSlideList css={css`display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px;`}>
        {items.map((item, index) => (
          <Fragment key={item.key}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: Math.min(index, 20) * 0.03 }}
            >
              {item.kind === 'album-group' ? (
                <AlbumGroupCard group={item} isExpanded={expanded.has(item.key)} eager={index < 10} onToggle={() => toggleGroup(item.key)} />
              ) : (
                <TrackCard track={item.track} eager={index < 10} onClick={handleTrackClick} />
              )}
            </motion.div>
            {item.kind === 'album-group' && expanded.has(item.key)
              ? item.tracks.map((track, trackIndex) => (
                  <TrackCard
                    key={`${item.key}:${track.id}`}
                    track={track}
                    onClick={handleTrackClick}
                    animateIn
                    delay={Math.min(trackIndex, 12) * 25}
                  />
                ))
              : null}
          </Fragment>
        ))}
      </HoverSlideList>
      <StreamingPlatformDialog isOpen={dialogOpen} onClose={closeDialog} onSelect={handleSelect} track={selected} />
    </>
  )
}

// ------------------------------------------------------------ adaptive (Spotify) mode

const bar = keyframes`
  0%, 100% { transform: scaleY(0.35); }
  50% { transform: scaleY(1); }
`

function Equalizer({ playing }) {
  return (
    <span
      aria-hidden="true"
      css={css`
        display: inline-flex;
        align-items: flex-end;
        gap: 2px;
        height: 10px;
        margin-right: 6px;
        span {
          width: 2px;
          height: 100%;
          border-radius: 1px;
          background: #1db954;
          transform-origin: bottom;
          transform: scaleY(0.35);
          animation: ${bar} 0.9s ease-in-out infinite;
          animation-play-state: ${playing ? 'running' : 'paused'};
        }
        span:nth-of-type(2) { animation-delay: -0.3s; }
        span:nth-of-type(3) { animation-delay: -0.6s; }
        @media (prefers-reduced-motion: reduce) {
          span { animation: none; transform: scaleY(0.7); }
        }
      `}
    >
      <span />
      <span />
      <span />
    </span>
  )
}

function useProgress(nowPlaying) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!nowPlaying?.isPlaying) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [nowPlaying])
  if (!nowPlaying?.durationMs || nowPlaying.progressMs == null) return null
  const elapsed = nowPlaying.isPlaying ? now - (nowPlaying.receivedAt || now) : 0
  return Math.min(1, (nowPlaying.progressMs + elapsed) / nowPlaying.durationMs)
}

function NowPlayingCard({ track, label, playing }) {
  const progress = useProgress(playing ? track : null)
  return (
    <a
      href={track.url || undefined}
      target="_blank"
      rel="noreferrer"
      className="hover-slide-item"
      aria-label={`${label}: ${track.title} by ${track.author}`}
      css={[rowStyle, css`flex-direction: column; align-items: stretch; gap: 12px;`]}
    >
      <div css={css`display: flex; gap: 16px; align-items: center;`}>
        <AlbumArt src={track.image} alt={`Album art for ${track.title}`} eager />
        <div css={textCol}>
          <p className="hover-slide-muted" css={css`display: flex; align-items: center; font-size: 12px !important;`}>
            {playing ? <Equalizer playing={track.isPlaying} /> : <SpotifyIcon width={12} height={12} css={css`margin-right: 6px; color: #1db954;`} />}
            {label}
          </p>
          <h3 className="hover-slide-title">{track.title}</h3>
          <p className="hover-slide-muted">{track.author}</p>
        </div>
      </div>
      {progress != null ? (
        <div css={css`height: 2px; border-radius: 1px; background: var(--blk-secondary-strong); overflow: hidden;`}>
          <div
            style={{ transform: `scaleX(${progress})` }}
            css={css`
              height: 100%;
              background: var(--blk-fg);
              opacity: 0.55;
              transform-origin: left;
              transition: transform 1s linear;
            `}
          />
        </div>
      ) : null}
    </a>
  )
}

function SpotifyListening({ username, fallbackTracks, showRecent }) {
  const [data, setData] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(`/api/music/now-playing?user=${encodeURIComponent(username)}`)
        const json = await response.json()
        if (cancelled) return
        if (json?.nowPlaying) json.nowPlaying.receivedAt = Date.now()
        setData(json)
      } catch (_) {
        if (!cancelled) setData(current => current || { connected: false })
      }
    }
    const schedule = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        if (document.visibilityState === 'visible') await load()
        schedule()
      }, 30000)
    }
    load().then(schedule)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [username])

  if (!data) {
    return (
      <div aria-hidden="true" css={css`display: flex; gap: 16px; align-items: center; padding: 14px 0;`}>
        <div css={css`width: 48px; height: 48px; background: var(--blk-secondary-strong);`} />
        <div css={css`flex: 1; display: flex; flex-direction: column; gap: 6px;`}>
          <div css={css`height: 10px; width: 40%; border-radius: 3px; background: var(--blk-secondary-strong);`} />
          <div css={css`height: 10px; width: 60%; border-radius: 3px; background: var(--blk-secondary);`} />
        </div>
      </div>
    )
  }

  // Not connected (or Spotify asked to be reconnected): show the writer's list.
  if (!data.connected) {
    return fallbackTracks.length ? <MusicList tracks={fallbackTracks} /> : null
  }

  const recent = showRecent ? data.recent || [] : []
  const lead = data.nowPlaying || recent[0] || null
  const rest = data.nowPlaying ? recent : recent.slice(1)
  if (!lead) return fallbackTracks.length ? <MusicList tracks={fallbackTracks} /> : null

  return (
    <HoverSlideList css={css`display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px;`}>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}>
        <NowPlayingCard
          key={lead.id || lead.title}
          track={lead}
          playing={Boolean(data.nowPlaying)}
          label={data.nowPlaying ? (data.nowPlaying.isPlaying ? 'Listening now' : 'Paused') : 'Last played'}
        />
      </motion.div>
      {rest.slice(0, 8).map((track, index) => (
        <motion.div
          key={`${track.id}-${track.playedAt}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: Math.min(index + 1, 12) * 0.03 }}
        >
          <TrackCard track={track} href={track.url} extra={relativeTime(track.playedAt)} />
        </motion.div>
      ))}
    </HoverSlideList>
  )
}

function relativeTime(iso) {
  if (!iso) return 'Recently played'
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

export default function MusicBlock({ music, username }) {
  const { mode, tracks, showRecent } = useMemo(() => normalizeMusic(music), [music])
  return (
    <div css={[blockTokens, css`margin-top: 8px;`]}>
      {mode === 'spotify' ? (
        <SpotifyListening username={username} fallbackTracks={tracks} showRecent={showRecent} />
      ) : (
        <MusicList tracks={tracks} />
      )}
    </div>
  )
}

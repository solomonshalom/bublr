/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'

import { normalizeGallery, pickPreviewIndices } from '../../lib/gallery'
import { EASE, blockTokens, fadeIn, runViewTransition, supportsViewTransition, vtName } from './tokens'

/**
 * Gallery block, ported from gallery-page.tsx on jeremybosma.nl
 * (github.com/jeremybosma/jeremybosma, by Jeremy Bosma).
 *
 * Albums are fanned stacks (three photos behind a cover). Tapping one morphs
 * its three photos into a 9:16 grid of the whole album; tapping a photo grows
 * it into a lightbox. Both moves are view transitions where the browser has
 * them, and plain state changes where it doesn't.
 */

const isVideo = item => item.type === 'video'
const posterSrc = (item, fallbackCover) => (isVideo(item) ? item.poster || fallbackCover || item.src : item.src)

// Fanned positions of the three preview photos (left, right, top) and how
// they spread on hover.
const PREVIEW_SLOTS = [
  css`
    left: 8%;
    top: 50%;
    transform: translateY(-50%) rotate(-10deg);
    .blk-fan:hover & {
      transform: translateY(-50%) translateX(-8px) rotate(-16deg);
    }
  `,
  css`
    right: 8%;
    top: 50%;
    transform: translateY(-50%) rotate(10deg);
    .blk-fan:hover & {
      transform: translateY(-50%) translateX(8px) rotate(16deg);
    }
  `,
  css`
    left: 50%;
    top: 10%;
    transform: translateX(-50%) rotate(-4deg);
    .blk-fan:hover & {
      transform: translateX(-50%) translateY(-8px) rotate(-10deg);
    }
  `,
]

const gridStyle = css`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  @container blk (min-width: 420px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  @container blk (min-width: 640px) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
`

function StoryVideo({ src, paused }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (paused) {
      el.pause()
      el.muted = true
      return undefined
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.muted = true
          el.play().catch(() => {})
        } else {
          el.pause()
        }
      },
      { threshold: 0.45 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [paused])

  return (
    <video
      ref={ref}
      src={src}
      css={css`
        pointer-events: none;
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      `}
      playsInline
      loop
      muted
      preload="metadata"
      tabIndex={-1}
      aria-hidden="true"
    />
  )
}

function LightboxVideo({ src, canPlay }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!canPlay) {
      el.pause()
      el.muted = true
      return
    }
    el.muted = false
    el.play().catch(() => {
      el.muted = true
      el.play().catch(() => {})
    })
  }, [src, canPlay])
  useEffect(() => () => ref.current?.pause(), [])

  return (
    <video
      ref={ref}
      src={src}
      css={css`
        max-height: 85dvh;
        max-width: 90vw;
        width: auto;
        object-fit: contain;
        transition: opacity 0.2s;
        opacity: ${canPlay ? 1 : 0};
        display: block;
      `}
      playsInline
      loop
      muted
    />
  )
}

function Poster({ src, alt, transitionName, contain = false, extraCss }) {
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      style={transitionName ? { viewTransitionName: transitionName } : undefined}
      css={[
        contain
          ? css`
              max-height: 85dvh;
              max-width: 90vw;
              width: auto;
              object-fit: contain;
              display: block;
            `
          : css`
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
            `,
        extraCss,
      ]}
    />
  )
}

function MediaCell({ item, albumId, index, globalIndex, lightboxOpen, lightboxSourceKey, vtFromIndex, onOpen, morph, fallbackCover }) {
  const cellKey = `${albumId}:${index}`
  const isSource = lightboxOpen && lightboxSourceKey === cellKey
  // The source tile gives up "gallery-photo" before the lightbox takes it:
  // two elements with one name abort the morph.
  const photoVt = isSource ? 'none' : vtFromIndex === globalIndex ? 'gallery-photo' : undefined

  return (
    <button
      type="button"
      onClick={event => {
        event.stopPropagation()
        onOpen(item, globalIndex, cellKey)
      }}
      aria-label={`View ${item.alt || 'photo'} fullscreen`}
      css={css`
        display: block;
        width: 100%;
        padding: 0;
        border: 0;
        background: none;
        cursor: zoom-in;
        text-align: left;
      `}
    >
      <div
        style={morph && !lightboxOpen ? { viewTransitionName: vtName('gallery-item', `${albumId}-${index}`) } : undefined}
        css={css`
          position: relative;
          width: 100%;
          aspect-ratio: 9 / 16;
          overflow: hidden;
          border-radius: 6px;
          background: var(--blk-secondary-strong);
        `}
      >
        <Poster src={posterSrc(item, fallbackCover)} alt={item.alt || ''} transitionName={photoVt} extraCss={isVideo(item) ? css`position: relative; z-index: 1;` : undefined} />
        {isVideo(item) ? <StoryVideo src={item.src} paused={lightboxOpen} /> : null}
      </div>
    </button>
  )
}

function AlbumCard({ album, isActive, previewIndices, lightboxOpen, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isActive}
      className="blk-fan"
      css={css`
        position: relative;
        margin: 0 auto;
        display: flex;
        width: 100%;
        max-width: 220px;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 0 0 6px;
        border: 0;
        background: none;
        border-radius: 12px;
        outline: none;
        color: inherit;
        font: inherit;
        transition: box-shadow 0.3s ${EASE};
        box-shadow: ${isActive ? '0 0 0 2px var(--blk-bg), 0 0 0 4px var(--blk-ring)' : 'none'};
        &:focus-visible {
          box-shadow: 0 0 0 2px var(--blk-bg), 0 0 0 4px var(--blk-muted);
        }
      `}
    >
      <div
        css={css`
          position: relative;
          height: 200px;
          width: 100%;
          pointer-events: none;
        `}
      >
        {!isActive
          ? previewIndices.map((itemIndex, slot) => {
              const item = album.items[itemIndex]
              if (!item || !PREVIEW_SLOTS[slot]) return null
              return (
                <div
                  key={item.id}
                  style={lightboxOpen ? undefined : { viewTransitionName: vtName('gallery-item', `${album.id}-${itemIndex}`) }}
                  css={[
                    css`
                      position: absolute;
                      width: 38%;
                      aspect-ratio: 9 / 16;
                      overflow: hidden;
                      border-radius: 8px;
                      background: var(--blk-secondary-strong);
                      box-shadow: var(--blk-shadow);
                      transition: transform 0.3s ease-out;
                      @media (prefers-reduced-motion: reduce) {
                        transition: none;
                      }
                    `,
                    PREVIEW_SLOTS[slot],
                  ]}
                >
                  <img
                    src={posterSrc(item, album.cover)}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    css={css`
                      pointer-events: none;
                      width: 100%;
                      height: 100%;
                      object-fit: cover;
                      display: block;
                    `}
                  />
                </div>
              )
            })
          : null}
        <div
          style={lightboxOpen ? undefined : { viewTransitionName: vtName('gallery-cover', album.id) }}
          css={css`
            position: absolute;
            left: 50%;
            top: 50%;
            z-index: 10;
            width: 88px;
            height: 88px;
            transform: translate(-50%, -50%);
            overflow: hidden;
            border-radius: 16px;
            border: 2px solid var(--blk-bg);
            background: var(--blk-secondary-strong);
            box-shadow: var(--blk-shadow), 0 0 0 1px var(--blk-border);
            transition: transform 0.3s ${EASE};
            .blk-fan:hover & {
              transform: translate(-50%, -50%) scale(1.03);
            }
          `}
        >
          {album.cover ? (
            <img
              src={album.cover}
              alt=""
              width={88}
              height={88}
              css={css`
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
              `}
            />
          ) : null}
        </div>
      </div>
      <span
        css={css`
          font-size: 12px;
          line-height: 1.25;
          color: var(--blk-muted);
          transition: color 0.18s ${EASE};
          .blk-fan:hover & {
            color: var(--blk-fg);
          }
        `}
      >
        {album.title || ' '}
      </span>
    </button>
  )
}

export default function GalleryBlock({ gallery }) {
  const { layout, albums } = useMemo(() => normalizeGallery(gallery), [gallery])
  const flat = layout === 'grid'
  const flatItems = useMemo(
    () => (flat ? albums.flatMap(album => album.items.map(item => ({ item, album }))) : []),
    [albums, flat]
  )

  const [selected, setSelected] = useState(null)
  const [lightboxSourceKey, setLightboxSourceKey] = useState(null)
  const [lightboxFromIndex, setLightboxFromIndex] = useState(null)
  const [vtFromIndex, setVtFromIndex] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [canPlay, setCanPlay] = useState(false)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => setPortalReady(true), [])

  const previewIndices = useMemo(() => {
    const map = new Map()
    for (const album of albums) map.set(album.id, pickPreviewIndices(album.items, album.id))
    return map
  }, [albums])

  const expanded = albums.find(album => album.id === expandedId) || null
  const expandedOffset = useMemo(() => {
    if (!expanded) return 0
    let offset = 0
    for (const album of albums) {
      if (album.id === expanded.id) return offset
      offset += album.items.length
    }
    return 0
  }, [albums, expanded])

  const toggleAlbum = useCallback(
    albumId => {
      const next = expandedId === albumId ? null : albumId
      runViewTransition(() => flushSync(() => setExpandedId(next)), { htmlClass: 'gallery-expand-vt' })
    },
    [expandedId]
  )

  const openLightbox = useCallback((item, index, cellKey) => {
    const enablePlayback = () => {
      if (isVideo(item)) setCanPlay(true)
    }
    if (supportsViewTransition()) {
      flushSync(() => {
        setCanPlay(false)
        setVtFromIndex(index)
        setLightboxFromIndex(index)
      })
      runViewTransition(
        () =>
          flushSync(() => {
            setSelected(item)
            setLightboxSourceKey(cellKey)
            setVtFromIndex(null)
          }),
        { htmlClass: 'gallery-lightbox-vt', waitForPaint: true, onReady: enablePlayback }
      )
    } else {
      setLightboxSourceKey(cellKey)
      setLightboxFromIndex(index)
      setSelected(item)
      enablePlayback()
    }
  }, [])

  const closeLightbox = useCallback(() => {
    if (!selected || lightboxFromIndex === null) return
    const returnIndex = lightboxFromIndex
    if (supportsViewTransition()) {
      flushSync(() => setCanPlay(false))
      runViewTransition(
        () =>
          flushSync(() => {
            setSelected(null)
            setLightboxSourceKey(null)
            setVtFromIndex(returnIndex)
          }),
        {
          htmlClass: 'gallery-lightbox-vt',
          onFinished: () => {
            setVtFromIndex(null)
            setLightboxFromIndex(null)
            setCanPlay(false)
          },
        }
      )
    } else {
      setCanPlay(false)
      setSelected(null)
      setLightboxSourceKey(null)
      setLightboxFromIndex(null)
    }
  }, [selected, lightboxFromIndex])

  useEffect(() => {
    const onKey = event => {
      if (event.key !== 'Escape') return
      if (selected) {
        closeLightbox()
        return
      }
      if (expandedId) {
        runViewTransition(() => flushSync(() => setExpandedId(null)), { htmlClass: 'gallery-expand-vt' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeLightbox, selected, expandedId])

  // Lock page scroll while the lightbox is open.
  useEffect(() => {
    if (!selected) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [selected])

  if (albums.length === 0) return null
  const lightboxOpen = selected !== null
  const sourceAlbumCover = lightboxSourceKey
    ? albums.find(album => album.id === lightboxSourceKey.split(':')[0])?.cover
    : undefined

  const lightbox =
    selected && portalReady ? (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={selected.alt || 'Photo'}
        onClick={closeLightbox}
        data-lenis-prevent
        css={css`
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: zoom-out;
        `}
      >
        <div
          aria-hidden="true"
          style={{ viewTransitionName: 'gallery-scrim' }}
          css={css`
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.75);
            animation: ${supportsViewTransition() ? 'none' : `${fadeIn} 0.28s ease-out both`};
          `}
        />
        <div
          role="presentation"
          onClick={event => {
            event.stopPropagation()
            closeLightbox()
          }}
          css={css`
            position: relative;
            z-index: 10;
            padding: 16px;
          `}
        >
          <div
            css={css`
              position: relative;
              max-height: 85dvh;
              max-width: 90vw;
              cursor: zoom-out;
            `}
          >
            {isVideo(selected) ? (
              <>
                <Poster
                  src={posterSrc(selected, sourceAlbumCover)}
                  alt={selected.alt || ''}
                  contain
                  transitionName="gallery-photo"
                  extraCss={
                    canPlay
                      ? css`
                          pointer-events: none;
                          position: absolute;
                          inset: 0;
                          margin: auto;
                          opacity: 0;
                          transition: opacity 0.2s;
                        `
                      : undefined
                  }
                />
                <LightboxVideo src={selected.src} canPlay={canPlay} />
              </>
            ) : (
              <Poster src={selected.src} alt={selected.alt || ''} contain transitionName="gallery-photo" />
            )}
          </div>
        </div>
      </div>
    ) : null

  return (
    <div
      css={[
        blockTokens,
        css`
          container-type: inline-size;
          container-name: blk;
          display: flex;
          flex-direction: column;
          gap: 32px;
          margin-top: 16px;
        `,
      ]}
    >
      {flat ? (
        <div css={gridStyle}>
          {flatItems.map(({ item, album }, index) => (
            <MediaCell
              key={`${album.id}-${item.id}`}
              item={item}
              albumId="all"
              index={index}
              globalIndex={index}
              lightboxOpen={lightboxOpen}
              lightboxSourceKey={lightboxSourceKey}
              vtFromIndex={vtFromIndex}
              onOpen={openLightbox}
              fallbackCover={album.cover}
            />
          ))}
        </div>
      ) : (
        <>
          <div
            css={css`
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              column-gap: 16px;
              row-gap: 32px;
              @container blk (min-width: 640px) {
                grid-template-columns: repeat(3, minmax(0, 1fr));
              }
            `}
          >
            {albums.map(album => (
              <AlbumCard
                key={album.id}
                album={album}
                isActive={expandedId === album.id}
                previewIndices={previewIndices.get(album.id) || []}
                lightboxOpen={lightboxOpen}
                onToggle={() => toggleAlbum(album.id)}
              />
            ))}
          </div>

          {expanded ? (
            <div css={gridStyle}>
              {expanded.items.map((item, index) => {
                const preview = (previewIndices.get(expanded.id) || []).includes(index)
                return (
                  <div
                    key={`${expanded.id}-${item.id}`}
                    style={preview ? undefined : { animationDelay: `${Math.min(index, 12) * 25}ms` }}
                    css={
                      preview
                        ? undefined
                        : css`
                            opacity: 0;
                            animation: ${fadeIn} 0.45s ease-out forwards;
                            @media (prefers-reduced-motion: reduce) {
                              animation-duration: 0s;
                            }
                          `
                    }
                  >
                    <MediaCell
                      item={item}
                      albumId={expanded.id}
                      index={index}
                      globalIndex={expandedOffset + index}
                      lightboxOpen={lightboxOpen}
                      lightboxSourceKey={lightboxSourceKey}
                      vtFromIndex={vtFromIndex}
                      onOpen={openLightbox}
                      morph={preview}
                      fallbackCover={expanded.cover}
                    />
                  </div>
                )
              })}
            </div>
          ) : null}
        </>
      )}

      {portalReady && lightbox ? createPortal(lightbox, document.body) : null}
    </div>
  )
}

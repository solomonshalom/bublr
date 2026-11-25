/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useEffect, useMemo, useState } from 'react'

import { firestore } from '../../../lib/firebase'
import { MAX_ALBUMS, MAX_ITEMS_PER_ALBUM, cloudinaryPoster, normalizeGallery } from '../../../lib/gallery'
import { DsSection, DsTray, DsTile } from '../../../components/dashboard/ds-section'
import { DsInput, DsLabel, DsField } from '../../../components/dashboard/ds-input'
import DsButton from '../../../components/dashboard/ds-button'
import GalleryBlock from '../../../components/blocks/gallery-block'
import { BlockStyles } from '../../../components/blocks/tokens'
import {
  BlockSettingsPage,
  LoadingContainer,
  SaveIndicator,
  Segmented,
  UploadButton,
  helpText,
  iconButton,
  moveItem,
  previewFrame,
  shortId,
  useAutosave,
  useCurrentUserDoc,
  withBlockLayout,
} from '../../../components/dashboard/block-editor-kit'

const thumbGrid = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 0.5rem;
  margin-top: 0.75rem;
`

function Thumb({ item, isCover, onCover, onRemove, onLeft, onRight, onAlt, first, last }) {
  const still = item.type === 'video' ? item.poster || cloudinaryPoster(item.src) : item.src
  return (
    <div css={css`display: flex; flex-direction: column; gap: 0.3rem;`}>
      <div
        css={css`
          position: relative;
          aspect-ratio: 9 / 16;
          border-radius: 6px;
          overflow: hidden;
          background: var(--accent-bg-strong);
          border: 1px solid ${isCover ? 'var(--accent-border)' : 'var(--border)'};
          box-shadow: ${isCover ? '0 0 0 2px var(--accent-soft-strong)' : 'none'};
          &:hover .thumb-actions {
            opacity: 1;
          }
        `}
      >
        {still ? <img src={still} alt={item.alt || ''} css={css`width: 100%; height: 100%; object-fit: cover; display: block;`} /> : null}
        {item.type === 'video' ? (
          <span css={css`position: absolute; left: 4px; bottom: 4px; font-size: 0.6rem; padding: 1px 4px; border-radius: 3px; background: rgba(0,0,0,0.6); color: #fff;`}>VIDEO</span>
        ) : null}
        {isCover ? (
          <span css={css`position: absolute; left: 4px; top: 4px; font-size: 0.6rem; padding: 1px 4px; border-radius: 3px; background: var(--accent); color: #fff; [data-theme='dark'] & { color: #15162e; }`}>COVER</span>
        ) : null}
        <div
          className="thumb-actions"
          css={css`
            position: absolute;
            inset: auto 4px 4px auto;
            display: flex;
            gap: 3px;
            opacity: 0;
            transition: opacity 120ms ease;
            @media (hover: none) {
              opacity: 1;
            }
            button {
              width: 22px;
              height: 22px;
            }
          `}
        >
          <button type="button" css={iconButton} onClick={onLeft} disabled={first} aria-label="Move earlier">‹</button>
          <button type="button" css={iconButton} onClick={onRight} disabled={last} aria-label="Move later">›</button>
          <button type="button" css={iconButton} onClick={onRemove} aria-label="Remove">×</button>
        </div>
      </div>
      <input
        value={item.alt || ''}
        onChange={event => onAlt(event.target.value)}
        placeholder="Caption"
        maxLength={140}
        aria-label="Caption"
        css={css`
          width: 100%;
          font: inherit;
          font-size: 0.7rem;
          padding: 0.2rem 0.35rem;
          border-radius: 4px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--grey-4);
          &:hover,
          &:focus {
            border-color: var(--border);
            outline: none;
          }
        `}
      />
      {!isCover && item.type === 'image' ? (
        <button type="button" onClick={onCover} css={css`border: 0; background: none; font: inherit; font-size: 0.68rem; color: var(--grey-3); text-align: left; padding: 0 0.35rem; &:hover { color: var(--accent-foreground); }`}>
          Use as cover
        </button>
      ) : null}
    </div>
  )
}

function GalleryEditor({ user }) {
  const [gallery, setGallery] = useState(() => normalizeGallery(user.gallery))
  const [title, setTitle] = useState(user.gallerySectionTitle || '')

  const status = useAutosave({ gallery, title }, value =>
    firestore.collection('users').doc(user.id).update({
      gallery: normalizeGallery(value.gallery),
      gallerySectionTitle: value.title.trim().slice(0, 40),
    })
  )

  const updateAlbum = (albumId, change) =>
    setGallery(current => ({
      ...current,
      albums: current.albums.map(album => (album.id === albumId ? { ...album, ...change(album) } : album)),
    }))

  const addAlbum = uploads =>
    setGallery(current => ({
      ...current,
      albums: [
        ...current.albums,
        {
          id: shortId(),
          title: '',
          cover: uploads.find(u => u.type === 'image')?.url || null,
          items: uploads.slice(0, MAX_ITEMS_PER_ALBUM).map(u => ({ id: shortId(), src: u.url, alt: '', type: u.type, poster: u.type === 'video' ? cloudinaryPoster(u.url) : null })),
        },
      ],
    }))

  const preview = useMemo(() => normalizeGallery(gallery), [gallery])

  return (
    <>
      <BlockStyles />
      <DsSection
        title="Gallery"
        description="Photo albums on your profile, shown as little fanned stacks that open into a grid. Tap any photo to see it big."
        action={<SaveIndicator status={status} />}
      >
        <div css={css`display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;`}>
          <DsField css={css`flex: 1; min-width: 200px; margin: 0;`}>
            <DsLabel htmlFor="gallery-title">Section title</DsLabel>
            <DsInput id="gallery-title" value={title} placeholder="Gallery" maxLength={40} onChange={event => setTitle(event.target.value)} />
          </DsField>
          <div>
            <DsLabel>Layout</DsLabel>
            <Segmented
              label="Layout"
              value={gallery.layout}
              onChange={layout => setGallery(current => ({ ...current, layout }))}
              options={[
                { value: 'albums', label: 'Albums' },
                { value: 'grid', label: 'One grid' },
              ]}
            />
          </div>
        </div>
      </DsSection>

      <DsSection
        title="Albums"
        description={`Up to ${MAX_ALBUMS} albums of ${MAX_ITEMS_PER_ALBUM} photos or short videos each. The first photo is the cover unless you pick another.`}
      >
        <DsTray>
          {gallery.albums.map((album, albumIndex) => (
            <DsTile key={album.id}>
              <div css={css`display: flex; gap: 0.5rem; align-items: center;`}>
                <DsInput
                  value={album.title}
                  placeholder="Album name (an emoji works too)"
                  maxLength={40}
                  aria-label="Album name"
                  onChange={event => updateAlbum(album.id, () => ({ title: event.target.value }))}
                />
                <button type="button" css={iconButton} disabled={albumIndex === 0} aria-label="Move album up" onClick={() => setGallery(c => ({ ...c, albums: moveItem(c.albums, albumIndex, albumIndex - 1) }))}>↑</button>
                <button type="button" css={iconButton} disabled={albumIndex === gallery.albums.length - 1} aria-label="Move album down" onClick={() => setGallery(c => ({ ...c, albums: moveItem(c.albums, albumIndex, albumIndex + 1) }))}>↓</button>
                <button
                  type="button"
                  css={iconButton}
                  aria-label="Delete album"
                  onClick={() => setGallery(c => ({ ...c, albums: c.albums.filter(a => a.id !== album.id) }))}
                >
                  ×
                </button>
              </div>
              <div css={thumbGrid}>
                {album.items.map((item, index) => (
                  <Thumb
                    key={item.id}
                    item={item}
                    isCover={album.cover === item.src || (!album.cover && index === 0)}
                    first={index === 0}
                    last={index === album.items.length - 1}
                    onCover={() => updateAlbum(album.id, () => ({ cover: item.src }))}
                    onRemove={() =>
                      updateAlbum(album.id, a => ({
                        items: a.items.filter(i => i.id !== item.id),
                        cover: a.cover === item.src ? null : a.cover,
                      }))
                    }
                    onLeft={() => updateAlbum(album.id, a => ({ items: moveItem(a.items, index, index - 1) }))}
                    onRight={() => updateAlbum(album.id, a => ({ items: moveItem(a.items, index, index + 1) }))}
                    onAlt={alt => updateAlbum(album.id, a => ({ items: a.items.map(i => (i.id === item.id ? { ...i, alt } : i)) }))}
                  />
                ))}
              </div>
              <div css={css`margin-top: 0.75rem;`}>
                <UploadButton
                  accept="image/*,video/mp4,video/quicktime,video/webm"
                  disabled={album.items.length >= MAX_ITEMS_PER_ALBUM}
                  onUploaded={uploads =>
                    updateAlbum(album.id, a => ({
                      items: [
                        ...a.items,
                        ...uploads.map(u => ({ id: shortId(), src: u.url, alt: '', type: u.type, poster: u.type === 'video' ? cloudinaryPoster(u.url) : null })),
                      ].slice(0, MAX_ITEMS_PER_ALBUM),
                    }))
                  }
                >
                  + Add photos or videos
                </UploadButton>
              </div>
            </DsTile>
          ))}
          <DsTile>
            <div css={css`display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;`}>
              <span css={helpText}>{gallery.albums.length ? 'Start another album:' : 'Start your first album by choosing some photos.'}</span>
              <UploadButton accept="image/*,video/mp4,video/quicktime,video/webm" disabled={gallery.albums.length >= MAX_ALBUMS} onUploaded={addAlbum}>
                + New album
              </UploadButton>
            </div>
          </DsTile>
        </DsTray>
      </DsSection>

      <DsSection
        title="Preview"
        description="This is how it looks on your profile. Tap an album, then a photo."
        action={user.name ? <DsButton size="sm" variant="outline" href={`/${user.name}#gallery`} target="_blank" rel="noreferrer">View profile</DsButton> : null}
      >
        <div css={previewFrame}>
          {preview.albums.length ? <GalleryBlock gallery={preview} /> : <p css={helpText}>Your gallery is empty, so it’s hidden on your profile.</p>}
        </div>
      </DsSection>
    </>
  )
}

function GallerySettings() {
  const { user, loading } = useCurrentUserDoc()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (user) setReady(true)
  }, [user])
  return (
    <BlockSettingsPage title="Gallery">
      <LoadingContainer isLoading={loading || !ready}>{ready && user ? <GalleryEditor user={user} /> : null}</LoadingContainer>
    </BlockSettingsPage>
  )
}

export default withBlockLayout(GallerySettings, 'Gallery')

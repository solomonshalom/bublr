/**
 * The gallery on a writer's profile, ported from the gallery page on
 * jeremybosma.nl (github.com/jeremybosma/jeremybosma): albums shown as a
 * fanned stack of three photos around a cover, which open into a 9:16 grid,
 * and a lightbox that grows out of the tapped photo.
 *
 * Stored on the user document as
 *   gallery: { layout: 'albums' | 'grid', albums: [{ id, title, cover, items: [{ id, src, alt, type, poster }] }] }
 * 'grid' shows every photo in one grid (the reference's flat layout).
 */

export const MAX_ALBUMS = 24
export const MAX_ITEMS_PER_ALBUM = 60

function cleanText(value, max) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max) : ''
}

function cleanUrl(value) {
  if (typeof value !== 'string' || value.length > 800) return ''
  try {
    return new URL(value).protocol === 'https:' ? value : ''
  } catch (_) {
    return ''
  }
}

function cleanId(value, fallback) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : fallback
}

export function isVideoSrc(src) {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(String(src || '')) || /\/video\/upload\//.test(String(src || ''))
}

/** First frame of a Cloudinary video, as a JPG (used for morphs and tiles). */
export function cloudinaryPoster(src) {
  const value = String(src || '')
  if (!/res\.cloudinary\.com\/.+\/video\/upload\//.test(value)) return null
  return value.replace('/video/upload/', '/video/upload/so_0/').replace(/\.[a-z0-9]+(\?.*)?$/i, '.jpg')
}

export function normalizeItem(raw, index) {
  if (!raw || typeof raw !== 'object') return null
  const src = cleanUrl(raw.src)
  if (!src) return null
  const type = raw.type === 'video' || (raw.type !== 'image' && isVideoSrc(src)) ? 'video' : 'image'
  return {
    id: cleanId(raw.id, `i${index}${Math.random().toString(36).slice(2, 7)}`),
    src,
    alt: cleanText(raw.alt, 140),
    type,
    poster: type === 'video' ? cleanUrl(raw.poster) || cloudinaryPoster(src) || null : null,
  }
}

export function normalizeGallery(gallery) {
  const raw = gallery && typeof gallery === 'object' ? gallery : {}
  const albums = (Array.isArray(raw.albums) ? raw.albums : [])
    .slice(0, MAX_ALBUMS)
    .map((album, a) => {
      if (!album || typeof album !== 'object') return null
      const items = (Array.isArray(album.items) ? album.items : [])
        .slice(0, MAX_ITEMS_PER_ALBUM)
        .map((item, i) => normalizeItem(item, i))
        .filter(Boolean)
      const firstStill = items.find(i => i.type === 'image')?.src || items[0]?.poster || null
      return {
        id: cleanId(album.id, `a${a}${Math.random().toString(36).slice(2, 7)}`),
        title: cleanText(album.title, 40),
        cover: cleanUrl(album.cover) || firstStill,
        items,
      }
    })
    .filter(album => album && album.items.length > 0)
  return { layout: raw.layout === 'grid' ? 'grid' : 'albums', albums }
}

export function galleryHasContent(gallery) {
  return normalizeGallery(gallery).albums.length > 0
}

function hashString(value) {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0
  return hash
}

/** The three photos fanned out behind an album's cover (stable per album). */
export function pickPreviewIndices(items, albumId, count = 3) {
  const indexed = items.map((item, index) => ({ item, index }))
  if (indexed.length <= count) return indexed.map(({ index }) => index)
  return [...indexed]
    .sort((a, b) => hashString(`${albumId}:${a.item.src}`) - hashString(`${albumId}:${b.item.src}`))
    .slice(0, count)
    .map(({ index }) => index)
}

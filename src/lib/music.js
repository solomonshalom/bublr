/**
 * The music section on a writer's profile. Two modes, the writer's choice:
 *
 *   - "list": tracks and albums they picked (searched from Apple's catalogue
 *     for titles and cover art), shown like the music page on jeremybosma.nl
 *     (github.com/jeremybosma/jeremybosma): album groups that expand, a
 *     sliding hover highlight, and a "listen on" picker.
 *   - "spotify": adaptive. What they're playing right now and what they played
 *     last, live from their own Spotify app (lib/spotify.js).
 *
 * Stored on the user document as `music: { mode, tracks }`.
 */

export const MAX_TRACKS = 200
export const MUSIC_MODES = ['list', 'spotify']
export const TRACK_TYPES = ['single', 'album', 'ep']

function cleanText(value, max) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max) : ''
}

function cleanUrl(value) {
  if (typeof value !== 'string' || value.length > 600) return ''
  try {
    return new URL(value).protocol === 'https:' ? value : ''
  } catch (_) {
    return ''
  }
}

export function normalizeTrack(raw) {
  if (!raw || typeof raw !== 'object') return null
  const title = cleanText(raw.title, 200)
  const author = cleanText(raw.author, 200)
  if (!title || !author) return null
  return {
    id: typeof raw.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(raw.id) ? raw.id : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    title,
    author,
    type: TRACK_TYPES.includes(raw.type) ? raw.type : 'single',
    album: cleanText(raw.album, 200) || null,
    image: cleanUrl(raw.image) || null,
    appleUrl: cleanUrl(raw.appleUrl) || null,
    unreleased: raw.unreleased === true,
  }
}

export function normalizeMusic(music) {
  const raw = music && typeof music === 'object' ? music : {}
  const tracks = (Array.isArray(raw.tracks) ? raw.tracks : []).map(normalizeTrack).filter(Boolean).slice(0, MAX_TRACKS)
  return {
    mode: MUSIC_MODES.includes(raw.mode) ? raw.mode : 'list',
    tracks,
    showRecent: raw.showRecent !== false,
  }
}

// --- grouping, ported from music-list-groups.ts / music-track-dedup.ts

export function normalizeMusicText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*\(remix\)/gi, '')
    .replace(/\s*-\s*single$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function stripFeatured(title) {
  return String(title || '').replace(/\s*[([](feat\.?|ft\.?|with)\s[^)\]]*[)\]]/gi, '')
}

function primaryArtist(author) {
  return String(author || '').split(/,|&|\bfeat\.?|\bft\.?|\bx\b/i)[0].trim()
}

export function getAlbumName(track) {
  if (track.type === 'album' || track.type === 'ep') return track.title
  return track.album || null
}

export function getTrackIdentityKey(track) {
  return [
    normalizeMusicText(primaryArtist(track.author)),
    normalizeMusicText(stripFeatured(track.title)),
    normalizeMusicText(getAlbumName(track) || ''),
  ].join('\0')
}

export function dedupeMusicTracks(tracks) {
  const result = []
  const indexByKey = new Map()
  for (const track of tracks) {
    const key = getTrackIdentityKey(track)
    const existing = indexByKey.get(key)
    if (existing === undefined) {
      indexByKey.set(key, result.length)
      result.push(track)
      continue
    }
    const left = result[existing]
    const preferRight =
      track.title.length > left.title.length ||
      (track.title.length === left.title.length && (track.album?.length ?? 0) > (left.album?.length ?? 0))
    const preferred = preferRight ? track : left
    const other = preferRight ? left : track
    result[existing] = { ...preferred, ...(other.unreleased ? { unreleased: true } : {}), ...(preferred.image ? {} : { image: other.image }) }
  }
  return result
}

function pickGroupCover(tracks) {
  const albumEntry = tracks.find(t => (t.type === 'album' || t.type === 'ep') && t.image)
  if (albumEntry) return albumEntry.image
  return tracks.find(t => t.image)?.image || null
}

function groupAuthor(tracks) {
  const albumEntry = tracks.find(t => t.type === 'album' || t.type === 'ep')
  if (albumEntry) return albumEntry.author
  const counts = new Map()
  for (const t of tracks) counts.set(t.author, (counts.get(t.author) || 0) + 1)
  const sorted = [...counts.entries()].sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : b[0].length - a[0].length))
  return sorted[0]?.[0] || tracks[0]?.author || ''
}

function groupName(tracks) {
  const albumEntry = tracks.find(t => t.type === 'album' || t.type === 'ep')
  if (albumEntry) return albumEntry.title
  return getAlbumName(tracks[0]) || tracks[0].title
}

/**
 * Tracks that share an album become one expandable album row; everything else
 * stays a single row, in the writer's order.
 */
export function buildMusicListItems(music) {
  const deduped = dedupeMusicTracks(music)
  const groups = new Map()
  const keyOf = track => {
    const name = getAlbumName(track)
    return name ? normalizeMusicText(name) : null
  }
  for (const track of deduped) {
    const key = keyOf(track)
    if (!key) continue
    if (groups.has(key)) groups.get(key).push(track)
    else groups.set(key, [track])
  }

  const emitted = new Set()
  const items = []
  for (const track of deduped) {
    const key = keyOf(track)
    const groupTracks = key ? groups.get(key) : null
    if (key && groupTracks && groupTracks.length > 1) {
      if (emitted.has(key)) continue
      emitted.add(key)
      items.push({
        kind: 'album-group',
        key: `album:${key}`,
        album: groupName(groupTracks),
        author: groupAuthor(groupTracks),
        tracks: groupTracks,
        image: pickGroupCover(groupTracks),
      })
      continue
    }
    items.push({ kind: 'track', key: `track:${getTrackIdentityKey(track)}`, track })
  }
  return items
}

export function trackTypeLabel(track) {
  if (track.unreleased) return track.type
  if (track.type === 'ep') return 'EP'
  return track.type.charAt(0).toUpperCase() + track.type.slice(1)
}

/** Search links used when no direct link is known (same as the reference). */
export function platformSearchUrl(platform, track) {
  const q = encodeURIComponent(`${track.author} ${track.title}`)
  if (platform === 'apple') return `https://music.apple.com/us/search?term=${q}`
  if (platform === 'youtube') return `https://www.youtube.com/results?search_query=${q}`
  if (platform === 'spotify') return `https://open.spotify.com/search/${q}`
  return `https://www.google.com/search?q=${q}+music`
}

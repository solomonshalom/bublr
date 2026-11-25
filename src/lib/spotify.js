import { firestore } from './firebase'
import { open, seal } from './secret-box'

/**
 * "Adaptive" music: a writer connects their own Spotify developer app (client
 * ID + secret) and authorises it once; their profile then shows what they're
 * playing now and what they played last.
 *
 * Why their own app: an app in Spotify's development mode serves at most five
 * listed users, and only organisations can get more. An app per writer has
 * one user, its owner. (Spotify requires the owner to have Premium.)
 *
 * Stored on the user document as `integrations.spotify`:
 *   { clientId, secretSealed, refreshSealed, status, displayName, connectedAt }
 * status: 'pending' (app saved, not authorised yet) | 'connected' | 'expired'
 */

const ACCOUNTS = 'https://accounts.spotify.com'
const API = 'https://api.spotify.com/v1'
export const SPOTIFY_SCOPES = ['user-read-currently-playing', 'user-read-recently-played']

const ID_RE = /^[A-Za-z0-9]{32}$/

export class SpotifyError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message)
    this.name = 'SpotifyError'
    this.status = status
    this.code = code
  }
}

export const secretContext = uid => `${uid}:spotify-secret`
export const refreshContext = uid => `${uid}:spotify-refresh`

export function isClientId(value) {
  return ID_RE.test(String(value || ''))
}

/** The exact redirect URI writers paste into their Spotify app. */
export function redirectUri() {
  const base = (process.env.SPOTIFY_REDIRECT_BASE || process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life').replace(/\/$/, '')
  return `${base}/api/integrations/spotify/callback`
}

function basicAuth(clientId, clientSecret) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

async function tokenRequest(clientId, clientSecret, params) {
  const response = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new SpotifyError(data?.error_description || data?.error || `Spotify answered ${response.status}`, {
      status: response.status,
      code: data?.error || null,
    })
  }
  return data
}

/** Proves a client ID + secret pair is real before anything is stored. */
export async function verifyClient(clientId, clientSecret) {
  await tokenRequest(clientId, clientSecret, { grant_type: 'client_credentials' })
}

export function authorizeUrl({ clientId, state }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SPOTIFY_SCOPES.join(' '),
    redirect_uri: redirectUri(),
    state,
    show_dialog: 'true',
  })
  return `${ACCOUNTS}/authorize?${params}`
}

export async function exchangeCode({ clientId, clientSecret, code }) {
  return tokenRequest(clientId, clientSecret, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
  })
}

async function spotifyGet(accessToken, path) {
  const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new SpotifyError(data?.error?.message || `Spotify answered ${response.status}`, { status: response.status })
  }
  return data
}

export async function fetchProfile(accessToken) {
  const me = await spotifyGet(accessToken, '/me')
  return { displayName: me?.display_name || me?.id || null }
}

// Access tokens last an hour; keep them per writer for this server instance.
const accessTokens = new Map()
// Answers are cached briefly so a busy profile doesn't hammer Spotify.
const responses = new Map()
const RESPONSE_TTL_MS = 15 * 1000

export function _resetSpotifyCaches() {
  accessTokens.clear()
  responses.clear()
}

function credentials(user) {
  const spotify = user?.integrations?.spotify
  if (!spotify?.clientId || !spotify?.secretSealed || !spotify?.refreshSealed) return null
  const clientSecret = open(spotify.secretSealed, secretContext(user.id))
  const refreshToken = open(spotify.refreshSealed, refreshContext(user.id))
  if (!clientSecret || !refreshToken) return null
  return { clientId: spotify.clientId, clientSecret, refreshToken }
}

// Keyed on the connection, so reconnecting another Spotify account never
// shows the old one's listening from a cache.
const cacheKey = user => `${user.id}:${user.integrations?.spotify?.connectedAt || ''}:${user.integrations?.spotify?.clientId || ''}`

async function accessTokenFor(user) {
  const cached = accessTokens.get(cacheKey(user))
  if (cached && cached.expiresAt > Date.now() + 30 * 1000) return cached.token

  const creds = credentials(user)
  if (!creds) throw new SpotifyError('Spotify is not connected', { code: 'not_connected' })

  try {
    const data = await tokenRequest(creds.clientId, creds.clientSecret, {
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
    })
    accessTokens.set(cacheKey(user), { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 })
    // Spotify may hand out a new refresh token; keep using the old one if not.
    if (data.refresh_token && data.refresh_token !== creds.refreshToken) {
      await firestore.collection('users').doc(user.id).update({
        'integrations.spotify.refreshSealed': seal(data.refresh_token, refreshContext(user.id)),
      })
    }
    return data.access_token
  } catch (error) {
    // Revoked, or past Spotify's six-month limit: the writer has to reconnect.
    if (error instanceof SpotifyError && (error.code === 'invalid_grant' || error.code === 'invalid_client')) {
      await firestore
        .collection('users')
        .doc(user.id)
        .update({ 'integrations.spotify.status': 'expired' })
        .catch(() => {})
      throw new SpotifyError('Spotify needs to be reconnected', { code: 'expired' })
    }
    throw error
  }
}

function shapeTrack(item) {
  if (!item) return null
  const isEpisode = item.type === 'episode'
  const images = isEpisode ? item.images || item.show?.images || [] : item.album?.images || []
  // Images come widest first; a mid-size one is plenty for a 48px tile.
  const image = (images.find(i => i.width && i.width <= 320) || images[0] || {}).url || null
  return {
    id: item.id || null,
    title: item.name || '',
    author: isEpisode ? item.show?.name || '' : (item.artists || []).map(a => a.name).filter(Boolean).join(', '),
    album: isEpisode ? null : item.album?.name || null,
    image,
    url: item.external_urls?.spotify || null,
    durationMs: item.duration_ms || null,
    type: isEpisode ? 'episode' : 'track',
  }
}

/**
 * What the profile shows: the current track (with progress) and the last few
 * played. Never includes anything secret.
 */
export async function getListening(user, { recentLimit = 10 } = {}) {
  const cached = responses.get(cacheKey(user))
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const token = await accessTokenFor(user)
  const [current, recent] = await Promise.all([
    spotifyGet(token, '/me/player/currently-playing?additional_types=track,episode'),
    recentLimit > 0 ? spotifyGet(token, `/me/player/recently-played?limit=${Math.min(50, recentLimit)}`) : null,
  ])

  const nowPlaying =
    current && current.item && ['track', 'episode'].includes(current.currently_playing_type)
      ? {
          ...shapeTrack(current.item),
          isPlaying: current.is_playing === true,
          progressMs: typeof current.progress_ms === 'number' ? current.progress_ms : null,
          fetchedAt: Date.now(),
        }
      : null

  const seen = new Set()
  const recentTracks = []
  for (const entry of recent?.items || []) {
    const track = shapeTrack(entry.track)
    if (!track || seen.has(track.id)) continue
    seen.add(track.id)
    recentTracks.push({ ...track, playedAt: entry.played_at || null })
  }

  const value = { nowPlaying, recent: recentTracks }
  responses.set(cacheKey(user), { value, expiresAt: Date.now() + RESPONSE_TTL_MS })
  if (responses.size > 2000) responses.clear()
  return value
}

/** What the dashboard may know about the connection. */
export function spotifyStatus(user) {
  const spotify = user?.integrations?.spotify
  return {
    redirectUri: redirectUri(),
    clientId: spotify?.clientId || null,
    status: spotify?.status || null,
    displayName: spotify?.displayName || null,
    connectedAt: spotify?.connectedAt || null,
    hasSecret: Boolean(spotify?.secretSealed),
  }
}

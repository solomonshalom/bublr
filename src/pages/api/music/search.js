import { requireAuth } from '../../../lib/server-auth'
import { clientIp, isRateLimited } from '../../../lib/rate-limit'

/**
 * Find songs and albums in Apple's catalogue for the music editor, so writers
 * get the right title, artist, album and cover art without typing them.
 * (The browser can't call iTunes directly: the site's CSP blocks it.)
 *
 * GET ?q=<text>&type=song|album
 */
const ITUNES = 'https://itunes.apple.com/search'

function upscale(url) {
  return typeof url === 'string' ? url.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/300x300bb.$1') : null
}

function cleanCollection(name) {
  return String(name || '').replace(/\s+-\s+(Single|EP)$/i, '').trim()
}

export function shapeResult(result) {
  if (result.wrapperType === 'collection') {
    const isEp = /\s-\sEP$/i.test(result.collectionName || '')
    return {
      type: isEp ? 'ep' : 'album',
      title: cleanCollection(result.collectionName),
      author: result.artistName || '',
      album: null,
      image: upscale(result.artworkUrl100),
      appleUrl: result.collectionViewUrl || null,
    }
  }
  if (result.wrapperType === 'track' && result.kind === 'song') {
    const album = cleanCollection(result.collectionName)
    return {
      type: 'single',
      title: result.trackName || '',
      author: result.artistName || '',
      album: album && album !== result.trackName ? album : null,
      image: upscale(result.artworkUrl100),
      appleUrl: result.trackViewUrl || null,
    }
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const uid = await requireAuth(req, res)
  if (!uid) return

  if (isRateLimited(`music-search:${uid}:${clientIp(req)}`, { max: 60, windowMs: 60 * 1000 })) {
    return res.status(429).json({ error: 'Slow down a little' })
  }

  const q = String(req.query.q || '').trim().slice(0, 120)
  const entity = req.query.type === 'album' ? 'album' : 'song'
  if (q.length < 2) return res.status(200).json({ results: [] })

  try {
    const params = new URLSearchParams({ term: q, entity, media: 'music', limit: '10', country: String(req.query.country || 'US').slice(0, 2) })
    const response = await fetch(`${ITUNES}?${params}`, { headers: { Accept: 'application/json' } })
    if (!response.ok) return res.status(502).json({ error: 'Search is unavailable right now', results: [] })
    const data = await response.json()
    const results = (data.results || []).map(shapeResult).filter(r => r && r.title && r.author)
    return res.status(200).json({ results })
  } catch (error) {
    console.error('Music search failed:', error)
    return res.status(502).json({ error: 'Search is unavailable right now', results: [] })
  }
}

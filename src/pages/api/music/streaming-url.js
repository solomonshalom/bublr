import { clientIp, isRateLimited } from '../../../lib/rate-limit'

/**
 * The direct link to a song on Spotify, YouTube or Apple Music, for the
 * "listen on" picker. Uses song.link (Odesli) to match the Apple Music link
 * saved with the track; the picker opens a search page first and swaps in this
 * link when it arrives (same as the reference site).
 *
 * GET ?apple=<music.apple.com url>&platform=spotify|youtube|apple
 */
const cache = new Map()
const TTL = 24 * 60 * 60 * 1000
const PLATFORM_KEYS = { spotify: 'spotify', youtube: 'youtube', apple: 'appleMusic' }

function isAppleUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ['music.apple.com', 'itunes.apple.com'].includes(url.hostname)
  } catch (_) {
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apple = String(req.query.apple || '')
  const key = PLATFORM_KEYS[req.query.platform]
  if (!key || !isAppleUrl(apple)) return res.status(400).json({ url: null })
  if (key === 'appleMusic') return res.status(200).json({ url: apple })

  const cached = cache.get(apple)
  if (cached && cached.expiresAt > Date.now()) {
    return res.status(200).json({ url: cached.links[key] || null })
  }

  if (isRateLimited(`streaming-url:${clientIp(req)}`, { max: 30, windowMs: 60 * 1000 })) {
    return res.status(200).json({ url: null })
  }

  try {
    const response = await fetch(`https://api.song.link/v1-alpha.1/links?${new URLSearchParams({ url: apple, userCountry: 'US' })}`)
    if (!response.ok) return res.status(200).json({ url: null })
    const data = await response.json()
    const links = {}
    for (const [name, value] of Object.entries(data.linksByPlatform || {})) {
      if (value?.url) links[name] = value.url
    }
    cache.set(apple, { links, expiresAt: Date.now() + TTL })
    if (cache.size > 5000) cache.clear()
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400')
    return res.status(200).json({ url: links[key] || null })
  } catch (_) {
    return res.status(200).json({ url: null })
  }
}

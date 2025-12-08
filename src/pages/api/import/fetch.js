// Unified API endpoint to fetch articles from multiple platforms via RSS
// Supports: Medium, Substack, Blogger, Hashnode, WordPress, Ghost, DEV.to

import { getPlatform } from './platforms'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { platform, username } = req.body

  if (!platform) {
    return res.status(400).json({ error: 'Platform is required' })
  }

  if (!username) {
    return res.status(400).json({ error: 'Username/URL is required' })
  }

  const platformConfig = getPlatform(platform)

  if (!platformConfig) {
    return res.status(400).json({ error: 'Invalid platform' })
  }

  // Validate input format
  if (!platformConfig.validateInput(username)) {
    return res.status(400).json({
      error: `Invalid ${platformConfig.name} username/URL format`
    })
  }

  const parsedUsername = platformConfig.parseUsername(username)

  try {
    const rssUrl = platformConfig.getRssUrl(parsedUsername)

    // Use rss2json API to convert RSS to JSON (same service as Medium import)
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Bublr/1.0 (Content Import Service)',
      },
    })

    const data = await response.json()

    if (data.status !== 'ok') {
      // Try alternate RSS formats for some platforms
      const alternateUrl = getAlternateRssUrl(platform, parsedUsername)
      if (alternateUrl) {
        const altResponse = await fetch(
          `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(alternateUrl)}`
        )
        const altData = await altResponse.json()

        if (altData.status === 'ok') {
          return processAndRespond(res, altData, platformConfig)
        }
      }

      return res.status(404).json({
        error: `Could not fetch ${platformConfig.name} articles. Make sure the username/URL is correct and the blog is public.`,
        details: data.message || 'RSS feed not found',
      })
    }

    return processAndRespond(res, data, platformConfig)
  } catch (error) {
    console.error(`${platform} fetch error:`, error)
    return res.status(500).json({
      error: `Failed to fetch ${platformConfig.name} articles`,
      details: error.message,
    })
  }
}

// Process RSS data and send response
function processAndRespond(res, data, platformConfig) {
  // Transform articles to a cleaner format
  const articles = data.items.map((item) => ({
    title: cleanTitle(item.title),
    link: item.link,
    pubDate: item.pubDate,
    content: item.content || item.description || '',
    description: item.description || '',
    thumbnail: item.thumbnail || item.enclosure?.link || extractFirstImage(item.content || item.description),
    categories: item.categories || [],
    guid: item.guid || item.link,
    author: item.author || data.feed?.title || '',
  }))

  return res.status(200).json({
    success: true,
    platform: platformConfig.id,
    feed: {
      title: data.feed?.title || '',
      description: data.feed?.description || '',
      image: data.feed?.image || '',
      link: data.feed?.link || '',
    },
    articles,
  })
}

// Get alternate RSS URL formats for some platforms
function getAlternateRssUrl(platform, username) {
  switch (platform) {
    case 'blogger':
      // Try Atom format instead of RSS
      return `https://${username}.blogspot.com/feeds/posts/default`
    case 'wordpress':
      // Try RSS2 format
      return `https://${username}.wordpress.com/feed/rss/`
    case 'ghost':
      // Try without trailing slash
      return `https://${username}/rss`
    default:
      return null
  }
}

// Helper function to extract first image from content
function extractFirstImage(content) {
  if (!content) return null
  const imgMatch = content.match(/<img[^>]+src="([^">]+)"/)
  return imgMatch ? imgMatch[1] : null
}

// Clean title from HTML entities
function cleanTitle(title) {
  if (!title) return ''
  return title
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .trim()
}

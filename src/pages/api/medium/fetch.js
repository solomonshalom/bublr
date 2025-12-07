// API endpoint to fetch Medium articles via RSS feed
// Medium provides RSS feeds at: https://medium.com/feed/@username

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { username } = req.body

  if (!username) {
    return res.status(400).json({ error: 'Medium username is required' })
  }

  // Clean the username (remove @ if present)
  const cleanUsername = username.replace(/^@/, '').trim()

  if (!cleanUsername) {
    return res.status(400).json({ error: 'Invalid username' })
  }

  try {
    // Use rss2json API to convert Medium RSS to JSON
    const rssUrl = `https://medium.com/feed/@${cleanUsername}`
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`

    const response = await fetch(apiUrl)
    const data = await response.json()

    if (data.status !== 'ok') {
      return res.status(404).json({
        error: 'Could not fetch Medium articles. Make sure the username is correct.',
        details: data.message || 'RSS feed not found'
      })
    }

    // Transform articles to a cleaner format
    const articles = data.items.map(item => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      content: item.content,
      description: item.description,
      thumbnail: item.thumbnail || extractFirstImage(item.content),
      categories: item.categories || [],
      guid: item.guid,
    }))

    return res.status(200).json({
      success: true,
      feed: {
        title: data.feed.title,
        description: data.feed.description,
        image: data.feed.image,
        link: data.feed.link,
      },
      articles,
    })
  } catch (error) {
    console.error('Medium fetch error:', error)
    return res.status(500).json({
      error: 'Failed to fetch Medium articles',
      details: error.message
    })
  }
}

// Helper function to extract first image from content
function extractFirstImage(content) {
  if (!content) return null
  const imgMatch = content.match(/<img[^>]+src="([^">]+)"/)
  return imgMatch ? imgMatch[1] : null
}

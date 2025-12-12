import { getAllUsersWithPublishedPosts } from '../lib/db'
import { extractFirstImage, generateMetaDescription, calculateReadingTime, getWordCount, cleanTitle } from '../lib/seo-utils'
import { firestore } from '../lib/firebase'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life'

// Escape special XML characters
function escapeXml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Strip HTML tags for RSS descriptions
function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Generate RSS 2.0 XML feed
function generateRssFeed(posts) {
  const pubDate = new Date().toUTCString()
  const lastBuildDate = posts.length > 0
    ? new Date(Math.max(...posts.map(p => p.lastEdited))).toUTCString()
    : pubDate

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Bublr - A Minimal Writing Community</title>
    <link>${SITE_URL}</link>
    <description>Discover inspiring stories, articles, and blog posts from writers around the world on Bublr - a minimal writing platform focused on what matters most: your words.</description>
    <language>en-us</language>
    <copyright>Copyright ${new Date().getFullYear()} Bublr</copyright>
    <pubDate>${pubDate}</pubDate>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <generator>Bublr RSS Generator</generator>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <ttl>60</ttl>
    <image>
      <url>${SITE_URL}/images/socials.png</url>
      <title>Bublr</title>
      <link>${SITE_URL}</link>
      <width>144</width>
      <height>144</height>
    </image>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <atom:link href="${SITE_URL}" rel="alternate" type="text/html"/>
${posts.map(post => {
  const postUrl = `${SITE_URL}/${post.authorUsername}/${post.slug}`
  const pubDateStr = new Date(post.lastEdited).toUTCString()
  const description = post.excerpt || generateMetaDescription(post.content, 300)
  const plainDescription = stripHtml(description)
  const readingTime = calculateReadingTime(post.content)
  const wordCount = getWordCount(post.content)
  const title = cleanTitle(post.title) || 'Untitled'
  const image = extractFirstImage(post.content) || post.authorPhoto

  return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDateStr}</pubDate>
      <dc:creator>${escapeXml(post.authorDisplayName || post.authorUsername)}</dc:creator>
      <description><![CDATA[${plainDescription}]]></description>
      <content:encoded><![CDATA[${post.content || ''}]]></content:encoded>
      <category>Writing</category>
      ${image ? `<media:content url="${escapeXml(image)}" medium="image"/>
      <media:thumbnail url="${escapeXml(image)}"/>` : ''}
      ${image ? `<enclosure url="${escapeXml(image)}" type="image/jpeg" length="0"/>` : ''}
    </item>`
}).join('\n')}
  </channel>
</rss>`
}

export async function getServerSideProps({ res }) {
  try {
    // Get all users with published posts
    const users = await getAllUsersWithPublishedPosts()

    // Collect all posts with author info
    const allPosts = []

    // Fetch full content for each post
    for (const user of users) {
      for (const post of user.posts) {
        try {
          const postDoc = await firestore.collection('posts').doc(post.id).get()
          if (postDoc.exists) {
            const postData = postDoc.data()
            allPosts.push({
              id: post.id,
              slug: post.slug,
              title: postData.title,
              content: postData.content,
              excerpt: postData.excerpt,
              lastEdited: post.lastEdited?.toDate?.() ? post.lastEdited.toDate().getTime() : Date.now(),
              authorUsername: user.name,
              authorDisplayName: user.displayName,
              authorPhoto: user.photo
            })
          }
        } catch (err) {
          console.error(`Error fetching post ${post.id}:`, err)
        }
      }
    }

    // Sort by lastEdited descending (newest first)
    allPosts.sort((a, b) => b.lastEdited - a.lastEdited)

    // Limit to 50 most recent posts for RSS
    const recentPosts = allPosts.slice(0, 50)

    // Generate RSS feed
    const feed = generateRssFeed(recentPosts)

    // Set proper headers
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    res.write(feed)
    res.end()

    return { props: {} }
  } catch (error) {
    console.error('Error generating RSS feed:', error)

    // Return minimal valid RSS on error
    const fallbackFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bublr</title>
    <link>${SITE_URL}</link>
    <description>A minimal writing community</description>
  </channel>
</rss>`

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    res.write(fallbackFeed)
    res.end()

    return { props: {} }
  }
}

export default function RssFeed() {
  return null
}

import { getUserByName } from '../../lib/db'
import { extractFirstImage, generateMetaDescription, calculateReadingTime, cleanTitle } from '../../lib/seo-utils'
import { firestore } from '../../lib/firebase'

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

// Generate user-specific RSS 2.0 XML feed
function generateUserRssFeed(user, posts) {
  const displayName = user.displayName || user.name
  const userUrl = `${SITE_URL}/${user.name}`
  const feedUrl = `${userUrl}/feed.xml`
  const pubDate = new Date().toUTCString()
  const lastBuildDate = posts.length > 0
    ? new Date(Math.max(...posts.map(p => p.lastEdited))).toUTCString()
    : pubDate

  const description = user.about
    ? stripHtml(user.about).slice(0, 200)
    : `Posts by ${displayName} on Bublr - a minimal writing community.`

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(displayName)} on Bublr</title>
    <link>${userUrl}</link>
    <description>${escapeXml(description)}</description>
    <language>en-us</language>
    <copyright>Copyright ${new Date().getFullYear()} ${escapeXml(displayName)}</copyright>
    <pubDate>${pubDate}</pubDate>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <generator>Bublr RSS Generator</generator>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <ttl>60</ttl>
    <managingEditor>${escapeXml(displayName)}</managingEditor>
    <webMaster>support@bublr.life (Bublr Support)</webMaster>
    ${user.photo ? `<image>
      <url>${escapeXml(user.photo)}</url>
      <title>${escapeXml(displayName)}</title>
      <link>${userUrl}</link>
      <width>144</width>
      <height>144</height>
    </image>` : ''}
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    <atom:link href="${userUrl}" rel="alternate" type="text/html"/>
${posts.map(post => {
  const postUrl = `${userUrl}/${post.slug}`
  const pubDateStr = new Date(post.lastEdited).toUTCString()
  const summary = post.excerpt || generateMetaDescription(post.content, 300)
  const plainSummary = stripHtml(summary)
  const title = cleanTitle(post.title) || 'Untitled'
  const image = extractFirstImage(post.content) || user.photo

  return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDateStr}</pubDate>
      <dc:creator>${escapeXml(displayName)}</dc:creator>
      <description><![CDATA[${plainSummary}]]></description>
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

export async function getServerSideProps({ params, res }) {
  const { username } = params

  try {
    // Get user data
    const user = await getUserByName(username)

    if (!user) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
      res.write(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>User Not Found</title>
    <link>${SITE_URL}</link>
    <description>The requested user was not found.</description>
  </channel>
</rss>`)
      res.end()
      return { props: {} }
    }

    // Filter to only published posts and fetch full content
    const publishedPosts = []
    for (const post of user.posts || []) {
      if (post.published) {
        try {
          const postDoc = await firestore.collection('posts').doc(post.id).get()
          if (postDoc.exists) {
            const postData = postDoc.data()
            publishedPosts.push({
              id: post.id,
              slug: postData.slug || post.slug,
              title: postData.title,
              content: postData.content,
              excerpt: postData.excerpt,
              lastEdited: postData.lastEdited?.toDate?.()
                ? postData.lastEdited.toDate().getTime()
                : Date.now()
            })
          }
        } catch (err) {
          console.error(`Error fetching post ${post.id}:`, err)
        }
      }
    }

    // Sort by lastEdited descending
    publishedPosts.sort((a, b) => b.lastEdited - a.lastEdited)

    // Generate RSS feed
    const feed = generateUserRssFeed(user, publishedPosts)

    // Set proper headers
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400')
    res.write(feed)
    res.end()

    return { props: {} }
  } catch (error) {
    console.error('Error generating user RSS feed:', error)

    if (error.code === 'user/not-found') {
      res.statusCode = 404
    }

    // Return minimal valid RSS on error
    const fallbackFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(username)} on Bublr</title>
    <link>${SITE_URL}/${escapeXml(username)}</link>
    <description>Posts by ${escapeXml(username)}</description>
  </channel>
</rss>`

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    res.write(fallbackFeed)
    res.end()

    return { props: {} }
  }
}

export default function UserRssFeed() {
  return null
}

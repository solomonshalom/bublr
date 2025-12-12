import { getAllUsersWithPublishedPosts } from '../lib/db'
import { extractFirstImage, generateMetaDescription, cleanTitle } from '../lib/seo-utils'
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

// Strip HTML tags
function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Generate Atom 1.0 XML feed
function generateAtomFeed(posts) {
  const updated = posts.length > 0
    ? new Date(Math.max(...posts.map(p => p.lastEdited))).toISOString()
    : new Date().toISOString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:media="http://search.yahoo.com/mrss/">
  <title>Bublr - A Minimal Writing Community</title>
  <subtitle>Discover inspiring stories, articles, and blog posts from writers around the world.</subtitle>
  <link href="${SITE_URL}/atom.xml" rel="self" type="application/atom+xml"/>
  <link href="${SITE_URL}" rel="alternate" type="text/html"/>
  <id>${SITE_URL}/</id>
  <updated>${updated}</updated>
  <author>
    <name>Bublr</name>
    <uri>${SITE_URL}</uri>
  </author>
  <generator uri="${SITE_URL}" version="1.0">Bublr</generator>
  <icon>${SITE_URL}/favicon.ico</icon>
  <logo>${SITE_URL}/images/socials.png</logo>
  <rights>Copyright ${new Date().getFullYear()} Bublr</rights>
${posts.map(post => {
  const postUrl = `${SITE_URL}/${post.authorUsername}/${post.slug}`
  const updatedStr = new Date(post.lastEdited).toISOString()
  const summary = post.excerpt || generateMetaDescription(post.content, 300)
  const plainSummary = stripHtml(summary)
  const title = cleanTitle(post.title) || 'Untitled'
  const image = extractFirstImage(post.content) || post.authorPhoto

  return `  <entry>
    <title>${escapeXml(title)}</title>
    <link href="${postUrl}" rel="alternate" type="text/html"/>
    <id>${postUrl}</id>
    <updated>${updatedStr}</updated>
    <published>${updatedStr}</published>
    <author>
      <name>${escapeXml(post.authorDisplayName || post.authorUsername)}</name>
      <uri>${SITE_URL}/${escapeXml(post.authorUsername)}</uri>
    </author>
    <summary type="text">${escapeXml(plainSummary)}</summary>
    <content type="html"><![CDATA[${post.content || ''}]]></content>
    ${image ? `<media:thumbnail url="${escapeXml(image)}"/>` : ''}
    <category term="Writing"/>
  </entry>`
}).join('\n')}
</feed>`
}

export async function getServerSideProps({ res }) {
  try {
    // Get all users with published posts
    const users = await getAllUsersWithPublishedPosts()

    // Collect all posts with author info
    const allPosts = []

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

    // Sort by lastEdited descending
    allPosts.sort((a, b) => b.lastEdited - a.lastEdited)

    // Limit to 50 most recent posts
    const recentPosts = allPosts.slice(0, 50)

    // Generate Atom feed
    const feed = generateAtomFeed(recentPosts)

    // Set proper headers
    res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    res.write(feed)
    res.end()

    return { props: {} }
  } catch (error) {
    console.error('Error generating Atom feed:', error)

    // Return minimal valid Atom feed on error
    const fallbackFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Bublr</title>
  <link href="${SITE_URL}"/>
  <id>${SITE_URL}/</id>
  <updated>${new Date().toISOString()}</updated>
</feed>`

    res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8')
    res.write(fallbackFeed)
    res.end()

    return { props: {} }
  }
}

export default function AtomFeed() {
  return null
}

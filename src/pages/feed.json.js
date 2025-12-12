import { getAllUsersWithPublishedPosts } from '../lib/db'
import { extractFirstImage, generateMetaDescription, calculateReadingTime, getWordCount, cleanTitle } from '../lib/seo-utils'
import { firestore } from '../lib/firebase'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life'

// Strip HTML tags
function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Generate JSON Feed 1.1
function generateJsonFeed(posts) {
  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'Bublr - A Minimal Writing Community',
    home_page_url: SITE_URL,
    feed_url: `${SITE_URL}/feed.json`,
    description: 'Discover inspiring stories, articles, and blog posts from writers around the world on Bublr - a minimal writing platform focused on what matters most: your words.',
    icon: `${SITE_URL}/images/socials.png`,
    favicon: `${SITE_URL}/favicon.ico`,
    language: 'en-US',
    authors: [
      {
        name: 'Bublr',
        url: SITE_URL
      }
    ],
    items: posts.map(post => {
      const postUrl = `${SITE_URL}/${post.authorUsername}/${post.slug}`
      const summary = post.excerpt || generateMetaDescription(post.content, 300)
      const plainSummary = stripHtml(summary)
      const title = cleanTitle(post.title) || 'Untitled'
      const image = extractFirstImage(post.content) || post.authorPhoto
      const readingTime = calculateReadingTime(post.content)
      const wordCount = getWordCount(post.content)

      const item = {
        id: postUrl,
        url: postUrl,
        title: title,
        content_html: post.content || '',
        content_text: stripHtml(post.content),
        summary: plainSummary,
        date_published: new Date(post.lastEdited).toISOString(),
        date_modified: new Date(post.lastEdited).toISOString(),
        authors: [
          {
            name: post.authorDisplayName || post.authorUsername,
            url: `${SITE_URL}/${post.authorUsername}`
          }
        ],
        tags: ['writing'],
        language: 'en',
        _bublr: {
          reading_time_minutes: readingTime,
          word_count: wordCount,
          author_username: post.authorUsername
        }
      }

      if (image) {
        item.image = image
        item.banner_image = image
      }

      return item
    })
  }
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

    // Generate JSON Feed
    const feed = generateJsonFeed(recentPosts)

    // Set proper headers
    res.setHeader('Content-Type', 'application/feed+json; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    res.write(JSON.stringify(feed, null, 2))
    res.end()

    return { props: {} }
  } catch (error) {
    console.error('Error generating JSON feed:', error)

    // Return minimal valid JSON feed on error
    const fallbackFeed = {
      version: 'https://jsonfeed.org/version/1.1',
      title: 'Bublr',
      home_page_url: SITE_URL,
      feed_url: `${SITE_URL}/feed.json`,
      items: []
    }

    res.setHeader('Content-Type', 'application/feed+json; charset=utf-8')
    res.write(JSON.stringify(fallbackFeed))
    res.end()

    return { props: {} }
  }
}

export default function JsonFeed() {
  return null
}

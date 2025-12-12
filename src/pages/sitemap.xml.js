import { getAllUsersWithPublishedPosts } from '../lib/db'
import { extractFirstImage } from '../lib/seo-utils'
import { firestore } from '../lib/firebase'

const SITE_URL = 'https://bublr.life'

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

// Generate the XML sitemap with comprehensive blog data
function generateSiteMap(users, postsWithContent) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <!-- Homepage - highest priority -->
  <url>
    <loc>${SITE_URL}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>${SITE_URL}/images/socials.png</image:loc>
      <image:title>Bublr - A Minimal Writing Community</image:title>
    </image:image>
  </url>

  <!-- Explore page - discovery hub -->
  <url>
    <loc>${SITE_URL}/explore</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>

  <!-- RSS/Atom/JSON Feeds -->
  <url>
    <loc>${SITE_URL}/feed.xml</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${SITE_URL}/atom.xml</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${SITE_URL}/feed.json</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>

  <!-- User profile pages -->
  ${users
    .map(user => {
      const lastModified = user.posts && user.posts.length > 0
        ? new Date(Math.max(...user.posts.map(p => p.lastEdited.toDate()))).toISOString()
        : new Date().toISOString()

      return `
  <url>
    <loc>${SITE_URL}/${escapeXml(user.name)}</loc>
    <lastmod>${lastModified}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    ${user.photo ? `
    <image:image>
      <image:loc>${escapeXml(user.photo)}</image:loc>
      <image:title>${escapeXml(user.displayName || user.name)}'s profile picture</image:title>
    </image:image>` : ''}
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/${escapeXml(user.name)}" />
  </url>`
    })
    .join('')}

  <!-- Individual post pages with rich metadata -->
  ${users
    .map(user => {
      return user.posts
        .map(post => {
          const postContent = postsWithContent[post.id] || {}
          const firstImage = extractFirstImage(postContent.content)
          const lastModified = new Date(post.lastEdited.toDate()).toISOString()
          const postTitle = escapeXml(post.title || 'Untitled')

          return `
  <url>
    <loc>${SITE_URL}/${escapeXml(user.name)}/${escapeXml(post.slug)}</loc>
    <lastmod>${lastModified}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/${escapeXml(user.name)}/${escapeXml(post.slug)}" />
    ${firstImage ? `
    <image:image>
      <image:loc>${escapeXml(firstImage)}</image:loc>
      <image:title>${postTitle}</image:title>
    </image:image>` : ''}
    ${user.photo && !firstImage ? `
    <image:image>
      <image:loc>${escapeXml(user.photo)}</image:loc>
      <image:title>Author: ${escapeXml(user.displayName || user.name)}</image:title>
    </image:image>` : ''}
  </url>`
        })
        .join('')
    })
    .join('')}
</urlset>`
}

export async function getServerSideProps({ res }) {
  try {
    // Get all users with published posts
    const users = await getAllUsersWithPublishedPosts()

    // Fetch content for all posts to extract images
    const allPostIds = users.flatMap(u => u.posts.map(p => p.id))
    const postsWithContent = {}

    // Batch fetch post content (Firebase allows max 10 docs per batch)
    const batchSize = 10
    for (let i = 0; i < allPostIds.length; i += batchSize) {
      const batch = allPostIds.slice(i, i + batchSize)
      const docs = await Promise.all(
        batch.map(id => firestore.collection('posts').doc(id).get())
      )
      docs.forEach(doc => {
        if (doc.exists) {
          postsWithContent[doc.id] = doc.data()
        }
      })
    }

    // Generate the XML sitemap
    const sitemap = generateSiteMap(users, postsWithContent)

    // Set proper caching headers for sitemaps
    res.setHeader('Content-Type', 'application/xml')
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    res.write(sitemap)
    res.end()

    return {
      props: {},
    }
  } catch (error) {
    console.error('Error generating sitemap:', error)

    // Return a minimal valid sitemap on error
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <priority>1.0</priority>
  </url>
</urlset>`

    res.setHeader('Content-Type', 'application/xml')
    res.write(fallbackSitemap)
    res.end()

    return {
      props: {},
    }
  }
}

export default function Sitemap() {
  // This component doesn't need to render anything
  return null
}

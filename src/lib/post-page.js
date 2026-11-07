import { firestore } from './firebase'
import { toPostAuthor, toPublicPost } from './public-user'
import { toMillis } from './timestamps'
import { liveCustomDomain } from './custom-domains'
import { sanitizeFontFamily } from './fonts'
import {
  extractFirstImage,
  calculateReadingTime,
  getWordCount,
  generateMetaDescription,
  generateKeywords,
  cleanTitle,
  generateEnhancedBlogPostingSchema,
  generateBreadcrumbSchema,
  extractFAQsFromContent,
  generateFAQSchema,
} from './seo-utils'

const SITE_URL = 'https://bublr.life'

/**
 * Everything a published post's page needs, for bublr.life/<username>/<slug>
 * and for <writer's domain>/<slug>.
 *
 * @param {object} post        the post document ({ id, ...data }), published
 * @param {object} options
 * @param {object} [options.authorData]    the author's user document, if already loaded
 * @param {string} [options.customDomain]  set when the request arrived on the writer's domain
 */
export async function buildPostPageProps(post, { authorData = null, customDomain = null } = {}) {
  // Preserve author ID before overwriting with full author data
  const authorId = post.author
  let userData = authorData
  if (!userData) {
    const userDoc = await firestore.collection('users').doc(authorId).get()
    userData = userDoc.data()
  }
  // Where this writer's posts live: their own domain once it's live
  const authorDomain = customDomain || liveCustomDomain(userData)
  // Only the byline goes to the page. The full user record (subscriber
  // emails, API key hashes, billing details) used to be baked into this
  // statically generated page's public JSON.
  post.author = toPostAuthor(userData)
  post.authorId = authorId

  // toMillis also reads the { _seconds } maps the public API used to write
  const lastEditedTime = toMillis(post.lastEdited) || Date.now()
  post.lastEdited = lastEditedTime

  // Merge user font settings with post overrides (with sanitization for security)
  const userFontSettings = userData?.fontSettings || {}
  const postFontOverrides = post.fontOverrides || {}
  const fontSettings = {
    headingFont: sanitizeFontFamily(postFontOverrides.headingFont || userFontSettings.headingFont, 'Inter'),
    bodyFont: sanitizeFontFamily(postFontOverrides.bodyFont || userFontSettings.bodyFont, 'Inter'),
    codeFont: sanitizeFontFamily(postFontOverrides.codeFont || userFontSettings.codeFont, 'JetBrains Mono'),
  }

  // Filter out default fonts that are already loaded globally
  const defaultFonts = ['Inter', 'Newsreader', 'JetBrains Mono']
  const customFonts = [fontSettings.headingFont, fontSettings.bodyFont, fontSettings.codeFont]
    .filter(f => f && !defaultFonts.includes(f))
    .filter((f, i, arr) => arr.indexOf(f) === i) // Remove duplicates

  // Generate comprehensive SEO data
  const postTitle = cleanTitle(post.title)
  const postUrl = authorDomain
    ? `https://${authorDomain}/${post.slug}`
    : `${SITE_URL}/${post.author.name}/${post.slug}`
  const authorUrl = authorDomain ? `https://${authorDomain}/` : `${SITE_URL}/${post.author.name}`
  const publishedTime = new Date(lastEditedTime).toISOString()
  const readingTime = calculateReadingTime(post.content)
  const wordCount = getWordCount(post.content)
  const description = generateMetaDescription(post.excerpt, post.content)
  const keywords = generateKeywords(post.title, post.content, post.author.displayName)

  // Extract first image from content, or fall back to author photo
  const firstImage = extractFirstImage(post.content)
  const ogImage = firstImage || post.author.photo

  // Generate structured data schemas with GEO optimizations
  const blogPostingSchema = generateEnhancedBlogPostingSchema({
    title: postTitle,
    description,
    content: post.content,
    url: postUrl,
    imageUrl: ogImage,
    authorName: post.author.displayName,
    authorUrl,
    authorImage: post.author.photo,
    datePublished: publishedTime,
    dateModified: publishedTime,
    wordCount,
    readingTime,
    keywords
  })

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: post.author.displayName, url: authorUrl },
    { name: postTitle, url: postUrl }
  ])

  // Extract FAQs from content for FAQ schema (GEO optimization)
  const faqs = extractFAQsFromContent(post.content)
  const faqSchema = faqs.length > 0 ? generateFAQSchema(faqs) : null

  const seo = {
    title: `${postTitle} - ${post.author.displayName} | Bublr`,
    cleanTitle: postTitle,
    description,
    keywords,
    url: `/${post.author.name}/${post.slug}`,
    canonicalUrl: postUrl,
    image: ogImage,
    authorUrl,
    publishedTime,
    modifiedTime: publishedTime,
    readingTime,
    wordCount,
    blogPostingSchema,
    breadcrumbSchema,
    faqSchema
  }

  return {
    post: toPublicPost(post),
    seo,
    fontSettings,
    customFonts,
    authorDomain: authorDomain || null,
    onCustomDomain: Boolean(customDomain),
  }
}

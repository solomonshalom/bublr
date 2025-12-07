import { htmlToText } from 'html-to-text'

/**
 * SEO utility functions for optimizing post metadata
 */

/**
 * Extract the first image URL from HTML content
 * Returns null if no image found
 */
export function extractFirstImage(htmlContent) {
  if (!htmlContent) return null

  // Match img tags with src attribute
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/i
  const match = htmlContent.match(imgRegex)

  if (match && match[1]) {
    return match[1]
  }

  return null
}

/**
 * Extract all images from HTML content
 * Returns array of image objects with src and alt
 */
export function extractAllImages(htmlContent) {
  if (!htmlContent) return []

  const images = []
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi
  let match

  while ((match = imgRegex.exec(htmlContent)) !== null) {
    images.push({
      src: match[1],
      alt: match[2] || ''
    })
  }

  return images
}

/**
 * Calculate estimated reading time in minutes
 * Based on average reading speed of 200-250 words per minute
 */
export function calculateReadingTime(htmlContent) {
  if (!htmlContent) return 1

  const text = htmlToText(htmlContent, { wordwrap: false })
  const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length

  // Average reading speed: 225 words per minute
  const minutes = Math.ceil(wordCount / 225)

  return Math.max(1, minutes) // Minimum 1 minute
}

/**
 * Get word count from HTML content
 */
export function getWordCount(htmlContent) {
  if (!htmlContent) return 0

  const text = htmlToText(htmlContent, { wordwrap: false })
  return text.trim().split(/\s+/).filter(word => word.length > 0).length
}

/**
 * Generate an optimized meta description
 * - Uses excerpt if available
 * - Falls back to content, stripped of HTML
 * - Ensures proper length (150-160 chars for optimal display)
 */
export function generateMetaDescription(excerpt, content, maxLength = 155) {
  // Prefer excerpt if available and meaningful
  if (excerpt && excerpt.trim().length > 30) {
    const cleanExcerpt = htmlToText(excerpt, { wordwrap: false }).trim()
    if (cleanExcerpt.length <= maxLength) {
      return cleanExcerpt
    }
    return truncateAtSentence(cleanExcerpt, maxLength)
  }

  // Fall back to content
  if (content) {
    const cleanContent = htmlToText(content, { wordwrap: false }).trim()
    return truncateAtSentence(cleanContent, maxLength)
  }

  return ''
}

/**
 * Truncate text at a sentence boundary if possible
 * Falls back to word boundary
 */
function truncateAtSentence(text, maxLength) {
  if (text.length <= maxLength) return text

  // Try to cut at sentence boundary
  const truncated = text.substring(0, maxLength)
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? ')
  )

  if (lastSentenceEnd > maxLength * 0.5) {
    return truncated.substring(0, lastSentenceEnd + 1)
  }

  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...'
  }

  return truncated.substring(0, maxLength - 3) + '...'
}

/**
 * Generate SEO-friendly keywords from post content
 */
export function generateKeywords(title, content, authorName, maxKeywords = 10) {
  const text = `${title || ''} ${content || ''}`.toLowerCase()
  const cleanText = htmlToText(text, { wordwrap: false })

  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'also', 'now', 'here', 'there', 'then', 'if', 'because', 'as', 'until',
    'while', 'about', 'against', 'between', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over',
    'under', 'again', 'further', 'once', 'nbsp', 'amp', 'quot', 'lt', 'gt'
  ])

  // Extract words and count frequency
  const words = cleanText
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))

  const wordFreq = {}
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1
  })

  // Sort by frequency and take top keywords
  const keywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords - 2)
    .map(([word]) => word)

  // Add author name and some defaults
  if (authorName) {
    keywords.unshift(authorName.toLowerCase())
  }
  keywords.push('blog', 'article')

  return [...new Set(keywords)].slice(0, maxKeywords).join(', ')
}

/**
 * Generate a clean title for SEO
 * Strips HTML and ensures proper formatting
 */
export function cleanTitle(title) {
  if (!title) return 'Untitled'
  return htmlToText(title, { wordwrap: false }).trim() || 'Untitled'
}

/**
 * Generate BlogPosting JSON-LD structured data
 * Following schema.org best practices for SEO
 */
export function generateBlogPostingSchema({
  title,
  description,
  content,
  url,
  imageUrl,
  authorName,
  authorUrl,
  authorImage,
  datePublished,
  dateModified,
  wordCount,
  readingTime
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': url
    },
    'headline': cleanTitle(title).substring(0, 110), // Google recommends max 110 chars
    'description': description,
    'author': {
      '@type': 'Person',
      'name': authorName,
      'url': authorUrl
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'Bublr',
      'url': 'https://bublr.life',
      'logo': {
        '@type': 'ImageObject',
        'url': 'https://bublr.life/images/logo.png',
        'width': 512,
        'height': 512
      }
    },
    'url': url,
    'datePublished': datePublished,
    'dateModified': dateModified || datePublished
  }

  // Add image if available
  if (imageUrl) {
    schema.image = {
      '@type': 'ImageObject',
      'url': imageUrl,
      'width': 1200,
      'height': 630
    }
  } else if (authorImage) {
    // Fall back to author image
    schema.image = authorImage
  }

  // Add word count and reading time if available
  if (wordCount) {
    schema.wordCount = wordCount
  }

  if (readingTime) {
    schema.timeRequired = `PT${readingTime}M`
  }

  // Add article section
  schema.articleSection = 'Blog'
  schema.inLanguage = 'en'

  return schema
}

/**
 * Generate BreadcrumbList JSON-LD for navigation SEO
 */
export function generateBreadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': items.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
      'item': item.url
    }))
  }
}

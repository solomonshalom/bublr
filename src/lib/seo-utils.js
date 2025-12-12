import { htmlToText } from 'html-to-text'

/**
 * SEO & GEO (Generative Engine Optimization) utility functions
 *
 * This module provides comprehensive utilities for:
 * - Traditional SEO optimization (meta tags, structured data)
 * - GEO optimization for AI search engines (ChatGPT, Perplexity, Google AI)
 * - Schema.org structured data generation
 * - Content analysis and optimization
 *
 * GEO Best Practices implemented:
 * - E-E-A-T signals (Experience, Expertise, Authoritativeness, Trustworthiness)
 * - AI-friendly content structure
 * - Rich structured data for LLM parsing
 * - Citation-friendly formatting
 */

const SITE_URL = 'https://bublr.life'
const SITE_NAME = 'Bublr'
const SITE_DESCRIPTION = 'An open-source, ultra-minimal community for writers to share their thoughts, stories, and ideas without ads or paywalls.'

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

// ============================================
// GEO (Generative Engine Optimization) Functions
// ============================================

/**
 * Generate Organization schema for the site
 * Critical for E-E-A-T signals and AI citation
 */
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    'name': SITE_NAME,
    'url': SITE_URL,
    'logo': {
      '@type': 'ImageObject',
      'url': `${SITE_URL}/images/logo.png`,
      'width': 512,
      'height': 512
    },
    'description': SITE_DESCRIPTION,
    'foundingDate': '2024',
    'sameAs': [
      'https://github.com/solomonshalom/bublr'
    ],
    'contactPoint': {
      '@type': 'ContactPoint',
      'contactType': 'customer support',
      'url': `${SITE_URL}/about`
    }
  }
}

/**
 * Generate WebSite schema with SearchAction
 * Enables sitelinks searchbox in Google and AI search
 */
export function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    'url': SITE_URL,
    'name': SITE_NAME,
    'description': SITE_DESCRIPTION,
    'publisher': {
      '@id': `${SITE_URL}/#organization`
    },
    'inLanguage': 'en-US',
    'potentialAction': {
      '@type': 'SearchAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': `${SITE_URL}/explore?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  }
}

/**
 * Generate CollectionPage schema for explore/discovery pages
 * Helps AI understand content aggregation pages
 */
export function generateCollectionPageSchema({ title, description, url, itemCount }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': title,
    'description': description,
    'url': url,
    'isPartOf': {
      '@id': `${SITE_URL}/#website`
    },
    'about': {
      '@type': 'Thing',
      'name': 'Writing and Blog Posts'
    },
    'numberOfItems': itemCount || 0,
    'inLanguage': 'en-US'
  }
}

/**
 * Generate ProfilePage schema for author profiles
 * Enhanced Person schema with E-E-A-T signals
 */
export function generateProfilePageSchema({
  name,
  username,
  photo,
  about,
  socialLinks,
  website,
  postCount,
  followerCount,
  subscriberCount
}) {
  const sameAs = []

  if (socialLinks?.github) sameAs.push(`https://github.com/${socialLinks.github}`)
  if (socialLinks?.twitter) sameAs.push(`https://twitter.com/${socialLinks.twitter}`)
  if (socialLinks?.instagram) sameAs.push(`https://instagram.com/${socialLinks.instagram}`)
  if (socialLinks?.linkedin) sameAs.push(`https://linkedin.com/in/${socialLinks.linkedin}`)
  if (socialLinks?.youtube) sameAs.push(`https://youtube.com/@${socialLinks.youtube}`)
  if (website) sameAs.push(website.startsWith('http') ? website : `https://${website}`)

  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    'mainEntity': {
      '@type': 'Person',
      '@id': `${SITE_URL}/${username}#person`,
      'name': name,
      'alternateName': username,
      'url': `${SITE_URL}/${username}`,
      'image': photo,
      'description': about,
      'sameAs': sameAs,
      'interactionStatistic': [
        {
          '@type': 'InteractionCounter',
          'interactionType': 'https://schema.org/WriteAction',
          'userInteractionCount': postCount || 0
        },
        {
          '@type': 'InteractionCounter',
          'interactionType': 'https://schema.org/FollowAction',
          'userInteractionCount': followerCount || 0
        },
        {
          '@type': 'InteractionCounter',
          'interactionType': 'https://schema.org/SubscribeAction',
          'userInteractionCount': subscriberCount || 0
        }
      ]
    },
    'dateCreated': new Date().toISOString(),
    'inLanguage': 'en-US'
  }
}

/**
 * Generate enhanced BlogPosting schema with GEO optimizations
 * Includes Speakable schema for voice search and AI assistants
 */
export function generateEnhancedBlogPostingSchema({
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
  readingTime,
  keywords
}) {
  const cleanedTitle = cleanTitle(title).substring(0, 110)

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': url
    },
    'headline': cleanedTitle,
    'name': cleanedTitle,
    'description': description,
    'author': {
      '@type': 'Person',
      '@id': `${authorUrl}#person`,
      'name': authorName,
      'url': authorUrl,
      'image': authorImage
    },
    'publisher': {
      '@id': `${SITE_URL}/#organization`
    },
    'url': url,
    'datePublished': datePublished,
    'dateModified': dateModified || datePublished,
    'image': imageUrl ? {
      '@type': 'ImageObject',
      'url': imageUrl,
      'width': 1200,
      'height': 630
    } : undefined,
    'wordCount': wordCount,
    'timeRequired': `PT${readingTime}M`,
    'articleSection': 'Blog',
    'articleBody': htmlToText(content || '', { wordwrap: false }).substring(0, 5000),
    'inLanguage': 'en-US',
    'isAccessibleForFree': true,
    'keywords': keywords,
    // Speakable schema for voice search and AI assistants
    'speakable': {
      '@type': 'SpeakableSpecification',
      'cssSelector': ['article h1', 'article [itemprop="headline"]', 'article [itemprop="description"]', '.article-summary']
    },
    // Citation information for AI
    'citation': {
      '@type': 'CreativeWork',
      'name': cleanedTitle,
      'author': authorName,
      'url': url
    }
  }
}

/**
 * Generate FAQ schema from content
 * FAQ schema is highly effective for AI search visibility
 */
export function generateFAQSchema(faqs) {
  if (!faqs || faqs.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(faq => ({
      '@type': 'Question',
      'name': faq.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': faq.answer
      }
    }))
  }
}

/**
 * Generate HowTo schema
 * Useful for tutorial-style content
 */
export function generateHowToSchema({ title, description, steps, totalTime, imageUrl }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    'name': title,
    'description': description,
    'totalTime': totalTime,
    'image': imageUrl,
    'step': steps.map((step, index) => ({
      '@type': 'HowToStep',
      'position': index + 1,
      'name': step.name,
      'text': step.text,
      'image': step.image
    }))
  }
}

/**
 * Generate ItemList schema for list-style content
 * Useful for "Top X" posts or curated lists
 */
export function generateItemListSchema({ name, description, items }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': name,
    'description': description,
    'numberOfItems': items.length,
    'itemListElement': items.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
      'url': item.url,
      'description': item.description
    }))
  }
}

/**
 * Generate SiteNavigationElement schema
 * Helps search engines and AI understand site structure
 */
export function generateSiteNavigationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SiteNavigationElement',
    'name': 'Main Navigation',
    'hasPart': [
      {
        '@type': 'SiteNavigationElement',
        'name': 'Home',
        'url': SITE_URL
      },
      {
        '@type': 'SiteNavigationElement',
        'name': 'Explore',
        'url': `${SITE_URL}/explore`
      },
      {
        '@type': 'SiteNavigationElement',
        'name': 'Dashboard',
        'url': `${SITE_URL}/dashboard`
      },
      {
        '@type': 'SiteNavigationElement',
        'name': 'About',
        'url': `${SITE_URL}/about`
      }
    ]
  }
}

// ============================================
// GEO Content Analysis Functions
// ============================================

/**
 * Analyze content for GEO optimization
 * Returns recommendations for improving AI search visibility
 */
export function analyzeContentForGEO(content, title) {
  const text = htmlToText(content || '', { wordwrap: false })
  const words = text.split(/\s+/).filter(w => w.length > 0)

  const analysis = {
    wordCount: words.length,
    readability: calculateReadabilityScore(text),
    hasStructuredData: true, // Assume we're adding it
    recommendations: []
  }

  // Word count recommendations (GEO prefers comprehensive content)
  if (words.length < 300) {
    analysis.recommendations.push('Content is short. AI engines prefer comprehensive content (500+ words).')
  } else if (words.length > 3000) {
    analysis.recommendations.push('Consider adding a summary section for AI extraction.')
  }

  // Check for headings structure
  const hasH2 = /<h2/i.test(content)
  const hasH3 = /<h3/i.test(content)
  if (!hasH2 && words.length > 500) {
    analysis.recommendations.push('Add H2 headings to improve content structure for AI parsing.')
  }

  // Check for lists (AI loves structured content)
  const hasLists = /<(ul|ol)/i.test(content)
  if (!hasLists && words.length > 300) {
    analysis.recommendations.push('Consider adding bullet points or numbered lists for better AI extraction.')
  }

  // Check for statistics/numbers (E-E-A-T signal)
  const hasNumbers = /\d+%|\d+\.\d+|\$\d+/.test(text)
  if (!hasNumbers && words.length > 500) {
    analysis.recommendations.push('Adding statistics or data points can improve credibility for AI citation.')
  }

  return analysis
}

/**
 * Calculate basic readability score
 * Lower scores = easier to read = better for general audiences
 */
function calculateReadabilityScore(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const syllables = words.reduce((count, word) => count + countSyllables(word), 0)

  if (sentences.length === 0 || words.length === 0) return 0

  // Flesch-Kincaid Grade Level (simplified)
  const avgWordsPerSentence = words.length / sentences.length
  const avgSyllablesPerWord = syllables / words.length

  const score = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59

  return Math.round(Math.max(0, Math.min(18, score)) * 10) / 10
}

/**
 * Count syllables in a word (simplified)
 */
function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '')
  if (word.length <= 3) return 1

  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
  word = word.replace(/^y/, '')

  const matches = word.match(/[aeiouy]{1,2}/g)
  return matches ? matches.length : 1
}

/**
 * Extract potential FAQ pairs from content
 * Looks for question-answer patterns
 */
export function extractFAQsFromContent(content) {
  const text = htmlToText(content || '', { wordwrap: false })
  const faqs = []

  // Pattern: Look for sentences ending with ? followed by content
  const questionPattern = /([^.!?]*\?)\s*([^?]+?)(?=\s*[A-Z]|$)/g
  let match

  while ((match = questionPattern.exec(text)) !== null) {
    const question = match[1].trim()
    const answer = match[2].trim()

    if (question.length > 10 && answer.length > 20) {
      faqs.push({ question, answer: answer.substring(0, 500) })
    }

    if (faqs.length >= 5) break // Limit to 5 FAQs
  }

  return faqs
}

/**
 * Generate citation-friendly excerpt
 * Optimized for AI to quote/cite
 */
export function generateCitableExcerpt(content, maxLength = 200) {
  const text = htmlToText(content || '', { wordwrap: false }).trim()

  // Find the first complete sentence that's meaningful
  const sentences = text.split(/(?<=[.!?])\s+/)
  let excerpt = ''

  for (const sentence of sentences) {
    if (excerpt.length + sentence.length <= maxLength) {
      excerpt += (excerpt ? ' ' : '') + sentence
    } else {
      break
    }
  }

  // If no complete sentence found, truncate at word boundary
  if (!excerpt && text.length > 0) {
    excerpt = truncateAtSentence(text, maxLength)
  }

  return excerpt
}

// ============================================
// Newsletter Schema for AI Discoverability
// ============================================

/**
 * Generate Newsletter schema for subscription CTAs
 * Helps AI engines discover and surface newsletter subscription options
 */
export function generateNewsletterSchema({
  authorName,
  authorUsername,
  authorPhoto,
  authorAbout,
  subscriberCount
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Periodical',
    'name': `${authorName}'s Newsletter`,
    'description': authorAbout || `Subscribe to ${authorName}'s newsletter for the latest updates and posts.`,
    'url': `${SITE_URL}/${authorUsername}`,
    'publisher': {
      '@type': 'Person',
      'name': authorName,
      'url': `${SITE_URL}/${authorUsername}`,
      'image': authorPhoto
    },
    'isAccessibleForFree': true,
    'inLanguage': 'en-US',
    'potentialAction': {
      '@type': 'SubscribeAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': `${SITE_URL}/${authorUsername}`,
        'actionPlatform': [
          'https://schema.org/DesktopWebPlatform',
          'https://schema.org/MobileWebPlatform'
        ]
      },
      'name': 'Subscribe to Newsletter'
    },
    'interactionStatistic': {
      '@type': 'InteractionCounter',
      'interactionType': 'https://schema.org/SubscribeAction',
      'userInteractionCount': subscriberCount || 0
    }
  }
}

/**
 * Generate enhanced Person schema with E-E-A-T fields
 * Includes expertise, credentials, and authority signals
 */
export function generateEnhancedPersonSchema({
  name,
  username,
  photo,
  about,
  socialLinks,
  website,
  postCount,
  followerCount,
  subscriberCount,
  expertise,
  credentials,
  awards,
  education,
  employer
}) {
  const sameAs = []

  if (socialLinks?.github) sameAs.push(`https://github.com/${socialLinks.github}`)
  if (socialLinks?.twitter) sameAs.push(`https://twitter.com/${socialLinks.twitter}`)
  if (socialLinks?.instagram) sameAs.push(`https://instagram.com/${socialLinks.instagram}`)
  if (socialLinks?.linkedin) sameAs.push(`https://linkedin.com/in/${socialLinks.linkedin}`)
  if (socialLinks?.youtube) sameAs.push(`https://youtube.com/@${socialLinks.youtube}`)
  if (website) sameAs.push(website.startsWith('http') ? website : `https://${website}`)

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITE_URL}/${username}#person`,
    'name': name,
    'alternateName': username,
    'url': `${SITE_URL}/${username}`,
    'image': photo,
    'description': about,
    'sameAs': sameAs,
    // E-E-A-T: Expertise signals
    'interactionStatistic': [
      {
        '@type': 'InteractionCounter',
        'interactionType': 'https://schema.org/WriteAction',
        'userInteractionCount': postCount || 0
      },
      {
        '@type': 'InteractionCounter',
        'interactionType': 'https://schema.org/FollowAction',
        'userInteractionCount': followerCount || 0
      },
      {
        '@type': 'InteractionCounter',
        'interactionType': 'https://schema.org/SubscribeAction',
        'userInteractionCount': subscriberCount || 0
      }
    ]
  }

  // Add expertise/knowsAbout if provided
  if (expertise && expertise.length > 0) {
    schema.knowsAbout = expertise.map(topic => ({
      '@type': 'Thing',
      'name': topic
    }))
  }

  // Add credentials if provided
  if (credentials && credentials.length > 0) {
    schema.hasCredential = credentials.map(cred => ({
      '@type': 'EducationalOccupationalCredential',
      'name': cred.name,
      'credentialCategory': cred.category || 'certification'
    }))
  }

  // Add awards if provided
  if (awards && awards.length > 0) {
    schema.award = awards
  }

  // Add education if provided
  if (education && education.length > 0) {
    schema.alumniOf = education.map(edu => ({
      '@type': 'EducationalOrganization',
      'name': edu.institution,
      'description': edu.degree
    }))
  }

  // Add employer if provided
  if (employer) {
    schema.worksFor = {
      '@type': 'Organization',
      'name': employer.name,
      'url': employer.url
    }
  }

  return schema
}

// ============================================
// Export constants for use in other files
// ============================================

export { SITE_URL, SITE_NAME, SITE_DESCRIPTION }

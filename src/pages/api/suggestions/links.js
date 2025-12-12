/**
 * Internal Linking Suggestions API
 *
 * Analyzes post content and suggests relevant internal links to other posts
 * by the same author. This helps:
 * - Build topical authority (SEO)
 * - Reduce bounce rate
 * - Help AI understand content relationships (GEO)
 *
 * Usage: POST /api/suggestions/links
 * Body: { userId, currentPostId, content }
 * Returns: Array of suggested posts to link to
 */

import { firestore } from '../../../lib/firebase'
import { htmlToText } from 'html-to-text'

// Common stop words to filter out
const STOP_WORDS = new Set([
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
  'under', 'again', 'further', 'once', 'nbsp', 'amp', 'quot', 'your',
  'my', 'their', 'our', 'its', 'any', 'many', 'much', 'like', 'just',
  'get', 'got', 'make', 'made', 'take', 'took', 'come', 'came', 'go',
  'went', 'see', 'saw', 'know', 'knew', 'think', 'thought', 'want',
  'wanted', 'use', 'used', 'find', 'found', 'give', 'gave', 'tell', 'told'
])

/**
 * Extract keywords from text
 */
function extractKeywords(text, limit = 20) {
  const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ')
  const words = cleanText.split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))

  // Count word frequency
  const wordFreq = {}
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1
  })

  // Sort by frequency and return top keywords
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}

/**
 * Calculate similarity between two sets of keywords
 * Uses Jaccard similarity coefficient
 */
function calculateSimilarity(keywords1, keywords2) {
  const set1 = new Set(keywords1)
  const set2 = new Set(keywords2)

  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])

  if (union.size === 0) return 0
  return intersection.size / union.size
}

/**
 * Find keyword matches between content and post
 */
function findMatchingKeywords(contentKeywords, postKeywords) {
  return contentKeywords.filter(kw => postKeywords.includes(kw))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, currentPostId, content } = req.body

    if (!userId || !content) {
      return res.status(400).json({ error: 'userId and content are required' })
    }

    // Get user's posts
    const userDoc = await firestore.collection('users').doc(userId).get()

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userData = userDoc.data()
    const postIds = userData.posts || []

    if (postIds.length === 0) {
      return res.json({ suggestions: [] })
    }

    // Fetch all user's posts
    const postDocs = await Promise.all(
      postIds.map(id => firestore.collection('posts').doc(id).get())
    )

    // Extract keywords from current content
    const plainContent = htmlToText(content, { wordwrap: false })
    const contentKeywords = extractKeywords(plainContent)

    // Analyze each post for relevance
    const suggestions = []

    for (const postDoc of postDocs) {
      if (!postDoc.exists) continue

      const postData = postDoc.data()
      const postId = postDoc.id

      // Skip current post and unpublished posts
      if (postId === currentPostId || !postData.published) continue

      // Extract keywords from post
      const postText = `${htmlToText(postData.title || '', { wordwrap: false })} ${htmlToText(postData.content || '', { wordwrap: false })}`
      const postKeywords = extractKeywords(postText)

      // Calculate similarity
      const similarity = calculateSimilarity(contentKeywords, postKeywords)

      // Only suggest if similarity is above threshold
      if (similarity > 0.1) {
        const matchingKeywords = findMatchingKeywords(contentKeywords, postKeywords)

        suggestions.push({
          id: postId,
          title: htmlToText(postData.title || 'Untitled', { wordwrap: false }),
          slug: postData.slug,
          similarity: Math.round(similarity * 100),
          matchingKeywords: matchingKeywords.slice(0, 5),
          excerpt: htmlToText(postData.excerpt || postData.content || '', { wordwrap: false }).substring(0, 100) + '...',
          reason: `${matchingKeywords.length} matching keywords: ${matchingKeywords.slice(0, 3).join(', ')}${matchingKeywords.length > 3 ? '...' : ''}`
        })
      }
    }

    // Sort by similarity (highest first) and limit results
    suggestions.sort((a, b) => b.similarity - a.similarity)
    const topSuggestions = suggestions.slice(0, 5)

    return res.json({
      suggestions: topSuggestions,
      totalAnalyzed: postDocs.filter(d => d.exists).length - 1,
      contentKeywords: contentKeywords.slice(0, 10)
    })
  } catch (error) {
    console.error('Link suggestions error:', error)
    return res.status(500).json({ error: 'Failed to generate suggestions', details: error.message })
  }
}

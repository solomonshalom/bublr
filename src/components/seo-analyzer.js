/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useMemo } from 'react'
import { htmlToText } from 'html-to-text'
import { ChevronDownIcon, CheckCircledIcon, ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons'

/**
 * SEO Analyzer Component
 *
 * Provides real-time SEO analysis for post content.
 * Supports both long-form (articles) and short-form (Twitter-like) content.
 */

// Short-form threshold (roughly tweet-length)
const SHORT_FORM_THRESHOLD = 50 // words

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
 * Calculate Flesch-Kincaid Grade Level
 */
function calculateReadabilityGrade(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const syllables = words.reduce((count, word) => count + countSyllables(word), 0)

  if (sentences.length === 0 || words.length === 0) return 0

  const avgWordsPerSentence = words.length / sentences.length
  const avgSyllablesPerWord = syllables / words.length

  const score = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59

  return Math.round(Math.max(0, Math.min(18, score)) * 10) / 10
}

/**
 * Analyze content and return SEO insights
 */
function analyzeContent(title, content, excerpt) {
  const plainContent = htmlToText(content || '', { wordwrap: false })
  const plainTitle = htmlToText(title || '', { wordwrap: false })
  const plainExcerpt = excerpt ? htmlToText(excerpt, { wordwrap: false }) : ''

  const wordCount = plainContent.split(/\s+/).filter(w => w.length > 0).length
  const isShortForm = wordCount <= SHORT_FORM_THRESHOLD

  const analysis = {
    score: 0,
    items: [],
    isShortForm,
    wordCount
  }

  // Word count analysis - different approach for short vs long form
  if (isShortForm) {
    // Short-form content: celebrate brevity
    analysis.items.push({
      label: 'Content Length',
      status: 'success',
      message: `${wordCount} words - Short-form content optimized for engagement`
    })
    analysis.score += 25
  } else {
    // Long-form content: traditional SEO scoring
    if (wordCount >= 1500) {
      analysis.items.push({
        label: 'Content Length',
        status: 'success',
        message: `${wordCount} words - Comprehensive coverage`
      })
      analysis.score += 25
    } else if (wordCount >= 800) {
      analysis.items.push({
        label: 'Content Length',
        status: 'warning',
        message: `${wordCount} words - Good, aim for 1500+ for best results`
      })
      analysis.score += 18
    } else if (wordCount >= 300) {
      analysis.items.push({
        label: 'Content Length',
        status: 'warning',
        message: `${wordCount} words - Consider expanding for better SEO`
      })
      analysis.score += 12
    } else {
      analysis.items.push({
        label: 'Content Length',
        status: 'info',
        message: `${wordCount} words - Add more content or embrace short-form`
      })
      analysis.score += 8
    }
  }

  // Heading structure - only matters for long-form
  const h2Count = (content?.match(/<h2/gi) || []).length
  const h3Count = (content?.match(/<h3/gi) || []).length

  if (isShortForm) {
    // Short-form doesn't need headings
    analysis.score += 20
  } else {
    if (h2Count >= 2 && h3Count >= 1) {
      analysis.items.push({
        label: 'Structure',
        status: 'success',
        message: `${h2Count} sections with subheadings`
      })
      analysis.score += 20
    } else if (h2Count >= 1) {
      analysis.items.push({
        label: 'Structure',
        status: 'warning',
        message: `${h2Count} heading(s) - Add H3 subheadings`
      })
      analysis.score += 12
    } else if (wordCount > 500) {
      analysis.items.push({
        label: 'Structure',
        status: 'info',
        message: 'No headings - Break into sections'
      })
      analysis.score += 4
    } else {
      analysis.score += 15
    }
  }

  // Readability
  const readabilityGrade = calculateReadabilityGrade(plainContent)

  if (wordCount >= 20) {
    if (readabilityGrade <= 8) {
      analysis.items.push({
        label: 'Readability',
        status: 'success',
        message: `Grade ${readabilityGrade} - Easy to read`
      })
      analysis.score += 15
    } else if (readabilityGrade <= 12) {
      analysis.items.push({
        label: 'Readability',
        status: 'warning',
        message: `Grade ${readabilityGrade} - Consider simplifying`
      })
      analysis.score += 10
    } else {
      analysis.items.push({
        label: 'Readability',
        status: 'info',
        message: `Grade ${readabilityGrade} - Complex text`
      })
      analysis.score += 5
    }
  } else {
    analysis.score += 15
  }

  // Excerpt/Meta description
  const excerptLength = plainExcerpt.length

  if (excerptLength >= 120 && excerptLength <= 160) {
    analysis.items.push({
      label: 'Excerpt',
      status: 'success',
      message: `${excerptLength} chars - Perfect length`
    })
    analysis.score += 15
  } else if (excerptLength > 0 && excerptLength < 120) {
    analysis.items.push({
      label: 'Excerpt',
      status: 'warning',
      message: `${excerptLength} chars - Aim for 120-160`
    })
    analysis.score += 10
  } else if (excerptLength > 160) {
    analysis.items.push({
      label: 'Excerpt',
      status: 'warning',
      message: `${excerptLength} chars - May be truncated`
    })
    analysis.score += 12
  } else {
    analysis.items.push({
      label: 'Excerpt',
      status: 'info',
      message: 'No excerpt set'
    })
    analysis.score += 5
  }

  // Links - optional for short-form
  const linkCount = (content?.match(/<a\s/gi) || []).length

  if (linkCount >= 3) {
    analysis.items.push({
      label: 'Links',
      status: 'success',
      message: `${linkCount} links`
    })
    analysis.score += 10
  } else if (linkCount >= 1) {
    analysis.items.push({
      label: 'Links',
      status: 'success',
      message: `${linkCount} link(s)`
    })
    analysis.score += 8
  } else if (!isShortForm && wordCount > 300) {
    analysis.items.push({
      label: 'Links',
      status: 'info',
      message: 'Consider adding links'
    })
    analysis.score += 4
  } else {
    analysis.score += 8
  }

  // Images - optional for short-form
  const imageCount = (content?.match(/<img/gi) || []).length

  if (imageCount >= 1) {
    analysis.items.push({
      label: 'Media',
      status: 'success',
      message: `${imageCount} image${imageCount > 1 ? 's' : ''}`
    })
    analysis.score += 10
  } else if (!isShortForm && wordCount > 500) {
    analysis.items.push({
      label: 'Media',
      status: 'info',
      message: 'Add images for engagement'
    })
    analysis.score += 4
  } else {
    analysis.score += 8
  }

  // Lists - AI loves structured content, but optional for short-form
  const listCount = (content?.match(/<(ul|ol)/gi) || []).length

  if (listCount >= 1) {
    analysis.score += 5
  } else if (!isShortForm && wordCount > 800) {
    analysis.items.push({
      label: 'Lists',
      status: 'info',
      message: 'Add bullet points for AI'
    })
    analysis.score += 2
  } else {
    analysis.score += 5
  }

  // Cap at 100
  analysis.score = Math.min(100, analysis.score)

  return analysis
}

/**
 * Status Icon Component
 */
const StatusIcon = ({ status }) => {
  if (status === 'success') {
    return <CheckCircledIcon width={14} height={14} css={css`color: var(--grey-4); opacity: 0.8;`} />
  }
  if (status === 'warning') {
    return <ExclamationTriangleIcon width={14} height={14} css={css`color: var(--grey-3);`} />
  }
  return <InfoCircledIcon width={14} height={14} css={css`color: var(--grey-3); opacity: 0.6;`} />
}

/**
 * Main SEO Analyzer Component
 */
export default function SEOAnalyzer({ title, content, excerpt, isExpanded = false, onToggle }) {
  const [expanded, setExpanded] = useState(isExpanded)

  const analysis = useMemo(() => {
    return analyzeContent(title, content, excerpt)
  }, [title, content, excerpt])

  const handleToggle = () => {
    setExpanded(!expanded)
    if (onToggle) onToggle(!expanded)
  }

  // Dot colors for score ring
  const getScoreColor = (score) => {
    if (score >= 90) return '#A66CFF' // Purple - GREAT
    if (score >= 70) return '#4D96FF' // Blue - optimal
    if (score >= 50) return '#ff3e00' // Orange - getting there
    return '#E23E57' // Red - needs work
  }

  return (
    <div
      css={css`
        border: 1px solid var(--grey-2);
        border-radius: 0.5rem;
        background: var(--grey-1);
        overflow: hidden;
      `}
    >
      {/* Header - collapsible */}
      <button
        type="button"
        onClick={handleToggle}
        css={css`
          width: 100%;
          padding: 0.6rem 0.75rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s ease;

          &:hover {
            background: var(--grey-2);
          }
        `}
      >
        <div css={css`display: flex; align-items: center; gap: 0.6rem;`}>
          <div
            css={css`
              width: 28px;
              height: 28px;
              border-radius: 50%;
              border: 2px solid ${getScoreColor(analysis.score)};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 0.7rem;
              font-weight: 600;
              color: ${getScoreColor(analysis.score)};
            `}
          >
            {analysis.score}
          </div>
          <div css={css`text-align: left;`}>
            <span css={css`font-size: 0.8rem; font-weight: 500; color: var(--grey-4);`}>
              SEO
            </span>
            {analysis.isShortForm && (
              <span css={css`
                font-size: 0.65rem;
                color: var(--grey-3);
                margin-left: 0.4rem;
                padding: 0.1rem 0.35rem;
                background: var(--grey-2);
                border-radius: 0.25rem;
              `}>
                short-form
              </span>
            )}
          </div>
        </div>
        <ChevronDownIcon
          width={14}
          height={14}
          css={css`
            flex-shrink: 0;
            transform: rotate(${expanded ? '180deg' : '0deg'});
            transition: transform 0.15s ease;
            color: var(--grey-3);
          `}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          css={css`
            padding: 0.5rem 0.75rem 0.75rem;
            border-top: 1px solid var(--grey-2);
          `}
        >
          <div css={css`display: flex; flex-direction: column; gap: 0.4rem;`}>
            {analysis.items.map((item, index) => (
              <div
                key={index}
                css={css`
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  padding: 0.4rem 0.5rem;
                  border-radius: 0.375rem;
                  background: ${item.status === 'success' ? 'transparent' : 'var(--grey-2)'};
                  border: 1px solid ${item.status === 'success' ? 'var(--grey-2)' : 'transparent'};
                `}
              >
                <StatusIcon status={item.status} />
                <span css={css`
                  font-size: 0.75rem;
                  color: var(--grey-4);
                  flex: 1;
                `}>
                  <strong css={css`font-weight: 500;`}>{item.label}</strong>
                  <span css={css`color: var(--grey-3); margin-left: 0.3rem;`}>
                    {item.message}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div css={css`
            margin-top: 0.6rem;
            padding-top: 0.5rem;
            border-top: 1px solid var(--grey-2);
            text-align: center;
          `}>
            <span css={css`font-size: 0.65rem; color: var(--grey-3);`}>
              {analysis.isShortForm
                ? 'Short-form content is optimized for social sharing'
                : 'Optimize for search & AI discovery'
              }
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Export analysis function for use elsewhere
export { analyzeContent }

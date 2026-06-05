/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useMemo } from 'react'
import { htmlToText } from 'html-to-text'
import {
  ChevronDownIcon,
  CheckCircledIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon,
} from '@radix-ui/react-icons'

/**
 * SEO Analyzer — content-type-aware scoring grounded in current Google guidance.
 *
 * The score is a percentage of points achievable for THIS post's content type,
 * so a 40-word note isn't judged against the same rubric as a 2000-word guide.
 * Every item shows its score/weight inline. Items are sorted with the biggest
 * gaps first so the highest-impact fix is always at the top.
 *
 * Scoring philosophy (Jun 2026):
 *   - Word count is NOT a ranking factor (Mueller, WordCamp US 2025). Substance
 *     is a soft floor, not a ladder.
 *   - Heading order is NOT a ranking factor (Google 2024 clarification). Headings
 *     help AI parsing and accessibility, not strict H1→H6 hierarchy.
 *   - Meta description length is NOT a ranking factor — it's CTR and AI preview.
 *   - Title↔body alignment IS a real signal: Google rewrites titles ~76% of the
 *     time when they don't reflect content.
 *   - Lists / structured Q&A get ~2.7× the AI citation rate (Relixir 2025).
 *   - Internal links are a strong, underused signal (Backlinko: pages with 40+
 *     internal links get 4× more organic traffic).
 *   - Alt text is officially for accessibility, not SEO — but indirectly helps.
 */

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from',
  'is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','must','shall','can','this','that',
  'these','those','i','you','he','she','it','we','they','what','which','who','when',
  'where','why','how','all','each','every','both','few','more','most','other','some',
  'such','no','nor','not','only','own','same','so','than','too','very','just','also',
  'now','here','there','then','if','because','as','until','while','about','against',
  'between','into','through','during','before','after','above','below','up','down',
  'out','off','over','under','again','further','once','my','your','our','their','his',
  'her','its','them','onto','upon','also'
])

// Generic / boilerplate titles Google often rewrites in SERPs.
const VAGUE_TITLES = /^(home|about|page|post|posts|blog|contact|welcome|new post|untitled|hello|hi|test|draft|note)$/i

function detectContentType(wordCount) {
  if (wordCount <= 50) return 'micro'
  if (wordCount <= 200) return 'short'
  if (wordCount <= 1200) return 'standard'
  return 'longform'
}

const CONTENT_TYPE_LABEL = {
  micro: 'micro',
  short: 'short-form',
  standard: 'standard',
  longform: 'long-form',
}

// Max points per criterion, adjusted for content type. 0 means the criterion
// doesn't apply (it's omitted from both achieved and max).
const WEIGHTS = {
  title:       { micro: 18, short: 16, standard: 14, longform: 12 },
  alignment:   { micro:  0, short:  8, standard: 10, longform: 12 },
  lede:        { micro:  0, short:  0, standard:  8, longform: 10 },
  substance:   { micro:  8, short:  8, standard:  8, longform:  6 },
  structure:   { micro:  0, short:  0, standard: 10, longform: 12 },
  readability: { micro:  0, short:  8, standard: 10, longform: 10 },
  excerpt:     { micro: 12, short: 12, standard: 10, longform:  8 },
  links:       { micro:  0, short:  5, standard: 10, longform: 12 },
  media:       { micro:  0, short:  4, standard:  6, longform:  6 },
  lists:       { micro:  0, short:  4, standard:  8, longform:  8 },
  cadence:     { micro:  0, short:  5, standard:  6, longform:  4 },
}

// --- Utilities ---

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '')
  if (word.length <= 3) return 1
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
  word = word.replace(/^y/, '')
  const matches = word.match(/[aeiouy]{1,2}/g)
  return matches ? matches.length : 1
}

function readabilityMetrics(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.length > 0)
  if (sentences.length === 0 || words.length === 0) {
    return { grade: 0, sentenceCount: 0, avgWordsPerSentence: 0 }
  }
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0)
  const avgWordsPerSentence = words.length / sentences.length
  const grade =
    0.39 * avgWordsPerSentence +
    11.8 * (syllables / words.length) -
    15.59
  return {
    grade: Math.round(Math.max(0, Math.min(20, grade)) * 10) / 10,
    sentenceCount: sentences.length,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
  }
}

function meaningfulWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w))
}

function topContentWords(plainText, limit = 8) {
  const freq = {}
  meaningfulWords(plainText).forEach(w => {
    freq[w] = (freq[w] || 0) + 1
  })
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w)
}

// --- Criterion evaluators ---
// Each returns { id, label, weight, score, status, message, why?, fix? }
// or null to opt out (not enough data to judge fairly).

function evaluateTitle(plainTitle, weight) {
  const trimmed = (plainTitle || '').trim()
  if (!trimmed) {
    return {
      id: 'title', label: 'Title', weight, score: 0, status: 'miss',
      message: 'No title set',
      why: 'Title is the single strongest on-page signal you control. Google rewrites missing or vague titles in search results.',
      fix: 'Write a 50–60 character title that names the topic.',
    }
  }
  if (VAGUE_TITLES.test(trimmed) || trimmed.length < 5) {
    return {
      id: 'title', label: 'Title', weight, score: Math.round(weight * 0.2), status: 'miss',
      message: `"${trimmed}" — too generic`,
      why: 'A 2025 Q1 study found Google rewrites ~76% of titles it considers generic, boilerplate, or off-topic. The rewrite is rarely what you\'d pick.',
      fix: 'Be specific about what the post is about.',
    }
  }
  const len = trimmed.length
  // Google's display ceiling is ~60 chars (600px desktop). Length itself isn't
  // a ranking factor — but truncation hurts CTR.
  if (len < 20) {
    return {
      id: 'title', label: 'Title', weight, score: Math.round(weight * 0.55), status: 'partial',
      message: `${len} chars — light on context`,
      why: 'Around 50–60 chars gives Google enough context and uses the full SERP display width.',
      fix: 'Add a few descriptive words.',
    }
  }
  if (len <= 60) {
    return {
      id: 'title', label: 'Title', weight, score: weight, status: 'win',
      message: `${len} chars — fits SERP display`,
    }
  }
  if (len <= 70) {
    return {
      id: 'title', label: 'Title', weight, score: Math.round(weight * 0.8), status: 'partial',
      message: `${len} chars — tail may truncate`,
      why: 'Google shows the first ~60 chars in SERPs and trims the rest. Length isn\'t a ranking penalty, but truncation hurts CTR.',
      fix: 'Tighten to ~60 chars to keep the full title visible.',
    }
  }
  return {
    id: 'title', label: 'Title', weight, score: Math.round(weight * 0.55), status: 'partial',
    message: `${len} chars — will truncate`,
    why: 'Google displays ~60 chars in SERPs. Past that, the rest is cut.',
    fix: 'Trim; move detail into the excerpt.',
  }
}

function evaluateAlignment(plainTitle, plainContent, weight, contentType) {
  if (weight === 0) return null
  const bodyWords = plainContent.split(/\s+/).filter(w => w.length > 0).length
  if (bodyWords < 50) return null
  const top = new Set(topContentWords(plainContent, 8))
  const titleTokens = meaningfulWords(plainTitle || '')
  if (titleTokens.length === 0) {
    return {
      id: 'alignment', label: 'Title ↔ body match', weight, score: 0, status: 'miss',
      message: 'Title has no substantive keywords',
      why: 'When Google can\'t match title keywords to the body, it rewrites the SERP title — and the rewrite rarely matches your voice.',
      fix: 'Include the main topic word(s) in the title.',
    }
  }
  const overlap = titleTokens.filter(w => top.has(w)).length
  const ratio = overlap / Math.min(titleTokens.length, 5)
  if (ratio >= 0.4) {
    return {
      id: 'alignment', label: 'Title ↔ body match', weight, score: weight, status: 'win',
      message: `Title echoes ${overlap} key term${overlap === 1 ? '' : 's'}`,
    }
  }
  if (ratio >= 0.2) {
    return {
      id: 'alignment', label: 'Title ↔ body match', weight, score: Math.round(weight * 0.6), status: 'partial',
      message: `${overlap} overlapping term${overlap === 1 ? '' : 's'}`,
      why: 'Stronger title↔body keyword overlap lowers the chance Google rewrites your SERP title.',
      fix: 'Surface one more body keyword in the title.',
    }
  }
  return {
    id: 'alignment', label: 'Title ↔ body match', weight, score: Math.round(weight * 0.2), status: 'miss',
    message: 'Title and body share little vocabulary',
    why: 'Google rewrote titles in ~76% of cases where they didn\'t reflect content keywords (2025 study). The body wins this fight; align the title to it.',
    fix: 'Bring the main topic word(s) into the title.',
  }
}

function evaluateLede(content, plainTitle, weight) {
  if (weight === 0) return null
  const firstParaMatch = (content || '').match(/<p[^>]*>([\s\S]*?)<\/p>/i)
  if (!firstParaMatch) return null
  const text = htmlToText(firstParaMatch[0], { wordwrap: false }).trim()
  if (text.length < 30) {
    return {
      id: 'lede', label: 'Opening paragraph', weight, score: 0, status: 'miss',
      message: text.length === 0 ? 'Opens with a non-paragraph element' : `${text.length} chars — too thin`,
      why: 'When the excerpt is missing or unfit, Google synthesizes the SERP snippet from the first paragraph. AI assistants quote it too.',
      fix: 'Open with 2–3 sentences that summarize the post\'s main point.',
    }
  }
  const titleTokens = new Set(meaningfulWords(plainTitle || ''))
  const ledeTokens = meaningfulWords(text)
  const overlap = ledeTokens.filter(t => titleTokens.has(t)).length
  if (text.length >= 100 && overlap >= 1) {
    return {
      id: 'lede', label: 'Opening paragraph', weight, score: weight, status: 'win',
      message: 'Strong opening — anchors the topic',
    }
  }
  if (text.length >= 100) {
    return {
      id: 'lede', label: 'Opening paragraph', weight, score: Math.round(weight * 0.6), status: 'partial',
      message: 'Opening doesn\'t echo the title',
      why: 'Mentioning the title topic in the first paragraph reinforces relevance for both search snippets and AI extraction.',
      fix: 'Drop one topic word from the title into the opening.',
    }
  }
  return {
    id: 'lede', label: 'Opening paragraph', weight, score: Math.round(weight * 0.5), status: 'partial',
    message: `${text.length} chars — could be more substantive`,
    why: 'A fuller opening paragraph gives Google something useful to synthesize into the SERP snippet.',
    fix: 'Expand the opening to 2–3 sentences summarizing the post.',
  }
}

function evaluateSubstance(wordCount, weight, contentType) {
  // Soft floor, not a ladder. Word count is not a ranking signal (Mueller,
  // Sullivan); we only flag content too thin for Google to evaluate topical
  // depth at all.
  const FLOORS = {
    micro:    { floor: 5,    soft: 20,   label: 'a brief note' },
    short:    { floor: 30,   soft: 80,   label: 'a short post' },
    standard: { floor: 150,  soft: 400,  label: 'a standard article' },
    longform: { floor: 600,  soft: 1200, label: 'a longform piece' },
  }
  const t = FLOORS[contentType]
  if (wordCount >= t.soft) {
    return {
      id: 'substance', label: 'Substance', weight, score: weight, status: 'win',
      message: `${wordCount} words — enough body to evaluate`,
    }
  }
  if (wordCount >= t.floor) {
    const ramp = (wordCount - t.floor) / (t.soft - t.floor)
    return {
      id: 'substance', label: 'Substance', weight, score: Math.round(weight * (0.4 + 0.5 * ramp)), status: 'partial',
      message: `${wordCount} words — building`,
      why: 'Google rewards thorough topical coverage, not raw word count — but very thin posts give the algorithm little to evaluate.',
      fix: `Add context, examples, or your own perspective.`,
    }
  }
  return {
    id: 'substance', label: 'Substance', weight, score: Math.round(weight * 0.25), status: 'miss',
    message: `${wordCount} words — too thin`,
    why: 'Word count itself isn\'t a ranking factor, but content this short can\'t demonstrate depth or original perspective.',
    fix: contentType === 'micro' ? 'Even a brief note benefits from one more sentence of context.' : 'Add context, examples, or your own take.',
  }
}

function evaluateStructure(content, wordCount, weight) {
  if (weight === 0) return null
  const h2 = (content?.match(/<h2/gi) || []).length
  const h3 = (content?.match(/<h3/gi) || []).length
  const totalHeads = h2 + h3
  const expected = wordCount > 1500 ? 3 : wordCount > 700 ? 2 : 1
  if (totalHeads === 0) {
    if (wordCount < 500) {
      return null
    }
    return {
      id: 'structure', label: 'Structure', weight, score: 0, status: 'miss',
      message: 'No section headings',
      why: 'Google clarified in 2024 that heading order isn\'t a ranking factor, but headings are how AI assistants extract sections to cite — and how readers skim on mobile.',
      fix: `Add ${expected} section heading${expected > 1 ? 's' : ''}.`,
    }
  }
  if (h2 >= expected) {
    return {
      id: 'structure', label: 'Structure', weight, score: weight, status: 'win',
      message: `${h2} section${h2 > 1 ? 's' : ''}${h3 > 0 ? ` · ${h3} subhead${h3 > 1 ? 's' : ''}` : ''}`,
    }
  }
  const ratio = Math.min(1, totalHeads / expected)
  return {
    id: 'structure', label: 'Structure', weight, score: Math.round(weight * (0.5 + 0.3 * ratio)), status: 'partial',
    message: `${totalHeads} heading${totalHeads > 1 ? 's' : ''} — could use ${expected - totalHeads} more`,
    why: 'More sections give AI engines more atomic blocks to extract and quote in answers.',
    fix: `Aim for ${expected} section heading${expected > 1 ? 's' : ''}.`,
  }
}

function evaluateReadability(plainContent, weight, wordCount) {
  if (weight === 0 || wordCount < 30) return null
  const { grade, sentenceCount, avgWordsPerSentence } = readabilityMetrics(plainContent)

  // No sentence boundaries at all, or one massive run-on. Reading-level scoring
  // is meaningless here — the real problem (and fix) is sentence structure.
  if (sentenceCount === 0 || (sentenceCount === 1 && wordCount > 40)) {
    return {
      id: 'readability', label: 'Readability', weight, score: Math.round(weight * 0.2), status: 'miss',
      message: 'No sentence breaks detected',
      why: 'Content reads as one continuous block. Search snippets, AI summarizers, and screen readers all rely on sentence boundaries to extract meaning.',
      fix: 'Add periods to split the text into separate sentences.',
    }
  }

  // Very long average sentence length is a separate failure mode from "dense
  // vocabulary." Surface the right diagnosis so the fix is actionable.
  if (avgWordsPerSentence > 28) {
    return {
      id: 'readability', label: 'Readability', weight, score: Math.round(weight * 0.3), status: 'miss',
      message: `~${avgWordsPerSentence} words per sentence — run-on`,
      why: 'Sentences averaging 25+ words tax working memory and lose mobile readers. AI extractors also struggle to pull atomic facts from long sentences.',
      fix: 'Aim for 15–20 words per sentence; break at "and" / "but" joins.',
    }
  }

  if (grade <= 9) {
    return {
      id: 'readability', label: 'Readability', weight, score: weight, status: 'win',
      message: `Grade ${grade} — accessible`,
    }
  }
  if (grade <= 12) {
    return {
      id: 'readability', label: 'Readability', weight, score: Math.round(weight * 0.8), status: 'partial',
      message: `Grade ${grade} — moderate`,
      why: 'Google doesn\'t score reading level directly, but engagement (time on page, bounce rate) drops above grade 10 for general audiences.',
      fix: 'Shorter sentences and simpler words broaden reach.',
    }
  }
  if (grade <= 14) {
    return {
      id: 'readability', label: 'Readability', weight, score: Math.round(weight * 0.55), status: 'partial',
      message: `Grade ${grade} — college-level`,
      why: 'Fine for niche/technical audiences; broader topics earn more engagement signals at grade 8–10.',
      fix: 'Break the longest sentences; swap jargon for everyday words where it fits.',
    }
  }
  return {
    id: 'readability', label: 'Readability', weight, score: Math.round(weight * 0.3), status: 'miss',
    message: `Grade ${grade} — very dense vocabulary`,
    why: 'Multi-syllable, jargon-heavy text suppresses engagement signals (bounce, dwell time) that indirectly affect ranking.',
    fix: 'Replace jargon with everyday words where it fits.',
  }
}

function evaluateExcerpt(plainExcerpt, weight) {
  const len = plainExcerpt.length
  if (len === 0) {
    return {
      id: 'excerpt', label: 'Excerpt', weight, score: 0, status: 'miss',
      message: 'Missing',
      why: 'Not a ranking factor, but the excerpt is what shows under your title in search results, social cards, and AI previews. Without one, Google synthesizes its own — often badly.',
      fix: 'Write a 140–160 char hook in your own voice.',
    }
  }
  if (len >= 140 && len <= 160) {
    return {
      id: 'excerpt', label: 'Excerpt', weight, score: weight, status: 'win',
      message: `${len} chars — uses full snippet width`,
    }
  }
  if (len >= 100 && len < 140) {
    return {
      id: 'excerpt', label: 'Excerpt', weight, score: Math.round(weight * 0.85), status: 'partial',
      message: `${len} chars — leaves space unused`,
      why: 'Within range, but a bit longer would fill more SERP and social-card real estate.',
    }
  }
  if (len > 160 && len <= 180) {
    return {
      id: 'excerpt', label: 'Excerpt', weight, score: Math.round(weight * 0.75), status: 'partial',
      message: `${len} chars — slight overflow risk`,
      why: 'Google truncates around 155–160 chars in search results.',
    }
  }
  if (len > 180) {
    return {
      id: 'excerpt', label: 'Excerpt', weight, score: Math.round(weight * 0.4), status: 'miss',
      message: `${len} chars — will truncate`,
      why: 'Excerpts past ~160 chars get cut mid-sentence in SERPs and social previews.',
      fix: 'Trim to 140–160 chars.',
    }
  }
  // 1-99 chars
  return {
    id: 'excerpt', label: 'Excerpt', weight, score: Math.round(weight * 0.5), status: 'partial',
    message: `${len} chars — too brief for snippet space`,
    why: 'A fuller excerpt converts better in search results and gives AI a richer preview to quote.',
    fix: 'Expand to 140–160 chars.',
  }
}

function evaluateLinks(content, weight) {
  if (weight === 0) return null
  const matches = [...(content || '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)]
  let internal = 0
  let external = 0
  for (const m of matches) {
    const href = m[1] || ''
    if (/^https?:\/\//i.test(href)) external += 1
    else if (href.startsWith('/') || href.startsWith('#')) internal += 1
  }
  const total = internal + external
  if (total === 0) {
    return {
      id: 'links', label: 'Links', weight, score: 0, status: 'miss',
      message: 'No links',
      why: 'Backlinko found pages with 40+ internal links get ~4× more organic traffic. External links signal research depth and give AI engines citations to follow.',
      fix: 'Link to 1–2 related posts and 1–2 outside sources.',
    }
  }
  if (internal >= 1 && external >= 1) {
    return {
      id: 'links', label: 'Links', weight, score: weight, status: 'win',
      message: `${internal} internal · ${external} external`,
    }
  }
  if (external >= 1 && internal === 0) {
    return {
      id: 'links', label: 'Links', weight, score: Math.round(weight * 0.55), status: 'partial',
      message: `${external} external · 0 internal`,
      why: 'Internal links help Google map your site\'s topical structure. A 2025 study found bi-directional internal linking lifts AI citation rates ~2.7×.',
      fix: 'Link to one or two of your related posts.',
    }
  }
  if (internal >= 1 && external === 0) {
    return {
      id: 'links', label: 'Links', weight, score: Math.round(weight * 0.7), status: 'partial',
      message: `${internal} internal · 0 external`,
      why: 'External links to credible sources signal research depth and give AI engines citations to follow.',
      fix: 'Link to one or two outside references.',
    }
  }
  return null
}

function evaluateMedia(content, weight, wordCount) {
  if (weight === 0) return null
  const imgs = content?.match(/<img[^>]*>/gi) || []
  if (imgs.length === 0) {
    if (wordCount < 250) {
      return {
        id: 'media', label: 'Media', weight, score: Math.round(weight * 0.5), status: 'partial',
        message: 'No images',
        why: 'Optional at this length, but an image gives social cards something to render.',
      }
    }
    return {
      id: 'media', label: 'Media', weight, score: 0, status: 'miss',
      message: 'No images',
      why: 'Not a direct ranking signal, but images give social and AI previews something to display, which lifts click-through.',
      fix: 'Add a relevant image.',
    }
  }
  const withAlt = imgs.filter(t => /alt\s*=\s*["'][^"']+["']/i.test(t)).length
  if (withAlt === imgs.length) {
    return {
      id: 'media', label: 'Media', weight, score: weight, status: 'win',
      message: `${imgs.length} image${imgs.length > 1 ? 's' : ''} — all with alt text`,
    }
  }
  return {
    id: 'media', label: 'Media', weight, score: Math.round(weight * 0.6), status: 'partial',
    message: `${imgs.length} image${imgs.length > 1 ? 's' : ''} · ${imgs.length - withAlt} missing alt text`,
    why: 'Google says alt text is primarily for accessibility (WCAG 1.1.1), not direct SEO — but it\'s how screen readers, image search, and AI describe the image.',
    fix: 'Add alt text to every image.',
  }
}

function evaluateLists(content, weight, wordCount) {
  if (weight === 0) return null
  const lists = (content?.match(/<(ul|ol)/gi) || []).length
  if (lists >= 1) {
    return {
      id: 'lists', label: 'Lists', weight, score: weight, status: 'win',
      message: `${lists} list${lists > 1 ? 's' : ''} — AI-quotable`,
    }
  }
  if (wordCount < 500) {
    return {
      id: 'lists', label: 'Lists', weight, score: Math.round(weight * 0.6), status: 'partial',
      message: 'No lists — optional at this length',
      why: 'Lists are optional in short posts, but they\'re the format AI assistants quote most often.',
    }
  }
  return {
    id: 'lists', label: 'Lists', weight, score: 0, status: 'miss',
    message: 'No bulleted or numbered lists',
    why: 'A 2025 Relixir study found pages with bulleted / FAQ-style content get cited ~2.7× more often by AI search engines.',
    fix: 'Convert a paragraph of items into a bullet list.',
  }
}

function evaluateCadence(content, weight) {
  if (weight === 0) return null
  const paragraphs = (content || '').match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []
  if (paragraphs.length === 0) return null
  const counts = paragraphs
    .map(p => {
      const txt = htmlToText(p, { wordwrap: false })
      if (!txt.trim()) return 0
      return Math.max(1, (txt.match(/[.!?]+/g) || []).length)
    })
    .filter(c => c > 0)
  if (counts.length === 0) return null
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length
  const rounded = avg.toFixed(1)
  if (avg <= 3) {
    return {
      id: 'cadence', label: 'Paragraph rhythm', weight, score: weight, status: 'win',
      message: `~${rounded} sentences per paragraph`,
    }
  }
  if (avg <= 5) {
    return {
      id: 'cadence', label: 'Paragraph rhythm', weight, score: Math.round(weight * 0.6), status: 'partial',
      message: `~${rounded} sentences per paragraph`,
      why: '1–3 sentence paragraphs read best on mobile, where most search traffic lands.',
      fix: 'Break a few of the longer paragraphs in two.',
    }
  }
  return {
    id: 'cadence', label: 'Paragraph rhythm', weight, score: Math.round(weight * 0.25), status: 'miss',
    message: `~${rounded} sentences per paragraph — dense`,
    why: 'Walls of text spike bounce rate on mobile, which feeds back into ranking via engagement signals.',
    fix: 'Break paragraphs every 2–3 sentences.',
  }
}

function getVerdict(score) {
  if (score >= 90) return { label: 'Excellent', tone: 'Well-tuned for search and AI discovery.' }
  if (score >= 75) return { label: 'Solid', tone: 'A small tweak or two would push this further.' }
  if (score >= 55) return { label: 'Decent', tone: 'Focus on the items flagged at the top.' }
  return { label: 'Needs work', tone: 'Title and excerpt are usually the quickest wins.' }
}

/**
 * Analyze title/content/excerpt and return scoring + per-item insights.
 * Returns: { score 0..100, items[], contentType, wordCount,
 *            achievedPoints, maxPoints, verdict }
 */
function analyzeContent(title, content, excerpt) {
  const plainContent = htmlToText(content || '', { wordwrap: false })
  const plainTitle = htmlToText(title || '', { wordwrap: false })
  const plainExcerpt = excerpt ? htmlToText(excerpt, { wordwrap: false }) : ''
  const wordCount = plainContent.split(/\s+/).filter(w => w.length > 0).length
  const contentType = detectContentType(wordCount)
  const w = name => WEIGHTS[name][contentType]

  const items = [
    evaluateTitle(plainTitle, w('title')),
    evaluateAlignment(plainTitle, plainContent, w('alignment'), contentType),
    evaluateLede(content, plainTitle, w('lede')),
    evaluateSubstance(wordCount, w('substance'), contentType),
    evaluateStructure(content, wordCount, w('structure')),
    evaluateReadability(plainContent, w('readability'), wordCount),
    evaluateExcerpt(plainExcerpt, w('excerpt')),
    evaluateLinks(content, w('links')),
    evaluateMedia(content, w('media'), wordCount),
    evaluateLists(content, w('lists'), wordCount),
    evaluateCadence(content, w('cadence')),
  ].filter(Boolean)

  const maxPoints = items.reduce((s, i) => s + i.weight, 0)
  const achievedPoints = items.reduce((s, i) => s + i.score, 0)
  const score = maxPoints === 0 ? 0 : Math.round((achievedPoints / maxPoints) * 100)

  // Sort: misses first, then partials, then wins. Inside each group, biggest gap first.
  const statusOrder = { miss: 0, partial: 1, win: 2 }
  items.sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status]
    }
    const gapA = a.weight - a.score
    const gapB = b.weight - b.score
    if (gapA !== gapB) return gapB - gapA
    return b.weight - a.weight
  })

  return {
    score,
    items,
    contentType,
    wordCount,
    achievedPoints,
    maxPoints,
    verdict: getVerdict(score),
  }
}

const StatusIcon = ({ status }) => {
  if (status === 'win') {
    return <CheckCircledIcon width={14} height={14} css={css`color: #4D96FF; opacity: 0.9; flex-shrink: 0;`} />
  }
  if (status === 'partial') {
    return <InfoCircledIcon width={14} height={14} css={css`color: var(--grey-4); opacity: 0.7; flex-shrink: 0;`} />
  }
  return <ExclamationTriangleIcon width={14} height={14} css={css`color: #ff3e00; opacity: 0.9; flex-shrink: 0;`} />
}

export default function SEOAnalyzer({ title, content, excerpt, isExpanded = false, onToggle }) {
  const [expanded, setExpanded] = useState(isExpanded)

  const analysis = useMemo(
    () => analyzeContent(title, content, excerpt),
    [title, content, excerpt]
  )

  const handleToggle = () => {
    setExpanded(!expanded)
    if (onToggle) onToggle(!expanded)
  }

  const ringColor =
    analysis.score >= 90 ? '#A66CFF' :
    analysis.score >= 75 ? '#4D96FF' :
    analysis.score >= 55 ? '#ff3e00' :
    '#E23E57'

  return (
    <div
      css={css`
        border: 1px solid var(--grey-2);
        border-radius: 0.5rem;
        background: var(--grey-1);
        overflow: hidden;
      `}
    >
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

          &:hover { background: var(--grey-2); }
        `}
      >
        <div css={css`display: flex; align-items: center; gap: 0.6rem; min-width: 0;`}>
          <div
            css={css`
              width: 28px;
              height: 28px;
              border-radius: 50%;
              border: 2px solid ${ringColor};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 0.7rem;
              font-weight: 600;
              color: ${ringColor};
              flex-shrink: 0;
              font-variant-numeric: tabular-nums;
            `}
          >
            {analysis.score}
          </div>
          <div css={css`text-align: left; display: flex; flex-direction: column; gap: 0.1rem; min-width: 0;`}>
            <div css={css`display: flex; align-items: center; gap: 0.4rem;`}>
              <span css={css`font-size: 0.8rem; font-weight: 500; color: var(--grey-4);`}>
                {analysis.verdict.label}
              </span>
              <span css={css`
                font-size: 0.6rem;
                color: var(--grey-3);
                padding: 0.05rem 0.35rem;
                background: var(--grey-2);
                border-radius: 0.25rem;
              `}>
                {CONTENT_TYPE_LABEL[analysis.contentType]}
              </span>
            </div>
            <span css={css`font-size: 0.65rem; color: var(--grey-3); font-variant-numeric: tabular-nums;`}>
              {analysis.achievedPoints} of {analysis.maxPoints} pts · {analysis.wordCount} word{analysis.wordCount === 1 ? '' : 's'}
            </span>
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

      {expanded && (
        <div
          css={css`
            padding: 0.5rem 0.75rem 0.75rem;
            border-top: 1px solid var(--grey-2);
          `}
        >
          <div css={css`display: flex; flex-direction: column; gap: 0.4rem;`}>
            {analysis.items.map(item => (
              <div
                key={item.id}
                css={css`
                  padding: 0.45rem 0.55rem;
                  border-radius: 0.375rem;
                  background: ${item.status === 'win' ? 'transparent' : 'var(--grey-2)'};
                  border: 1px solid ${item.status === 'win' ? 'var(--grey-2)' : 'transparent'};
                `}
              >
                <div css={css`display: flex; align-items: center; gap: 0.5rem;`}>
                  <StatusIcon status={item.status} />
                  <span css={css`
                    font-size: 0.75rem;
                    color: var(--grey-4);
                    flex: 1;
                    min-width: 0;
                  `}>
                    <strong css={css`font-weight: 500;`}>{item.label}</strong>
                    <span css={css`color: var(--grey-3); margin-left: 0.3rem;`}>
                      {item.message}
                    </span>
                  </span>
                  <span css={css`
                    font-size: 0.65rem;
                    color: var(--grey-3);
                    font-variant-numeric: tabular-nums;
                    flex-shrink: 0;
                  `}>
                    {item.score}/{item.weight}
                  </span>
                </div>
                {item.status !== 'win' && (item.fix || item.why) && (
                  <div css={css`
                    margin-top: 0.3rem;
                    padding-left: 1.25rem;
                    font-size: 0.68rem;
                    color: var(--grey-3);
                    line-height: 1.45;
                  `}>
                    {item.fix || item.why}
                  </div>
                )}
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
              {analysis.verdict.tone}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export { analyzeContent }

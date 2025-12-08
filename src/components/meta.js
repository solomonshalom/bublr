// Use as a function, not a component. For example:
//   meta({title: 'cool title', description: 'cool desc', url: '/cool'})
// Instead of:
//   <Meta title="cool title" description="cool desc" url="/cool" />

/**
 * Comprehensive meta tag generator for SEO and GEO optimization
 *
 * Includes:
 * - Primary meta tags (title, description, keywords)
 * - Open Graph tags (Facebook, LinkedIn)
 * - Twitter Card tags
 * - Dublin Core metadata (academic/institutional SEO)
 * - GEO tags for AI search engines
 * - Article-specific tags for blog posts
 */
export default function meta({
  title,
  description,
  url,
  image,
  type,
  keywords,
  // Article-specific fields
  author,
  authorName,
  publishedTime,
  modifiedTime,
  readingTime,
  section,
  wordCount,
  // GEO-specific fields
  citationTitle,
  citationAuthor,
  citationDate
}) {
  // We prefix relative urls with the VERCEL_URL that vercel sets for us on deployments
  const baseUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://bublr.life'
      : 'https://' + process.env.VERCEL_URL

  if (url) {
    url = url.startsWith('/') ? baseUrl + url : url
  }

  if (image) {
    image = image.startsWith('/') ? baseUrl + image : image
  }

  // Default keywords for the site
  const defaultKeywords = 'writing, blog, minimal, writing community, open source, bublr'

  // Ensure description is not too long (Google truncates at ~160 chars)
  const truncatedDescription = description && description.length > 160
    ? description.substring(0, 157) + '...'
    : description

  // Generate current date for freshness signals
  const currentYear = new Date().getFullYear()
  const currentDate = new Date().toISOString().split('T')[0]

  return (
    <>
      {/* ============================================ */}
      {/* PRIMARY META TAGS */}
      {/* ============================================ */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={truncatedDescription} />
      <meta name="keywords" content={keywords || defaultKeywords} />

      {/* ============================================ */}
      {/* OPEN GRAPH / FACEBOOK */}
      {/* ============================================ */}
      <meta property="og:type" content={type || 'website'} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={truncatedDescription} />
      <meta property="og:site_name" content="Bublr" />
      <meta property="og:locale" content="en_US" />
      {image && (
        <>
          <meta property="og:image" content={image} />
          <meta property="og:image:secure_url" content={image} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:image:alt" content={title} />
          <meta property="og:image:type" content="image/png" />
        </>
      )}

      {/* Article-specific Open Graph tags */}
      {type === 'article' && (
        <>
          {publishedTime && <meta property="article:published_time" content={publishedTime} />}
          {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
          {author && <meta property="article:author" content={author} />}
          {section && <meta property="article:section" content={section} />}
          <meta property="article:tag" content="blog" />
          <meta property="article:tag" content="writing" />
          {keywords && keywords.split(',').slice(0, 5).map((tag, i) => (
            <meta key={`og-tag-${i}`} property="article:tag" content={tag.trim()} />
          ))}
        </>
      )}

      {/* ============================================ */}
      {/* TWITTER CARD */}
      {/* ============================================ */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@bublr" />
      <meta name="twitter:creator" content="@bublr" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={truncatedDescription} />
      {image && (
        <>
          <meta name="twitter:image" content={image} />
          <meta name="twitter:image:alt" content={title} />
        </>
      )}
      {readingTime && <meta name="twitter:label1" content="Reading time" />}
      {readingTime && <meta name="twitter:data1" content={`${readingTime} min read`} />}
      {wordCount && <meta name="twitter:label2" content="Word count" />}
      {wordCount && <meta name="twitter:data2" content={`${wordCount} words`} />}

      {/* ============================================ */}
      {/* DUBLIN CORE METADATA */}
      {/* Academic/institutional SEO for better indexing */}
      {/* ============================================ */}
      <meta name="DC.title" content={title} />
      <meta name="DC.description" content={truncatedDescription} />
      <meta name="DC.publisher" content="Bublr" />
      <meta name="DC.language" content="en" />
      <meta name="DC.type" content={type === 'article' ? 'Text.Article' : 'Text'} />
      <meta name="DC.format" content="text/html" />
      <meta name="DC.rights" content={`Copyright ${currentYear} Bublr`} />
      {authorName && <meta name="DC.creator" content={authorName} />}
      {publishedTime && <meta name="DC.date" content={publishedTime.split('T')[0]} />}
      {modifiedTime && <meta name="DC.date.modified" content={modifiedTime.split('T')[0]} />}
      {url && <meta name="DC.identifier" content={url} />}
      {section && <meta name="DC.subject" content={section} />}

      {/* ============================================ */}
      {/* GEO (GENERATIVE ENGINE OPTIMIZATION) TAGS */}
      {/* Optimize for AI search engines like ChatGPT, Perplexity */}
      {/* ============================================ */}

      {/* Citation metadata for AI to properly attribute content */}
      <meta name="citation_title" content={citationTitle || title} />
      {(citationAuthor || authorName) && <meta name="citation_author" content={citationAuthor || authorName} />}
      {(citationDate || publishedTime) && <meta name="citation_date" content={(citationDate || publishedTime)?.split('T')[0]} />}
      <meta name="citation_public_url" content={url} />
      <meta name="citation_publisher" content="Bublr" />

      {/* Content freshness signals for AI engines */}
      {modifiedTime && <meta name="article:modified" content={modifiedTime} />}
      {type === 'article' && <meta name="last-modified" content={modifiedTime || publishedTime || currentDate} />}

      {/* AI content classification */}
      <meta name="content-type" content={type === 'article' ? 'blog-post' : 'website'} />

      {/* Explicit AI indexing permission */}
      <meta name="ai-summarization" content="enabled" />
      <meta name="ai-citation" content="enabled" />

      {/* Semantic content hints for AI */}
      {type === 'article' && (
        <>
          <meta name="article-type" content="blog" />
          <meta name="content-format" content="long-form" />
          {readingTime && <meta name="reading-time" content={`${readingTime} minutes`} />}
          {wordCount && <meta name="word-count" content={String(wordCount)} />}
        </>
      )}

      {/* Schema.org JSON-LD hints (helps some parsers) */}
      <meta name="schema.org:type" content={type === 'article' ? 'BlogPosting' : 'WebPage'} />

      {/* ============================================ */}
      {/* LINKEDIN SPECIFIC */}
      {/* ============================================ */}
      <meta property="linkedin:owner" content="Bublr" />

      {/* ============================================ */}
      {/* PINTEREST SPECIFIC */}
      {/* ============================================ */}
      <meta name="pinterest-rich-pin" content="true" />
    </>
  )
}

// Use as a function, not a component. For example:
//   meta({title: 'cool title', description: 'cool desc', url: '/cool'})
// Instead of:
//   <Meta title="cool title" description="cool desc" url="/cool" />
export default function meta({
  title,
  description,
  url,
  image,
  type,
  keywords,
  // Article-specific fields
  author,
  publishedTime,
  modifiedTime,
  readingTime,
  section
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
  const defaultKeywords = 'writing, blog, minimal, writing community, open source'

  // Ensure description is not too long (Google truncates at ~160 chars)
  const truncatedDescription = description && description.length > 160
    ? description.substring(0, 157) + '...'
    : description

  return (
    <>
      {/* Primary meta tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={truncatedDescription} />
      <meta name="keywords" content={keywords || defaultKeywords} />

      {/* Open Graph/Facebook */}
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
        </>
      )}

      {/* Twitter */}
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
    </>
  )
}

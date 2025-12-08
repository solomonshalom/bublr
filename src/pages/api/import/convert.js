// Unified API endpoint to convert article content from multiple platforms to TipTap format
// Each platform has specific cleaning requirements

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { content, title, platform = 'medium' } = req.body

  if (!content) {
    return res.status(400).json({ error: 'Content is required' })
  }

  try {
    // Clean and convert the HTML to TipTap-compatible format
    const cleanedContent = convertToTipTap(content, platform)

    return res.status(200).json({
      success: true,
      title: title || '',
      content: cleanedContent,
    })
  } catch (error) {
    console.error('Conversion error:', error)
    return res.status(500).json({
      error: 'Failed to convert article',
      details: error.message,
    })
  }
}

// Main conversion function with platform-specific handling
function convertToTipTap(html, platform) {
  if (!html) return ''

  let content = html

  // Apply platform-specific cleaning first
  switch (platform) {
    case 'medium':
      content = cleanMediumContent(content)
      break
    case 'substack':
      content = cleanSubstackContent(content)
      break
    case 'blogger':
      content = cleanBloggerContent(content)
      break
    case 'hashnode':
      content = cleanHashnodeContent(content)
      break
    case 'wordpress':
      content = cleanWordPressContent(content)
      break
    case 'ghost':
      content = cleanGhostContent(content)
      break
    case 'devto':
      content = cleanDevToContent(content)
      break
    default:
      // Generic cleaning for unknown platforms
      break
  }

  // Apply universal cleaning
  content = applyUniversalCleaning(content)

  return content
}

// Medium-specific cleaning
function cleanMediumContent(html) {
  let content = html

  // Remove Medium-specific elements
  content = content.replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, (match) => {
    const imgMatch = match.match(/<img[^>]+src="([^">]+)"[^>]*>/i)
    if (imgMatch) {
      return `<img src="${imgMatch[1]}" />`
    }
    return ''
  })

  // Remove Medium's tracking pixels
  content = content.replace(/<img[^>]*medium\.com\/stat[^>]*>/gi, '')
  content = content.replace(/<img[^>]*1x1[^>]*>/gi, '')

  // Remove "Continue reading" links
  content = content.replace(/<a[^>]*>Continue reading[^<]*<\/a>/gi, '')
  content = content.replace(/\.\.\.\s*$/g, '')

  // Remove Medium attribution
  content = content.replace(/<p>.*Originally published.*<\/p>/gi, '')

  // Remove trailing Medium links
  content = content.replace(/<p>\s*<a[^>]*medium\.com[^>]*>.*?<\/a>\s*<\/p>/gi, '')

  return content
}

// Substack-specific cleaning
function cleanSubstackContent(html) {
  let content = html

  // Remove Substack-specific elements
  content = content.replace(/<div class="subscription-widget[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
  content = content.replace(/<div class="subscribe-widget[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
  content = content.replace(/<div class="captioned-image-container"[^>]*>([\s\S]*?)<\/div>/gi, '$1')

  // Clean Substack image wrappers
  content = content.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, (match) => {
    const imgMatch = match.match(/<img[^>]+src="([^">]+)"[^>]*>/i)
    if (imgMatch) {
      return `<img src="${imgMatch[1]}" />`
    }
    return ''
  })

  // Remove share buttons
  content = content.replace(/<div class="share[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')

  // Remove "Subscribe" CTAs
  content = content.replace(/<a[^>]*class="[^"]*subscribe[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')

  // Remove Substack footer content
  content = content.replace(/<div class="post-footer[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')

  return content
}

// Blogger/Blogspot-specific cleaning
function cleanBloggerContent(html) {
  let content = html

  // Remove Blogger-specific divs
  content = content.replace(/<div class="blogger-post-footer">[\s\S]*?<\/div>/gi, '')
  content = content.replace(/<div class="post-footer">[\s\S]*?<\/div>/gi, '')

  // Remove share widgets
  content = content.replace(/<div class="post-share-buttons[^"]*">[\s\S]*?<\/div>/gi, '')

  // Clean up Blogger image containers
  content = content.replace(/<div class="separator"[^>]*>([\s\S]*?)<\/div>/gi, '$1')

  // Remove "Read more" links that Blogger adds
  content = content.replace(/<a[^>]*name="more"[^>]*><\/a>/gi, '')

  return content
}

// Hashnode-specific cleaning
function cleanHashnodeContent(html) {
  let content = html

  // Remove Hashnode-specific elements
  content = content.replace(/<div class="embed[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')

  // Clean code blocks - Hashnode uses specific syntax highlighting
  content = content.replace(/<pre[^>]*data-language="([^"]*)"[^>]*>/gi, '<pre>')

  // Remove reaction widgets
  content = content.replace(/<div class="reactions[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')

  return content
}

// WordPress-specific cleaning
function cleanWordPressContent(html) {
  let content = html

  // Remove WordPress blocks
  content = content.replace(/<!-- wp:[^>]*-->/gi, '')
  content = content.replace(/<!-- \/wp:[^>]*-->/gi, '')

  // Remove WordPress gallery wrappers but keep images
  content = content.replace(/<div class="wp-block-gallery[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '$1')

  // Clean WordPress image containers
  content = content.replace(/<figure class="wp-block-image[^"]*"[^>]*>([\s\S]*?)<\/figure>/gi, (match) => {
    const imgMatch = match.match(/<img[^>]+src="([^">]+)"[^>]*>/i)
    if (imgMatch) {
      return `<img src="${imgMatch[1]}" />`
    }
    return ''
  })

  // Remove WordPress share buttons
  content = content.replace(/<div class="sharedaddy[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')

  // Remove "Like" buttons
  content = content.replace(/<div class="wp-block-jetpack-like[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')

  return content
}

// Ghost-specific cleaning
function cleanGhostContent(html) {
  let content = html

  // Remove Ghost-specific elements
  content = content.replace(/<div class="kg-card[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '$1')

  // Clean Ghost image cards
  content = content.replace(/<figure class="kg-card kg-image-card[^"]*"[^>]*>([\s\S]*?)<\/figure>/gi, (match) => {
    const imgMatch = match.match(/<img[^>]+src="([^">]+)"[^>]*>/i)
    if (imgMatch) {
      return `<img src="${imgMatch[1]}" />`
    }
    return ''
  })

  // Remove Ghost bookmark cards (keep as link)
  content = content.replace(/<figure class="kg-card kg-bookmark-card[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<\/figure>/gi, '<p><a href="$1">$1</a></p>')

  // Remove Ghost embed cards
  content = content.replace(/<figure class="kg-card kg-embed-card[^"]*"[^>]*>[\s\S]*?<\/figure>/gi, '')

  return content
}

// DEV.to-specific cleaning
function cleanDevToContent(html) {
  let content = html

  // DEV.to uses specific liquid tags that might appear in RSS
  content = content.replace(/{% \w+[^%]*%}/gi, '')

  // Remove DEV.to specific embeds
  content = content.replace(/<div class="ltag[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')

  // Clean article tags/badges
  content = content.replace(/<span class="tag[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')

  return content
}

// Universal cleaning applied to all platforms
function applyUniversalCleaning(html) {
  let content = html

  // Remove script tags
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '')

  // Remove style tags
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '')

  // Remove noscript tags
  content = content.replace(/<noscript[\s\S]*?<\/noscript>/gi, '')

  // Remove iframe embeds (usually ads or tracking)
  content = content.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')

  // Clean up empty paragraphs
  content = content.replace(/<p>\s*<\/p>/gi, '')
  content = content.replace(/<p><br\s*\/?><\/p>/gi, '')

  // Convert heading levels (h4+ to h3 for consistency)
  content = content.replace(/<h1[^>]*>/gi, '<h1>')
  content = content.replace(/<h2[^>]*>/gi, '<h2>')
  content = content.replace(/<h3[^>]*>/gi, '<h3>')
  content = content.replace(/<h4[^>]*>/gi, '<h3>')
  content = content.replace(/<\/h4>/gi, '</h3>')
  content = content.replace(/<h5[^>]*>/gi, '<h3>')
  content = content.replace(/<\/h5>/gi, '</h3>')
  content = content.replace(/<h6[^>]*>/gi, '<h3>')
  content = content.replace(/<\/h6>/gi, '</h3>')

  // Remove class and style attributes
  content = content.replace(/\s+class="[^"]*"/gi, '')
  content = content.replace(/\s+style="[^"]*"/gi, '')
  content = content.replace(/\s+id="[^"]*"/gi, '')
  content = content.replace(/\s+data-[a-z-]+="[^"]*"/gi, '')

  // Convert blockquotes
  content = content.replace(/<blockquote[^>]*>/gi, '<blockquote>')

  // Convert code blocks
  content = content.replace(/<pre[^>]*>/gi, '<pre>')
  content = content.replace(/<code[^>]*>/gi, '<code>')

  // Clean up links - keep href only
  content = content.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>/gi, '<a href="$1">')

  // Remove empty links
  content = content.replace(/<a[^>]*>\s*<\/a>/gi, '')

  // Clean up lists
  content = content.replace(/<ul[^>]*>/gi, '<ul>')
  content = content.replace(/<ol[^>]*>/gi, '<ol>')
  content = content.replace(/<li[^>]*>/gi, '<li>')

  // Remove horizontal rules
  content = content.replace(/<hr[^>]*>/gi, '')

  // Clean up multiple consecutive newlines/whitespace
  content = content.replace(/\n{3,}/g, '\n\n')
  content = content.replace(/>\s+</g, '><')

  // Trim whitespace
  content = content.trim()

  return content
}

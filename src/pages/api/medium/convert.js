// API endpoint to convert Medium article content to clean HTML for TipTap editor

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { content, title } = req.body

  if (!content) {
    return res.status(400).json({ error: 'Content is required' })
  }

  try {
    // Clean and convert the Medium HTML to TipTap-compatible format
    const cleanedContent = convertMediumToTipTap(content)

    return res.status(200).json({
      success: true,
      title: title || '',
      content: cleanedContent,
    })
  } catch (error) {
    console.error('Conversion error:', error)
    return res.status(500).json({
      error: 'Failed to convert article',
      details: error.message
    })
  }
}

function convertMediumToTipTap(html) {
  if (!html) return ''

  let content = html

  // Remove Medium-specific elements
  content = content.replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, (match) => {
    // Extract image from figure
    const imgMatch = match.match(/<img[^>]+src="([^">]+)"[^>]*>/i)
    if (imgMatch) {
      return `<img src="${imgMatch[1]}" />`
    }
    return ''
  })

  // Remove script tags
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '')

  // Remove style tags
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '')

  // Remove Medium's tracking pixels and hidden elements
  content = content.replace(/<img[^>]*medium\.com\/stat[^>]*>/gi, '')
  content = content.replace(/<img[^>]*1x1[^>]*>/gi, '')

  // Clean up empty paragraphs
  content = content.replace(/<p>\s*<\/p>/gi, '')
  content = content.replace(/<p><br\s*\/?><\/p>/gi, '')

  // Convert Medium's em/strong nested in other tags properly
  content = content.replace(/<h1[^>]*>/gi, '<h1>')
  content = content.replace(/<h2[^>]*>/gi, '<h2>')
  content = content.replace(/<h3[^>]*>/gi, '<h3>')
  content = content.replace(/<h4[^>]*>/gi, '<h3>') // Convert h4 to h3
  content = content.replace(/<\/h4>/gi, '</h3>')

  // Remove class and style attributes
  content = content.replace(/\s+class="[^"]*"/gi, '')
  content = content.replace(/\s+style="[^"]*"/gi, '')
  content = content.replace(/\s+id="[^"]*"/gi, '')
  content = content.replace(/\s+data-[a-z-]+="[^"]*"/gi, '')

  // Clean up Medium's "Read more" links
  content = content.replace(/<a[^>]*>Continue reading[^<]*<\/a>/gi, '')
  content = content.replace(/\.\.\.\s*$/g, '')

  // Remove any remaining Medium attribution
  content = content.replace(/<p>.*Originally published.*<\/p>/gi, '')

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

  // Remove horizontal rules (Medium uses them decoratively)
  content = content.replace(/<hr[^>]*>/gi, '')

  // Clean up multiple consecutive newlines/whitespace
  content = content.replace(/\n{3,}/g, '\n\n')
  content = content.replace(/>\s+</g, '><')

  // Remove trailing "Continue reading on Medium" type text
  content = content.replace(/<p>\s*<a[^>]*medium\.com[^>]*>.*?<\/a>\s*<\/p>/gi, '')

  // Trim whitespace
  content = content.trim()

  return content
}

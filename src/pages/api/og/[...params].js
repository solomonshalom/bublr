/**
 * Dynamic OG Image Generation API
 *
 * Generates custom Open Graph images for posts and profiles.
 * Uses node-canvas for server-side image generation (Next.js 11 compatible).
 *
 * Usage:
 * - Post: /api/og/post/[username]/[slug]
 * - Profile: /api/og/profile/[username]
 *
 * Query params:
 * - title: Post title (for posts)
 * - author: Author display name
 * - readingTime: Reading time in minutes
 * - avatar: Author avatar URL (optional, will use fallback)
 */

import { createCanvas, registerFont, loadImage } from 'canvas'
import path from 'path'

// OG Image dimensions (recommended by social platforms)
const WIDTH = 1200
const HEIGHT = 630

// Colors
const COLORS = {
  background: '#FCFCFC',
  backgroundDark: '#171717',
  text: '#2B3044',
  textDark: '#FCFCFC',
  muted: '#6f6f6f',
  mutedDark: '#a0a0a0',
  accent: '#cf52f2',
  gradient: ['#cf52f2', '#4D96FF', '#6BCB77']
}

/**
 * Draw rounded rectangle
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

/**
 * Wrap text to fit within a max width
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = ctx.measureText(testLine)

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

/**
 * Generate post OG image
 */
async function generatePostOG({ title, author, readingTime, avatar, theme = 'light' }) {
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  const isDark = theme === 'dark'
  const bgColor = isDark ? COLORS.backgroundDark : COLORS.background
  const textColor = isDark ? COLORS.textDark : COLORS.text
  const mutedColor = isDark ? COLORS.mutedDark : COLORS.muted

  // Background
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Gradient accent bar at top
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, 0)
  gradient.addColorStop(0, COLORS.gradient[0])
  gradient.addColorStop(0.5, COLORS.gradient[1])
  gradient.addColorStop(1, COLORS.gradient[2])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WIDTH, 8)

  // Title
  const cleanTitle = title || 'Untitled'
  ctx.fillStyle = textColor
  ctx.font = 'bold 56px Inter, -apple-system, BlinkMacSystemFont, sans-serif'

  const titleLines = wrapText(ctx, cleanTitle, WIDTH - 160)
  const titleY = titleLines.length > 2 ? 180 : 220

  titleLines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, 80, titleY + i * 70)
  })

  // Author section at bottom
  const authorY = HEIGHT - 120

  // Avatar placeholder (circle)
  ctx.fillStyle = COLORS.accent
  ctx.beginPath()
  ctx.arc(80 + 30, authorY + 30, 30, 0, Math.PI * 2)
  ctx.fill()

  // Author initial
  if (author) {
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 24px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(author.charAt(0).toUpperCase(), 80 + 30, authorY + 30)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  // Author name
  ctx.fillStyle = textColor
  ctx.font = '500 24px Inter, sans-serif'
  ctx.fillText(author || 'Anonymous', 160, authorY + 25)

  // Reading time
  if (readingTime) {
    ctx.fillStyle = mutedColor
    ctx.font = '400 20px Inter, sans-serif'
    ctx.fillText(`${readingTime} min read`, 160, authorY + 55)
  }

  // Bublr logo/branding
  ctx.fillStyle = mutedColor
  ctx.font = '500 20px Inter, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('bublr.life', WIDTH - 80, authorY + 40)
  ctx.textAlign = 'left'

  return canvas.toBuffer('image/png')
}

/**
 * Generate profile OG image
 */
async function generateProfileOG({ name, username, bio, postCount, theme = 'light' }) {
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  const isDark = theme === 'dark'
  const bgColor = isDark ? COLORS.backgroundDark : COLORS.background
  const textColor = isDark ? COLORS.textDark : COLORS.text
  const mutedColor = isDark ? COLORS.mutedDark : COLORS.muted

  // Background
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Gradient accent bar at top
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, 0)
  gradient.addColorStop(0, COLORS.gradient[0])
  gradient.addColorStop(0.5, COLORS.gradient[1])
  gradient.addColorStop(1, COLORS.gradient[2])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WIDTH, 8)

  // Large avatar circle
  const avatarSize = 120
  const avatarX = WIDTH / 2
  const avatarY = 180

  ctx.fillStyle = COLORS.accent
  ctx.beginPath()
  ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2)
  ctx.fill()

  // Avatar initial
  if (name) {
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 48px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name.charAt(0).toUpperCase(), avatarX, avatarY)
  }

  // Display name
  ctx.fillStyle = textColor
  ctx.font = 'bold 48px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(name || 'Anonymous', avatarX, avatarY + avatarSize / 2 + 60)

  // Username
  ctx.fillStyle = mutedColor
  ctx.font = '400 28px Inter, sans-serif'
  ctx.fillText(`@${username || 'user'}`, avatarX, avatarY + avatarSize / 2 + 100)

  // Bio (truncated)
  if (bio) {
    ctx.font = '400 24px Inter, sans-serif'
    const bioLines = wrapText(ctx, bio.substring(0, 150), WIDTH - 200)
    bioLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, avatarX, avatarY + avatarSize / 2 + 150 + i * 35)
    })
  }

  // Post count
  if (postCount !== undefined) {
    ctx.fillStyle = textColor
    ctx.font = '500 24px Inter, sans-serif'
    ctx.fillText(`${postCount} posts`, avatarX, HEIGHT - 100)
  }

  // Bublr branding
  ctx.fillStyle = mutedColor
  ctx.font = '500 20px Inter, sans-serif'
  ctx.fillText('bublr.life', avatarX, HEIGHT - 50)

  ctx.textAlign = 'left'

  return canvas.toBuffer('image/png')
}

export default async function handler(req, res) {
  try {
    const { params } = req.query

    if (!params || params.length < 2) {
      return res.status(400).json({ error: 'Invalid parameters. Use /api/og/post/[username]/[slug] or /api/og/profile/[username]' })
    }

    const type = params[0] // 'post' or 'profile'
    const { title, author, readingTime, name, username, bio, postCount, theme } = req.query

    let imageBuffer

    if (type === 'post') {
      imageBuffer = await generatePostOG({
        title: title || decodeURIComponent(params[2] || '').replace(/-/g, ' '),
        author: author || decodeURIComponent(params[1] || ''),
        readingTime: readingTime ? parseInt(readingTime) : undefined,
        theme: theme || 'light'
      })
    } else if (type === 'profile') {
      imageBuffer = await generateProfileOG({
        name: name || decodeURIComponent(params[1] || ''),
        username: username || params[1],
        bio: bio,
        postCount: postCount ? parseInt(postCount) : undefined,
        theme: theme || 'light'
      })
    } else {
      return res.status(400).json({ error: 'Invalid type. Use "post" or "profile".' })
    }

    // Set caching headers for better performance
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400')
    res.send(imageBuffer)
  } catch (error) {
    console.error('OG Image generation error:', error)
    res.status(500).json({ error: 'Failed to generate image', details: error.message })
  }
}

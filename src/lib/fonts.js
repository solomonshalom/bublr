/**
 * Google Fonts configuration for Bublr
 * Curated list of fonts organized by category with helpers for loading
 */

// Curated fonts list organized by category
export const CURATED_FONTS = {
  serif: [
    { family: 'Newsreader', weights: [400, 500, 600], category: 'serif' },
    { family: 'Playfair Display', weights: [400, 500, 600, 700], category: 'serif' },
    { family: 'Merriweather', weights: [300, 400, 700], category: 'serif' },
    { family: 'Lora', weights: [400, 500, 600, 700], category: 'serif' },
    { family: 'Source Serif Pro', weights: [400, 600, 700], category: 'serif' },
    { family: 'Crimson Text', weights: [400, 600, 700], category: 'serif' },
    { family: 'Libre Baskerville', weights: [400, 700], category: 'serif' },
    { family: 'EB Garamond', weights: [400, 500, 600, 700], category: 'serif' },
  ],
  sansSerif: [
    { family: 'Inter', weights: [400, 500, 600, 700], category: 'sans-serif' },
    { family: 'Open Sans', weights: [400, 500, 600, 700], category: 'sans-serif' },
    { family: 'Roboto', weights: [400, 500, 700], category: 'sans-serif' },
    { family: 'Lato', weights: [400, 700], category: 'sans-serif' },
    { family: 'Montserrat', weights: [400, 500, 600, 700], category: 'sans-serif' },
    { family: 'Poppins', weights: [400, 500, 600, 700], category: 'sans-serif' },
    { family: 'Nunito', weights: [400, 600, 700], category: 'sans-serif' },
    { family: 'Work Sans', weights: [400, 500, 600, 700], category: 'sans-serif' },
    { family: 'DM Sans', weights: [400, 500, 700], category: 'sans-serif' },
    { family: 'Plus Jakarta Sans', weights: [400, 500, 600, 700], category: 'sans-serif' },
  ],
  display: [
    { family: 'Abril Fatface', weights: [400], category: 'display' },
    { family: 'Bebas Neue', weights: [400], category: 'display' },
    { family: 'Oswald', weights: [400, 500, 600, 700], category: 'display' },
    { family: 'Archivo Black', weights: [400], category: 'display' },
    { family: 'Righteous', weights: [400], category: 'display' },
  ],
  handwriting: [
    { family: 'Dancing Script', weights: [400, 500, 600, 700], category: 'handwriting' },
    { family: 'Pacifico', weights: [400], category: 'handwriting' },
    { family: 'Caveat', weights: [400, 500, 600, 700], category: 'handwriting' },
    { family: 'Satisfy', weights: [400], category: 'handwriting' },
    { family: 'Indie Flower', weights: [400], category: 'handwriting' },
  ],
  monospace: [
    { family: 'JetBrains Mono', weights: [400, 500, 700], category: 'monospace' },
    { family: 'Fira Code', weights: [400, 500, 700], category: 'monospace' },
    { family: 'Source Code Pro', weights: [400, 500, 700], category: 'monospace' },
    { family: 'IBM Plex Mono', weights: [400, 500, 700], category: 'monospace' },
    { family: 'Roboto Mono', weights: [400, 500, 700], category: 'monospace' },
  ],
}

// Flat list of all curated fonts for easy iteration
export const ALL_CURATED_FONTS = Object.values(CURATED_FONTS).flat()

// Default fonts (already loaded globally)
export const DEFAULT_FONTS = {
  headingFont: 'Inter',
  bodyFont: 'Inter',
  codeFont: 'JetBrains Mono',
}

// Fonts that are loaded globally in _app.js (no need to load dynamically)
export const GLOBAL_FONTS = ['Inter', 'Newsreader', 'JetBrains Mono']

// Category labels for UI
export const FONT_CATEGORIES = {
  all: 'All',
  serif: 'Serif',
  sansSerif: 'Sans Serif',
  display: 'Display',
  handwriting: 'Handwriting',
  monospace: 'Monospace',
}

/**
 * Get the category of a font family
 * @param {string} family - Font family name
 * @returns {string} Category name or 'sans-serif' as default
 */
export function getFontCategory(family) {
  const font = ALL_CURATED_FONTS.find(f => f.family === family)
  return font?.category || 'sans-serif'
}

/**
 * Get CSS fallback stack for a font category
 * @param {string} category - Font category
 * @returns {string} CSS font-family fallback
 */
export function getFontFallback(category) {
  const fallbacks = {
    'serif': 'Georgia, "Times New Roman", serif',
    'sans-serif': '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'monospace': 'Consolas, Monaco, "Courier New", monospace',
    'display': '-apple-system, BlinkMacSystemFont, sans-serif',
    'handwriting': 'cursive',
  }
  return fallbacks[category] || fallbacks['sans-serif']
}

/**
 * Get full font-family CSS value with fallbacks
 * @param {string} family - Font family name
 * @returns {string} CSS font-family value
 */
export function getFontFamily(family) {
  if (!family) return getFontFallback('sans-serif')
  const category = getFontCategory(family)
  return `'${family}', ${getFontFallback(category)}`
}

/**
 * Generate Google Fonts URL for a single font
 * @param {string} family - Font family name
 * @param {number[]} weights - Font weights to load
 * @returns {string} Google Fonts CSS URL
 */
export function getGoogleFontUrl(family, weights = [400, 500, 600, 700]) {
  const weightString = weights.join(';')
  const encodedFamily = encodeURIComponent(family)
  return `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@${weightString}&display=swap`
}

/**
 * Generate Google Fonts URL for multiple fonts in a single request
 * @param {Array<{family: string, weights?: number[]}>} fonts - Array of font objects
 * @returns {string|null} Google Fonts CSS URL or null if no fonts
 */
export function getGoogleFontsUrl(fonts) {
  if (!fonts || fonts.length === 0) return null

  const familyParams = fonts.map(f => {
    const weights = f.weights?.join(';') || '400;500;600;700'
    return `family=${encodeURIComponent(f.family)}:wght@${weights}`
  }).join('&')

  return `https://fonts.googleapis.com/css2?${familyParams}&display=swap`
}

/**
 * Filter fonts that need to be loaded (exclude globally loaded fonts)
 * @param {string[]} fontFamilies - Array of font family names
 * @returns {string[]} Fonts that need dynamic loading
 */
export function getCustomFontsToLoad(fontFamilies) {
  return fontFamilies.filter(f => f && !GLOBAL_FONTS.includes(f))
}

/**
 * Search curated fonts by query
 * @param {string} query - Search query
 * @param {string} category - Optional category filter ('all' for no filter)
 * @returns {Array} Matching fonts
 */
export function searchCuratedFonts(query, category = 'all') {
  let fonts = ALL_CURATED_FONTS

  // Filter by category if specified
  if (category && category !== 'all') {
    fonts = CURATED_FONTS[category] || []
  }

  // Filter by query if specified
  if (query && query.trim()) {
    const lowerQuery = query.toLowerCase().trim()
    fonts = fonts.filter(f => f.family.toLowerCase().includes(lowerQuery))
  }

  return fonts
}

/**
 * Get recommended fonts for a font type
 * @param {'heading' | 'body' | 'code'} fontType - Type of font usage
 * @returns {Array} Recommended fonts for that type
 */
export function getRecommendedFonts(fontType) {
  switch (fontType) {
    case 'heading':
      return [
        ...CURATED_FONTS.sansSerif,
        ...CURATED_FONTS.display,
        ...CURATED_FONTS.serif,
      ]
    case 'body':
      return [
        ...CURATED_FONTS.serif,
        ...CURATED_FONTS.sansSerif,
      ]
    case 'code':
      return CURATED_FONTS.monospace
    default:
      return ALL_CURATED_FONTS
  }
}

/**
 * Validate if a font family is in our curated list
 * @param {string} family - Font family name
 * @returns {boolean} True if font is valid
 */
export function isValidFont(family) {
  if (!family) return false
  return ALL_CURATED_FONTS.some(f => f.family === family)
}

/**
 * Sanitize a font family name for safe CSS interpolation
 * Returns the font if valid, otherwise returns the default
 * Prevents CSS injection attacks
 * @param {string} family - Font family name
 * @param {string} defaultFont - Fallback font if invalid
 * @returns {string} Safe font family name
 */
export function sanitizeFontFamily(family, defaultFont = 'Inter') {
  if (!family || typeof family !== 'string') return defaultFont

  // Check if it's in our curated list (safest)
  if (isValidFont(family)) return family

  // Check if it's a default font
  if (['Inter', 'Newsreader', 'JetBrains Mono'].includes(family)) return family

  // If not in our list, return the default (don't trust arbitrary input)
  return defaultFont
}

/**
 * Dynamic font loading utilities for Bublr
 * Handles loading Google Fonts on-demand for profiles and posts
 */

import { GLOBAL_FONTS, getCustomFontsToLoad } from './fonts'

// Track fonts that have been loaded to avoid duplicates
const loadedFonts = new Set(GLOBAL_FONTS)

/**
 * Check if a font has already been loaded
 * @param {string} family - Font family name
 * @returns {boolean} True if font is already loaded
 */
export function isFontLoaded(family) {
  return loadedFonts.has(family)
}

/**
 * Mark a font as loaded
 * @param {string} family - Font family name
 */
export function markFontLoaded(family) {
  loadedFonts.add(family)
}

/**
 * Generate Google Fonts URL for custom fonts
 * @param {string[]} fontFamilies - Array of font family names
 * @returns {string|null} Google Fonts URL or null if no fonts need loading
 */
export function generateFontUrl(fontFamilies) {
  // Filter out fonts that are already loaded globally or dynamically
  const fontsToLoad = fontFamilies.filter(f => f && !loadedFonts.has(f))

  if (fontsToLoad.length === 0) return null

  // Mark these fonts as loaded
  fontsToLoad.forEach(f => loadedFonts.add(f))

  // Build the URL
  const familyParams = fontsToLoad.map(family => {
    return `family=${encodeURIComponent(family)}:wght@400;500;600;700`
  }).join('&')

  return `https://fonts.googleapis.com/css2?${familyParams}&display=swap`
}

/**
 * Load a font dynamically in the browser
 * Injects a <link> tag into the document head
 * @param {string} family - Font family name
 * @returns {Promise<boolean>} Resolves when font is loaded
 */
export async function loadFontDynamic(family) {
  if (!family || loadedFonts.has(family)) {
    return true
  }

  return new Promise((resolve) => {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`

    const link = document.createElement('link')
    link.href = url
    link.rel = 'stylesheet'
    link.onload = () => {
      loadedFonts.add(family)
      resolve(true)
    }
    link.onerror = () => {
      console.warn(`Failed to load font: ${family}`)
      resolve(false)
    }

    document.head.appendChild(link)
  })
}

/**
 * Load multiple fonts dynamically
 * @param {string[]} families - Array of font family names
 * @returns {Promise<boolean[]>} Resolves when all fonts are loaded
 */
export async function loadFontsDynamic(families) {
  const fontsToLoad = families.filter(f => f && !loadedFonts.has(f))

  if (fontsToLoad.length === 0) {
    return families.map(() => true)
  }

  // Load all fonts in one request for efficiency
  const url = generateFontUrl(fontsToLoad)
  if (!url) return families.map(() => true)

  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.href = url
    link.rel = 'stylesheet'
    link.onload = () => {
      fontsToLoad.forEach(f => loadedFonts.add(f))
      resolve(families.map(() => true))
    }
    link.onerror = () => {
      console.warn(`Failed to load fonts: ${fontsToLoad.join(', ')}`)
      resolve(families.map(() => false))
    }

    document.head.appendChild(link)
  })
}

/**
 * Get fonts that need to be loaded from fontSettings
 * @param {Object} fontSettings - Font settings object
 * @returns {string[]} Array of font families that need loading
 */
export function getFontsFromSettings(fontSettings) {
  if (!fontSettings) return []

  const fonts = [
    fontSettings.headingFont,
    fontSettings.bodyFont,
    fontSettings.codeFont,
  ].filter(Boolean)

  return getCustomFontsToLoad(fonts)
}

/**
 * Merge user font settings with post overrides
 * @param {Object} userFontSettings - User's blog-level font settings
 * @param {Object} postFontOverrides - Post-level font overrides
 * @returns {Object} Merged font settings
 */
export function mergeFontSettings(userFontSettings = {}, postFontOverrides = {}) {
  return {
    headingFont: postFontOverrides?.headingFont || userFontSettings?.headingFont || 'Inter',
    bodyFont: postFontOverrides?.bodyFont || userFontSettings?.bodyFont || 'Inter',
    codeFont: postFontOverrides?.codeFont || userFontSettings?.codeFont || 'JetBrains Mono',
  }
}

/**
 * Generate preload and stylesheet link tags for SSR
 * Used in Next.js Head component
 * @param {string[]} fontFamilies - Array of font family names
 * @returns {Object|null} Object with url for use in Head, or null if no fonts
 */
export function getFontLinkData(fontFamilies) {
  const fontsToLoad = getCustomFontsToLoad(fontFamilies)

  if (fontsToLoad.length === 0) return null

  const familyParams = fontsToLoad.map(family => {
    return `family=${encodeURIComponent(family)}:wght@400;500;600;700`
  }).join('&')

  return {
    url: `https://fonts.googleapis.com/css2?${familyParams}&display=swap`,
    fonts: fontsToLoad,
  }
}

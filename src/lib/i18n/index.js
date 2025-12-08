import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import translations, { getTranslation, SUPPORTED_UI_LANGUAGES } from './translations'

const I18nContext = createContext(null)

const STORAGE_KEY = 'bublr-language'

// Detect browser language
function detectBrowserLanguage() {
  if (typeof window === 'undefined') return 'en'

  const browserLang = navigator.language || navigator.userLanguage
  const langCode = browserLang.split('-')[0].toLowerCase()

  // Check if browser language is supported
  const isSupported = SUPPORTED_UI_LANGUAGES.some(l => l.code === langCode)
  return isSupported ? langCode : 'en'
}

// Get stored language or detect
function getInitialLanguage() {
  if (typeof window === 'undefined') return 'en'

  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED_UI_LANGUAGES.some(l => l.code === stored)) {
    return stored
  }

  return detectBrowserLanguage()
}

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState('en')
  const [mounted, setMounted] = useState(false)

  // Initialize on client side
  useEffect(() => {
    setLanguageState(getInitialLanguage())
    setMounted(true)
  }, [])

  // Save language preference
  const setLanguage = useCallback((lang) => {
    if (SUPPORTED_UI_LANGUAGES.some(l => l.code === lang)) {
      setLanguageState(lang)
      localStorage.setItem(STORAGE_KEY, lang)
      // Update document language attribute for accessibility
      document.documentElement.lang = lang
      // Update text direction for RTL languages
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    }
  }, [])

  // Translation function
  const t = useCallback((key, fallback) => {
    if (!mounted) return fallback || key
    const result = getTranslation(language, key)
    return result !== key ? result : (fallback || key)
  }, [language, mounted])

  // Get all translations for current language
  const currentTranslations = mounted ? translations[language] || translations.en : translations.en

  const value = {
    language,
    setLanguage,
    t,
    translations: currentTranslations,
    supportedLanguages: SUPPORTED_UI_LANGUAGES,
    isRTL: language === 'ar',
    mounted,
  }

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

// Standalone hook for components that just need the translation function
export function useTranslation() {
  const { t, language, isRTL } = useI18n()
  return { t, language, isRTL }
}

// Export for convenience
export { SUPPORTED_UI_LANGUAGES }
export default I18nContext

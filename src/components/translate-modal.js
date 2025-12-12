/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Cross2Icon } from '@radix-ui/react-icons'

import { IconButton } from './button'
import ModalOverlay from './modal-overlay'
import Spinner from './spinner'

// Supported languages - matches the API
const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'sv', name: 'Swedish', native: 'Svenska' },
  { code: 'da', name: 'Danish', native: 'Dansk' },
]

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`

// Translate icon SVG component - uses currentColor to inherit from parent
const TranslateIcon = ({ size = '18' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m5 8 6 6" />
    <path d="m4 14 6-6 2-3" />
    <path d="M2 5h12" />
    <path d="M7 2h1" />
    <path d="m22 22-5-10-5 10" />
    <path d="M14 18h6" />
  </svg>
)

function LanguageTag({ language, selected, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      css={css`
        cursor: ${disabled ? 'not-allowed' : 'pointer'};
        transition: all 0.2s ease-in-out;
        font-size: 0.85rem;
        color: ${selected ? 'var(--grey-1)' : 'var(--grey-4)'};
        background: ${selected ? 'var(--grey-5)' : 'transparent'};
        border-radius: 0.375rem;
        padding: 0.4rem 0.75rem;
        border: 1px solid ${selected ? 'var(--grey-5)' : 'var(--grey-2)'};
        opacity: ${disabled ? 0.5 : 1};

        &:hover:not(:disabled) {
          border-color: var(--grey-3);
          background: ${selected ? 'var(--grey-5)' : 'var(--grey-2)'};
        }
      `}
    >
      <span>{language.native}</span>
    </button>
  )
}

function TranslatedContent({ title, content, targetLanguage, onClose }) {
  return (
    <div css={css`animation: ${fadeIn} 0.3s ease-out;`}>
      <div css={css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--grey-2);
      `}>
        <span css={css`
          font-size: 0.8rem;
          color: var(--grey-3);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        `}>
          <TranslateIcon size="16" />
          Translated to {targetLanguage}
        </span>
        <button
          onClick={onClose}
          css={css`
            font-size: 0.8rem;
            color: var(--grey-3);
            background: none;
            border: none;
            cursor: pointer;
            text-decoration: underline;
            &:hover { color: var(--grey-4); }
          `}
        >
          Show original
        </button>
      </div>

      {title && (
        <h2 css={css`
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0 0 1rem 0;
          color: var(--grey-4);
          line-height: 1.3;
        `}>
          {title}
        </h2>
      )}

      <div css={css`
        font-family: 'Newsreader', serif;
        font-size: 1.1rem;
        line-height: 1.7;
        color: var(--grey-4);
        white-space: pre-wrap;

        p {
          margin-bottom: 1em;
        }
      `}>
        {content.split('\n\n').map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </div>
  )
}

export default function TranslateModal({ title, content }) {
  const [open, setOpen] = useState(false)
  const [selectedLang, setSelectedLang] = useState(null)
  const [translating, setTranslating] = useState(false)
  const [translation, setTranslation] = useState(null)
  const [error, setError] = useState(null)

  const handleTranslate = async (langCode) => {
    setSelectedLang(langCode)
    setTranslating(true)
    setError(null)
    setTranslation(null)

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          targetLang: langCode,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Translation failed')
      }

      setTranslation({
        title: data.translatedTitle,
        content: data.translatedContent,
        targetLanguage: data.targetLanguage,
        isTruncated: data.isTruncated,
      })
    } catch (err) {
      console.error('Translation error:', err)
      setError(err.message || 'Failed to translate. Please try again.')
    } finally {
      setTranslating(false)
    }
  }

  const handleReset = () => {
    setTranslation(null)
    setSelectedLang(null)
    setError(null)
  }

  const handleOpenChange = (isOpen) => {
    setOpen(isOpen)
    if (!isOpen) {
      // Reset state when modal closes
      setTimeout(() => {
        setTranslation(null)
        setSelectedLang(null)
        setError(null)
        setTranslating(false)
      }, 200)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger
        as="button"
        css={css`
          color: var(--grey-3);
          cursor: pointer;
          transition: all 200ms ease;
          border: none;
          padding: 0;
          background: none;
          outline: none;

          &:hover {
            color: var(--grey-4);
          }
        `}
        title="Translate this post"
        aria-label="Translate this post"
      >
        <TranslateIcon />
      </Dialog.Trigger>

      <ModalOverlay />

      <Dialog.Content
        css={css`
          background: var(--grey-1);
          border-radius: 0.5rem;
          padding: 0;
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 600px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          animation: ${fadeIn} 0.2s ease-out;
        `}
      >
        {/* Header */}
        <div css={css`
          padding: 1.5rem 1.5rem 1rem 1.5rem;
          flex-shrink: 0;
        `}>
          <Dialog.Title css={css`
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          `}>
            <span css={css`color: var(--grey-4); display: flex;`}><TranslateIcon size="20" /></span>
            Translate Post
          </Dialog.Title>
          <Dialog.Description css={css`
            margin: 0.5rem 0 0 0;
            color: var(--grey-3);
            font-size: 0.9rem;
          `}>
            {translation
              ? 'View the translated version below'
              : 'Select a language to translate this post'
            }
          </Dialog.Description>
        </div>

        {/* Content */}
        <div data-lenis-prevent css={css`
          flex: 1;
          overflow-y: auto;
          padding: 0 1.5rem 1.5rem 1.5rem;

          &::-webkit-scrollbar { display: none; }
          -ms-overflow-style: none;
          scrollbar-width: none;
        `}>
          {translation ? (
            <TranslatedContent
              title={translation.title}
              content={translation.content}
              targetLanguage={translation.targetLanguage}
              onClose={handleReset}
            />
          ) : (
            <>
              {/* Error message */}
              {error && (
                <p css={css`
                  font-size: 0.85rem;
                  color: #dc2626;
                  margin-bottom: 1rem;
                  padding: 0.75rem;
                  background: #fef2f2;
                  border-radius: 0.375rem;
                  border: 1px solid #fecaca;
                `}>
                  {error}
                </p>
              )}

              {/* Loading state */}
              {translating && (
                <div css={css`
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  padding: 3rem 1rem;
                  gap: 1rem;
                `}>
                  <Spinner />
                  <p css={css`
                    color: var(--grey-3);
                    font-size: 0.9rem;
                    margin: 0;
                  `}>
                    Translating to {LANGUAGES.find(l => l.code === selectedLang)?.name}...
                  </p>
                </div>
              )}

              {/* Language selection */}
              {!translating && (
                <div css={css`
                  display: flex;
                  flex-wrap: wrap;
                  gap: 0.5rem;
                `}>
                  {LANGUAGES.map((lang) => (
                    <LanguageTag
                      key={lang.code}
                      language={lang}
                      selected={selectedLang === lang.code}
                      onClick={() => handleTranslate(lang.code)}
                      disabled={translating}
                    />
                  ))}
                </div>
              )}

              {/* Powered by note */}
              {!translating && (
                <p css={css`
                  margin-top: 1.5rem;
                  font-size: 0.75rem;
                  color: var(--grey-3);
                  text-align: center;
                `}>
                  Powered by AI for natural, fluent translations
                </p>
              )}
            </>
          )}
        </div>

        {/* Close button */}
        <Dialog.Close asChild>
          <IconButton
            css={css`
              position: absolute;
              top: 1rem;
              right: 1rem;
            `}
          >
            <Cross2Icon />
          </IconButton>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Root>
  )
}

// Export the icon for use elsewhere
export { TranslateIcon }

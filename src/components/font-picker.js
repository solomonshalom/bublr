/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDownIcon, MagnifyingGlassIcon, CheckIcon } from '@radix-ui/react-icons'

import {
  CURATED_FONTS,
  ALL_CURATED_FONTS,
  FONT_CATEGORIES,
  DEFAULT_FONTS,
  searchCuratedFonts,
  getRecommendedFonts,
} from '../lib/fonts'
import { loadFontDynamic } from '../lib/font-loader'

/**
 * FontPicker - A dropdown component for selecting Google Fonts
 *
 * @param {Object} props
 * @param {string} props.value - Current selected font family
 * @param {function} props.onChange - Callback when font is selected (fontFamily) => void
 * @param {'heading' | 'body' | 'code'} props.fontType - Type of font for recommendations
 * @param {boolean} props.allowBlogDefault - Show "Use blog default" option
 * @param {string} props.blogDefaultFont - The blog's default font for this type
 * @param {boolean} props.disabled - Disable the picker
 */
const FontPicker = ({
  value,
  onChange,
  fontType = 'body',
  allowBlogDefault = false,
  blogDefaultFont = null,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [loadingFonts, setLoadingFonts] = useState(new Set())
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  // Get fonts to display based on category and search
  const getDisplayFonts = useCallback(() => {
    if (searchQuery.trim()) {
      return searchCuratedFonts(searchQuery, activeCategory)
    }

    if (activeCategory === 'all') {
      // Show recommended fonts first for the font type
      return getRecommendedFonts(fontType)
    }

    return CURATED_FONTS[activeCategory] || []
  }, [searchQuery, activeCategory, fontType])

  const displayFonts = getDisplayFonts()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Load font for preview when hovering
  const handleFontHover = async (fontFamily) => {
    if (loadingFonts.has(fontFamily)) return

    setLoadingFonts(prev => new Set([...prev, fontFamily]))
    await loadFontDynamic(fontFamily)
    setLoadingFonts(prev => {
      const next = new Set(prev)
      next.delete(fontFamily)
      return next
    })
  }

  // Handle font selection
  const handleSelect = (fontFamily) => {
    onChange(fontFamily)
    setIsOpen(false)
    setSearchQuery('')
  }

  // Handle "Use blog default" selection
  const handleSelectBlogDefault = () => {
    onChange(null)
    setIsOpen(false)
    setSearchQuery('')
  }

  // Get display name for current value
  const getDisplayName = () => {
    if (value === null && allowBlogDefault) {
      return `Blog default (${blogDefaultFont || DEFAULT_FONTS[fontType + 'Font']})`
    }
    return value || DEFAULT_FONTS[fontType + 'Font']
  }

  // Category tabs
  const categories = fontType === 'code'
    ? [{ key: 'monospace', label: 'Monospace' }]
    : [
        { key: 'all', label: 'All' },
        { key: 'sansSerif', label: 'Sans' },
        { key: 'serif', label: 'Serif' },
        { key: 'display', label: 'Display' },
        { key: 'handwriting', label: 'Script' },
        { key: 'monospace', label: 'Mono' },
      ]

  return (
    <div
      ref={dropdownRef}
      css={css`
        position: relative;
        width: 100%;
      `}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        css={css`
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          background: var(--grey-1);
          color: var(--grey-4);
          border: 1px solid var(--grey-2);
          padding: 0.6rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.85rem;
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
          transition: all 0.15s ease;
          opacity: ${disabled ? 0.6 : 1};
          font-family: ${value ? `'${value}', ` : ''}sans-serif;

          &:hover:not(:disabled) {
            border-color: var(--grey-3);
          }

          &:focus {
            outline: none;
            border-color: var(--grey-3);
          }
        `}
      >
        <span css={css`
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        `}>
          {getDisplayName()}
        </span>
        <ChevronDownIcon
          width={14}
          height={14}
          css={css`
            flex-shrink: 0;
            transition: transform 0.15s ease;
            transform: ${isOpen ? 'rotate(180deg)' : 'rotate(0deg)'};
            opacity: 0.6;
          `}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          css={css`
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            right: 0;
            background: var(--grey-1);
            border: 1px solid var(--grey-2);
            border-radius: 0.5rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            overflow: hidden;
            animation: dropdownFadeIn 0.15s ease;

            @keyframes dropdownFadeIn {
              from {
                opacity: 0;
                transform: translateY(-4px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}
        >
          {/* Search Input */}
          <div
            css={css`
              padding: 0.5rem;
              border-bottom: 1px solid var(--grey-2);
            `}
          >
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
                background: var(--grey-1);
                border: 1px solid var(--grey-2);
                border-radius: 0.375rem;
                padding: 0.4rem 0.6rem;

                &:focus-within {
                  border-color: var(--grey-3);
                }
              `}
            >
              <MagnifyingGlassIcon
                width={14}
                height={14}
                css={css`color: var(--grey-3);`}
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search fonts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                css={css`
                  flex: 1;
                  border: none;
                  background: none;
                  font-size: 0.8rem;
                  color: var(--grey-4);
                  outline: none;

                  &::placeholder {
                    color: var(--grey-3);
                  }
                `}
              />
            </div>
          </div>

          {/* Category Tabs */}
          {fontType !== 'code' && (
            <div
              css={css`
                display: flex;
                gap: 0.25rem;
                padding: 0.5rem;
                border-bottom: 1px solid var(--grey-2);
                overflow-x: auto;

                &::-webkit-scrollbar {
                  display: none;
                }
              `}
            >
              {categories.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveCategory(key)}
                  css={css`
                    padding: 0.25rem 0.5rem;
                    font-size: 0.7rem;
                    border: none;
                    border-radius: 0.25rem;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.15s ease;
                    background: ${activeCategory === key ? 'var(--grey-5)' : 'transparent'};
                    color: ${activeCategory === key ? 'var(--grey-1)' : 'var(--grey-3)'};

                    &:hover {
                      background: ${activeCategory === key ? 'var(--grey-5)' : 'var(--grey-2)'};
                    }
                  `}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Font List */}
          <div
            data-lenis-prevent
            css={css`
              max-height: 240px;
              overflow-y: auto;
            `}
          >
            {/* Blog Default Option */}
            {allowBlogDefault && (
              <button
                type="button"
                onClick={handleSelectBlogDefault}
                css={css`
                  width: 100%;
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 0.6rem 0.75rem;
                  border: none;
                  background: ${value === null ? 'var(--grey-2)' : 'transparent'};
                  color: var(--grey-4);
                  font-size: 0.8rem;
                  cursor: pointer;
                  transition: background 0.15s ease;
                  border-bottom: 1px solid var(--grey-2);

                  &:hover {
                    background: var(--grey-2);
                  }
                `}
              >
                <span css={css`
                  font-style: italic;
                  color: var(--grey-3);
                `}>
                  Use blog default ({blogDefaultFont || DEFAULT_FONTS[fontType + 'Font']})
                </span>
                {value === null && (
                  <CheckIcon width={14} height={14} css={css`color: var(--grey-4);`} />
                )}
              </button>
            )}

            {/* Font Options */}
            {displayFonts.map((font) => (
              <button
                key={font.family}
                type="button"
                onClick={() => handleSelect(font.family)}
                onMouseEnter={() => handleFontHover(font.family)}
                css={css`
                  width: 100%;
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 0.6rem 0.75rem;
                  border: none;
                  background: ${value === font.family ? 'var(--grey-2)' : 'transparent'};
                  color: var(--grey-4);
                  font-size: 0.85rem;
                  font-family: '${font.family}', sans-serif;
                  cursor: pointer;
                  transition: background 0.15s ease;
                  text-align: left;

                  &:hover {
                    background: var(--grey-2);
                  }
                `}
              >
                <span>{font.family}</span>
                {value === font.family && (
                  <CheckIcon width={14} height={14} css={css`color: var(--grey-4); flex-shrink: 0;`} />
                )}
              </button>
            ))}

            {/* No Results */}
            {displayFonts.length === 0 && (
              <div
                css={css`
                  padding: 1.5rem;
                  text-align: center;
                  color: var(--grey-3);
                  font-size: 0.8rem;
                `}
              >
                No fonts found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default FontPicker

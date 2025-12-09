/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { useState, useCallback, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Cross2Icon } from '@radix-ui/react-icons'

import { uploadToImgBB } from '../../lib/utils'
import Spinner from '../spinner'

// Animation
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const slideUp = keyframes`
  from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`

// Built-in sticker library - curated decorative stickers
// These use free SVG/PNG stickers. In production, replace with actual CDN URLs
const STICKER_LIBRARY = {
  categories: [
    {
      id: 'decorative',
      name: 'Decorative',
      stickers: [
        { id: 'star-1', name: 'Gold Star', src: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png', defaultWidth: 60, defaultHeight: 60 },
        { id: 'heart-1', name: 'Red Heart', src: 'https://cdn-icons-png.flaticon.com/512/833/833472.png', defaultWidth: 60, defaultHeight: 60 },
        { id: 'sparkle-1', name: 'Sparkle', src: 'https://cdn-icons-png.flaticon.com/512/3073/3073665.png', defaultWidth: 50, defaultHeight: 50 },
        { id: 'ribbon-1', name: 'Ribbon', src: 'https://cdn-icons-png.flaticon.com/512/3468/3468377.png', defaultWidth: 70, defaultHeight: 70 },
        { id: 'flower-1', name: 'Flower', src: 'https://cdn-icons-png.flaticon.com/512/2990/2990816.png', defaultWidth: 60, defaultHeight: 60 },
        { id: 'butterfly-1', name: 'Butterfly', src: 'https://cdn-icons-png.flaticon.com/512/616/616554.png', defaultWidth: 60, defaultHeight: 60 },
      ],
    },
    {
      id: 'shapes',
      name: 'Shapes',
      stickers: [
        { id: 'circle-1', name: 'Circle', src: 'https://cdn-icons-png.flaticon.com/512/481/481078.png', defaultWidth: 50, defaultHeight: 50 },
        { id: 'square-1', name: 'Square', src: 'https://cdn-icons-png.flaticon.com/512/5765/5765122.png', defaultWidth: 50, defaultHeight: 50 },
        { id: 'triangle-1', name: 'Triangle', src: 'https://cdn-icons-png.flaticon.com/512/5765/5765120.png', defaultWidth: 50, defaultHeight: 50 },
        { id: 'hexagon-1', name: 'Hexagon', src: 'https://cdn-icons-png.flaticon.com/512/5765/5765133.png', defaultWidth: 50, defaultHeight: 50 },
        { id: 'diamond-1', name: 'Diamond', src: 'https://cdn-icons-png.flaticon.com/512/2913/2913133.png', defaultWidth: 50, defaultHeight: 50 },
        { id: 'cloud-1', name: 'Cloud', src: 'https://cdn-icons-png.flaticon.com/512/414/414825.png', defaultWidth: 70, defaultHeight: 50 },
      ],
    },
    {
      id: 'nature',
      name: 'Nature',
      stickers: [
        { id: 'sun-1', name: 'Sun', src: 'https://cdn-icons-png.flaticon.com/512/869/869869.png', defaultWidth: 60, defaultHeight: 60 },
        { id: 'moon-1', name: 'Moon', src: 'https://cdn-icons-png.flaticon.com/512/3222/3222800.png', defaultWidth: 50, defaultHeight: 50 },
        { id: 'leaf-1', name: 'Leaf', src: 'https://cdn-icons-png.flaticon.com/512/628/628283.png', defaultWidth: 50, defaultHeight: 50 },
        { id: 'tree-1', name: 'Tree', src: 'https://cdn-icons-png.flaticon.com/512/490/490091.png', defaultWidth: 60, defaultHeight: 70 },
        { id: 'rainbow-1', name: 'Rainbow', src: 'https://cdn-icons-png.flaticon.com/512/2930/2930087.png', defaultWidth: 80, defaultHeight: 50 },
        { id: 'snowflake-1', name: 'Snowflake', src: 'https://cdn-icons-png.flaticon.com/512/2809/2809607.png', defaultWidth: 50, defaultHeight: 50 },
      ],
    },
    {
      id: 'emoji',
      name: 'Emoji',
      stickers: [
        { id: 'smile-1', name: 'Smile', src: 'https://cdn-icons-png.flaticon.com/512/742/742751.png', defaultWidth: 50, defaultHeight: 50 },
        { id: 'wink-1', name: 'Wink', src: 'https://cdn-icons-png.flaticon.com/512/742/742920.png', defaultWidth: 50, defaultHeight: 50 },
        { id: 'love-1', name: 'Love Eyes', src: 'https://cdn-icons-png.flaticon.com/512/742/742940.png', defaultWidth: 50, defaultHeight: 50 },
        { id: 'cool-1', name: 'Cool', src: 'https://cdn-icons-png.flaticon.com/512/742/742912.png', defaultWidth: 50, defaultHeight: 50 },
        { id: 'fire-1', name: 'Fire', src: 'https://cdn-icons-png.flaticon.com/512/785/785116.png', defaultWidth: 50, defaultHeight: 60 },
        { id: 'thumbsup-1', name: 'Thumbs Up', src: 'https://cdn-icons-png.flaticon.com/512/456/456115.png', defaultWidth: 50, defaultHeight: 50 },
      ],
    },
  ],
}

// Tab component
const Tab = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    css={css`
      padding: 8px 16px;
      font-size: 0.85rem;
      font-weight: 500;
      color: ${active ? 'var(--grey-4)' : 'var(--grey-3)'};
      background: ${active ? 'var(--grey-1)' : 'transparent'};
      border: 1px solid ${active ? 'var(--grey-2)' : 'transparent'};
      border-bottom: ${active ? '1px solid var(--grey-1)' : '1px solid transparent'};
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      transition: all 0.15s ease;
      margin-bottom: -1px;

      &:hover {
        color: var(--grey-4);
      }
    `}
  >
    {children}
  </button>
)

// Sticker grid item
const StickerItem = ({ sticker, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(sticker)}
    css={css`
      display: flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      padding: 8px;
      background: var(--grey-0);
      border: 1px solid var(--grey-2);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: var(--grey-1);
        border-color: var(--grey-3);
        transform: scale(1.05);
      }

      img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
    `}
  >
    <img src={sticker.src} alt={sticker.name} title={sticker.name} />
  </button>
)

/**
 * Modal for selecting/adding stickers
 * Includes: Built-in library, URL paste, File upload
 */
export default function StickerLibraryModal({ open, onClose, onAddSticker }) {
  const [activeTab, setActiveTab] = useState('library')
  const [activeCategory, setActiveCategory] = useState('decorative')
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  const handleStickerSelect = useCallback((sticker) => {
    onAddSticker({
      type: 'library',
      src: sticker.src,
      width: sticker.defaultWidth,
      height: sticker.defaultHeight,
    })
    onClose()
  }, [onAddSticker, onClose])

  const handleUrlSubmit = useCallback((e) => {
    e.preventDefault()
    setUrlError('')

    const url = urlInput.trim()
    if (!url) {
      setUrlError('Please enter a URL')
      return
    }

    // Validate URL format
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:') {
        setUrlError('Only HTTPS URLs are allowed')
        return
      }
    } catch {
      setUrlError('Invalid URL format')
      return
    }

    // Check if it looks like an image URL
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
    const hasImageExt = imageExtensions.some(ext => url.toLowerCase().includes(ext))
    if (!hasImageExt) {
      setUrlError('URL should point to an image file')
      return
    }

    onAddSticker({
      type: 'url',
      src: url,
      width: 80,
      height: 80,
    })
    setUrlInput('')
    onClose()
  }, [urlInput, onAddSticker, onClose])

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError('')

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setUploadError('Please upload a PNG, JPG, GIF, or WebP image')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5MB')
      return
    }

    setIsUploading(true)

    try {
      const apiKey = process.env.NEXT_PUBLIC_IMGBB_API
      const imageUrl = await uploadToImgBB(file, apiKey)

      if (!imageUrl) {
        setUploadError('Failed to upload image. Please try again.')
        return
      }

      // Get image dimensions
      const img = new Image()
      img.onload = () => {
        // Scale to reasonable size while maintaining aspect ratio
        let width = img.width
        let height = img.height
        const maxDimension = 150

        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        onAddSticker({
          type: 'upload',
          src: imageUrl,
          width,
          height,
        })
        onClose()
      }
      img.onerror = () => {
        onAddSticker({
          type: 'upload',
          src: imageUrl,
          width: 80,
          height: 80,
        })
        onClose()
      }
      img.src = imageUrl
    } catch (err) {
      console.error('Upload error:', err)
      setUploadError('Failed to upload image. Please try again.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [onAddSticker, onClose])

  const currentCategory = STICKER_LIBRARY.categories.find(c => c.id === activeCategory)

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Overlay
        css={css`
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          position: fixed;
          inset: 0;
          animation: ${fadeIn} 150ms ease-out;
          z-index: 99998;
        `}
      />
      <Dialog.Content
          css={css`
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--grey-1);
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            width: 90%;
            max-width: 520px;
            max-height: 85vh;
            overflow: hidden;
            animation: ${slideUp} 150ms ease-out;
            z-index: 99999;

            &:focus {
              outline: none;
            }
          `}
        >
          {/* Header */}
          <div
            css={css`
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 16px 20px;
              border-bottom: 1px solid var(--grey-2);
            `}
          >
            <Dialog.Title
              css={css`
                font-size: 1.1rem;
                font-weight: 600;
                color: var(--grey-4);
                margin: 0;
              `}
            >
              Add Decoration
            </Dialog.Title>
            <Dialog.Close
              css={css`
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                background: transparent;
                border: none;
                border-radius: 6px;
                color: var(--grey-3);
                cursor: pointer;
                transition: all 0.15s ease;

                &:hover {
                  background: var(--grey-2);
                  color: var(--grey-4);
                }
              `}
            >
              <Cross2Icon width={18} height={18} />
            </Dialog.Close>
          </div>

          {/* Tabs */}
          <div
            css={css`
              display: flex;
              gap: 4px;
              padding: 12px 20px 0;
              border-bottom: 1px solid var(--grey-2);
            `}
          >
            <Tab active={activeTab === 'library'} onClick={() => setActiveTab('library')}>
              Sticker Library
            </Tab>
            <Tab active={activeTab === 'url'} onClick={() => setActiveTab('url')}>
              From URL
            </Tab>
            <Tab active={activeTab === 'upload'} onClick={() => setActiveTab('upload')}>
              Upload
            </Tab>
          </div>

          {/* Content */}
          <div
            css={css`
              padding: 20px;
              max-height: calc(85vh - 140px);
              overflow-y: auto;
            `}
          >
            {/* Library Tab */}
            {activeTab === 'library' && (
              <>
                {/* Category pills */}
                <div
                  css={css`
                    display: flex;
                    gap: 8px;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                  `}
                >
                  {STICKER_LIBRARY.categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setActiveCategory(category.id)}
                      css={css`
                        padding: 6px 12px;
                        font-size: 0.8rem;
                        font-weight: 500;
                        color: ${activeCategory === category.id ? '#fff' : 'var(--grey-3)'};
                        background: ${activeCategory === category.id ? '#4D96FF' : 'var(--grey-0)'};
                        border: 1px solid ${activeCategory === category.id ? '#4D96FF' : 'var(--grey-2)'};
                        border-radius: 20px;
                        cursor: pointer;
                        transition: all 0.15s ease;

                        &:hover {
                          border-color: ${activeCategory === category.id ? '#4D96FF' : 'var(--grey-3)'};
                        }
                      `}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                {/* Sticker grid */}
                <div
                  css={css`
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
                    gap: 12px;
                  `}
                >
                  {currentCategory?.stickers.map((sticker) => (
                    <StickerItem
                      key={sticker.id}
                      sticker={sticker}
                      onClick={handleStickerSelect}
                    />
                  ))}
                </div>
              </>
            )}

            {/* URL Tab */}
            {activeTab === 'url' && (
              <form onSubmit={handleUrlSubmit}>
                <p
                  css={css`
                    font-size: 0.85rem;
                    color: var(--grey-3);
                    margin: 0 0 16px;
                  `}
                >
                  Paste a direct link to an image (PNG, JPG, GIF, WebP). Only HTTPS URLs are allowed.
                </p>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.png"
                  css={css`
                    width: 100%;
                    padding: 12px;
                    font-size: 0.9rem;
                    background: var(--grey-0);
                    border: 1px solid var(--grey-2);
                    border-radius: 8px;
                    color: var(--grey-4);
                    outline: none;
                    transition: border-color 0.15s ease;

                    &:focus {
                      border-color: #4D96FF;
                    }

                    &::placeholder {
                      color: var(--grey-3);
                    }
                  `}
                />
                {urlError && (
                  <p
                    css={css`
                      font-size: 0.8rem;
                      color: #E23E57;
                      margin: 8px 0 0;
                    `}
                  >
                    {urlError}
                  </p>
                )}
                <button
                  type="submit"
                  css={css`
                    width: 100%;
                    margin-top: 16px;
                    padding: 12px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #fff;
                    background: #4D96FF;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.15s ease;

                    &:hover {
                      background: #3d86ef;
                    }
                  `}
                >
                  Add Image
                </button>
              </form>
            )}

            {/* Upload Tab */}
            {activeTab === 'upload' && (
              <div>
                <p
                  css={css`
                    font-size: 0.85rem;
                    color: var(--grey-3);
                    margin: 0 0 16px;
                  `}
                >
                  Upload an image from your device. Max size: 5MB. Supported formats: PNG, JPG, GIF, WebP.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  css={css`
                    display: none;
                  `}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  css={css`
                    width: 100%;
                    padding: 40px 20px;
                    font-size: 0.9rem;
                    color: var(--grey-3);
                    background: var(--grey-0);
                    border: 2px dashed var(--grey-2);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.15s ease;

                    &:hover:not(:disabled) {
                      border-color: #4D96FF;
                      color: var(--grey-4);
                    }

                    &:disabled {
                      opacity: 0.6;
                      cursor: not-allowed;
                    }
                  `}
                >
                  {isUploading ? (
                    <span
                      css={css`
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                      `}
                    >
                      <Spinner size={18} />
                      Uploading...
                    </span>
                  ) : (
                    <>
                      Click to select an image
                      <br />
                      <span css={css`font-size: 0.8rem; opacity: 0.7;`}>
                        or drag and drop
                      </span>
                    </>
                  )}
                </button>
                {uploadError && (
                  <p
                    css={css`
                      font-size: 0.8rem;
                      color: #E23E57;
                      margin: 12px 0 0;
                    `}
                  >
                    {uploadError}
                  </p>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
    </Dialog.Root>
  )
}

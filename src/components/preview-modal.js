/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Cross2Icon, EyeOpenIcon } from '@radix-ui/react-icons'
import sanitize from 'sanitize-html'

import { IconButton } from './button'
import ModalOverlay from './modal-overlay'
import PostContainer from './post-container'
import ThemeToggle from './theme-toggle'
import { calculateReadingTime, cleanTitle } from '../lib/seo-utils'
import { sanitizeFontFamily } from '../lib/fonts'

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`

// Custom trigger button styled to match other header icons
const PreviewTrigger = (props) => (
  <button
    css={css`
      background: none;
      border: none;
      border-radius: 1rem;
      width: 2rem;
      height: 2rem;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: all 200ms ease;
      color: inherit;
      padding: 0;
      outline: none;

      &:hover {
        background: var(--grey-2);
        opacity: 0.4;
      }
    `}
    {...props}
  >
    <EyeOpenIcon />
  </button>
)

export default function PreviewModal({ post, userdata }) {
  const [open, setOpen] = useState(false)

  // Compute font settings (merge user defaults with post overrides)
  const userFontSettings = userdata?.fontSettings || {}
  const postFontOverrides = post.fontOverrides || {}
  const fontSettings = {
    headingFont: sanitizeFontFamily(postFontOverrides.headingFont || userFontSettings.headingFont, 'Inter'),
    bodyFont: sanitizeFontFamily(postFontOverrides.bodyFont || userFontSettings.bodyFont, 'Inter'),
    codeFont: sanitizeFontFamily(postFontOverrides.codeFont || userFontSettings.codeFont, 'JetBrains Mono'),
  }

  // Calculate reading time
  const readingTime = calculateReadingTime(post.content)
  const title = cleanTitle(post.title)

  // Format today's date
  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger as={PreviewTrigger} title="Preview post" aria-label="Preview post" />

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
          width: 95%;
          max-width: 700px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          animation: ${fadeIn} 0.2s ease-out;
          z-index: 100;
        `}
      >
        {/* Header */}
        <div css={css`
          padding: 1.5rem 1.5rem 1rem 1.5rem;
          flex-shrink: 0;
          border-bottom: 1px solid var(--grey-2);
        `}>
          <div css={css`
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.35rem 0.75rem;
            background: var(--grey-2);
            border-radius: 2rem;
            font-size: 0.75rem;
            color: var(--grey-4);
          `}>
            <EyeOpenIcon width={14} height={14} />
            Preview Mode
          </div>
        </div>

        {/* Scrollable content */}
        <div
          data-lenis-prevent
          css={css`
            flex: 1;
            overflow-y: auto;
            padding: 1.5rem;

            &::-webkit-scrollbar { display: none; }
            -ms-overflow-style: none;
            scrollbar-width: none;
          `}
        >
          {/* Title */}
          <h1 css={css`
            font-size: 1.75rem;
            font-weight: 700;
            letter-spacing: -0.02em;
            line-height: 1.35;
            margin: 0 0 1rem 0;
            color: var(--grey-5);
            font-family: '${fontSettings.headingFont}', Inter, sans-serif;
          `}>
            {title}
          </h1>

          {/* Author info */}
          <div css={css`
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
          `}>
            <img
              src={userdata?.photo || 'https://api.dicebear.com/7.x/shapes/svg?seed=default'}
              alt={userdata?.displayName || 'Author'}
              width="32"
              height="32"
              css={css`
                border-radius: 1rem;
                object-fit: cover;
              `}
            />
            <p css={css`
              margin: 0;
              font-size: 0.9rem;
              color: var(--grey-3);
            `}>
              <span css={css`
                color: var(--grey-4);
                border-bottom: 1px dotted var(--grey-2);
              `}>
                {userdata?.displayName || 'Author'}
              </span>
              {' / '}
              <time>{today}</time>
              {' / '}
              {readingTime} min read
            </p>
          </div>

          {/* Post content */}
          <PostContainer
            textDirection={post.textDirection || 'auto'}
            fontSettings={fontSettings}
            dangerouslySetInnerHTML={{
              __html: sanitize(post.content || '', {
                allowedTags: sanitize.defaults.allowedTags.concat(['img']),
              }),
            }}
          />
        </div>

        {/* Footer */}
        <div css={css`
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--grey-2);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        `}>
          <span css={css`
            display: flex;
            align-items: center;
            gap: 0.4rem;
            font-size: 0.8rem;
            color: var(--grey-3);
          `}>
            <EyeOpenIcon width={14} height={14} />
            Preview
          </span>
          <ThemeToggle />
        </div>

        {/* Close button */}
        <Dialog.Close
          as={IconButton}
          css={css`
            position: absolute;
            top: 1rem;
            right: 1rem;
          `}
          aria-label="Close preview"
        >
          <Cross2Icon />
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Root>
  )
}

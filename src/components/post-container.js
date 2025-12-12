/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import React, { useEffect } from 'react'
import { getFontCategory, getFontFallback, sanitizeFontFamily } from '../lib/fonts'

// RTL language detection - checks if text contains primarily RTL characters
const detectRTL = (text) => {
  if (!text) return false
  // Remove HTML tags and get plain text
  const plainText = text.replace(/<[^>]*>/g, '').trim()
  if (!plainText) return false

  // RTL Unicode ranges: Hebrew, Arabic, Persian, Urdu, etc.
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  const rtlChars = (plainText.match(rtlRegex) || []).length

  // Consider RTL if more than 30% of meaningful characters are RTL
  const meaningfulChars = plainText.replace(/[\s\d\W]/g, '').length
  return meaningfulChars > 0 && (rtlChars / meaningfulChars) > 0.3
}

const PostContainer = ({ textDirection = 'auto', fontSettings, ...props }) => {
  // Extract and sanitize fonts from settings (prevents CSS injection)
  const headingFont = sanitizeFontFamily(fontSettings?.headingFont, 'Inter')
  const bodyFont = sanitizeFontFamily(fontSettings?.bodyFont, 'Inter')
  const codeFont = sanitizeFontFamily(fontSettings?.codeFont, 'JetBrains Mono')

  // Get appropriate fallbacks for each font
  const headingFallback = getFontFallback(getFontCategory(headingFont))
  const bodyFallback = getFontFallback(getFontCategory(bodyFont))

  // Determine actual direction based on setting
  const getDirection = () => {
    if (textDirection === 'ltr' || textDirection === 'rtl') {
      return textDirection
    }
    // Auto-detect based on content
    if (textDirection === 'auto' && props.dangerouslySetInnerHTML?.__html) {
      return detectRTL(props.dangerouslySetInnerHTML.__html) ? 'rtl' : 'ltr'
    }
    return 'ltr'
  }

  const direction = getDirection()
  const isRTL = direction === 'rtl'

  useEffect(() => {
    // Add SVG elements to all links after component mounts
    const links = document.querySelectorAll('.post-container a');
    links.forEach(link => {
      // Only add SVG if it doesn't already exist
      if (!link.querySelector('svg')) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 70 36');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M6.9739 30.8153H63.0244C65.5269 30.8152 75.5358 -3.68471 35.4998 2.81531C-16.1598 11.2025 0.894099 33.9766 26.9922 34.3153C104.062 35.3153 54.5169 -6.68469 23.489 9.31527');

        svg.appendChild(path);
        link.appendChild(svg);
      }
    });
  }, []);

  return (
  <div
    className="post-container"
    dir={direction}
    css={css`
      direction: ${direction};
      text-align: ${isRTL ? 'right' : 'left'};
      margin-top: 2rem;
      font-size: 1.125rem;
      line-height: 1.5em;

      font-family: '${bodyFont}', ${bodyFallback};

      img {
        display: block;
        max-width: 100%;
        margin: 0 auto;
      }

      a {
        display: inline-block;
        position: relative;
        text-decoration: none;
        color: var(--grey-5);
        margin: 0 var(--spacing, 0px);
        transition: margin .25s;
      }

      a svg {
        width: 76px;
        height: 40px;
        position: absolute;
        left: 50%;
        bottom: 0;
        transform: translate(-50%, 7px) translateZ(0);
        fill: none;
        stroke: var(--stroke, var(--line));
        stroke-linecap: round;
        stroke-width: 2px;
        stroke-dasharray: var(--offset, 69px) 278px;
        stroke-dashoffset: 361px;
        transition: stroke .25s ease var(--stroke-delay, 0s), stroke-dasharray .35s;
      }

      a:hover {
        --spacing: 4px;
        --stroke: var(--line-active);
        --stroke-delay: .1s;
        --offset: 180px;
      }

      p {
        margin: 1.2rem 0;
      }

      ul,
      ol {
        margin-left: ${isRTL ? '0' : '1.5rem'};
        margin-right: ${isRTL ? '1.5rem' : '0'};
      }

      blockquote,
      hr {
        margin: 1.5rem 0;
      }

      blockquote > p {
        font-family: '${headingFont}', ${headingFallback};
        padding-left: ${isRTL ? '0' : '1.25rem'};
        padding-right: ${isRTL ? '1.25rem' : '0'};
        border-left: ${isRTL ? 'none' : '0.15rem solid var(--grey-2)'};
        border-right: ${isRTL ? '0.15rem solid var(--grey-2)' : 'none'};
      }

      h1,
      h2,
      h3 {
        font-family: '${headingFont}', ${headingFallback};
        font-weight: 500;
        letter-spacing: -0.02em;
        margin: 2rem 0 0.5rem 0;
      }

      h1 {
        font-size: 1.5rem;
      }

      h2 {
        font-size: 1.25rem;
      }

      h3 {
        font-style: italic;
        font-size: 1.15rem;
      }

      pre {
        background: var(--grey-5);
        font-family: '${codeFont}', monospace;
        border-radius: 0.5rem;
        padding: 1rem 1.5rem;
        overflow: auto;
      }

      code {
        font-size: 0.9rem;
        font-family: '${codeFont}', monospace;

        background: rgba(0, 0, 0, 0.1);
        color: var(--grey-4);
        border-radius: 0.2rem;
        padding: 0.2rem;
      }

      pre code {
        background: none;
        color: var(--grey-2);
        border-radius: 0;
        padding: 0;
      }

      /* Task List Styles */
      ul[data-type="taskList"] {
        list-style: none;
        padding: 0;
        margin: 1rem 0;
      }

      ul[data-type="taskList"] li {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        margin: 0.5rem 0;
      }

      ul[data-type="taskList"] li > label {
        flex-shrink: 0;
        user-select: none;
        margin-top: 0.15rem;
      }

      ul[data-type="taskList"] li > label input[type="checkbox"] {
        appearance: none;
        -webkit-appearance: none;
        width: 18px;
        height: 18px;
        border: 2px solid var(--grey-3);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
      }

      ul[data-type="taskList"] li > label input[type="checkbox"]:checked {
        background: var(--grey-5);
        border-color: var(--grey-5);
      }

      ul[data-type="taskList"] li > label input[type="checkbox"]:checked::after {
        content: '';
        width: 5px;
        height: 9px;
        border: 2px solid var(--grey-1);
        border-top: none;
        border-left: none;
        transform: rotate(45deg);
        margin-bottom: 2px;
      }

      ul[data-type="taskList"] li[data-checked="true"] > div {
        text-decoration: line-through;
        color: var(--grey-3);
      }

      ul[data-type="taskList"] li > div {
        flex: 1;
      }

      ul[data-type="taskList"] ul[data-type="taskList"] {
        margin-left: 1.5rem;
        margin-top: 0.25rem;
        margin-bottom: 0.25rem;
      }

      /* Highlight Styles */
      mark {
        background-color: #fef08a;
        border-radius: 2px;
        padding: 0.1em 0.2em;
      }

      /* Horizontal Rule */
      hr {
        border: none;
        border-top: 2px solid var(--grey-2);
        margin: 2rem 0;
      }

      [data-theme='dark'] & {
        pre {
          background: var(--grey-2);
        }
        code {
          background: var(--grey-2);
        }
        pre code {
          background: none;
          color: var(--grey-4);
        }
        mark {
          background-color: #854d0e;
          color: #fef9c3;
        }
      }
    `}
    {...props}
  >
    {props.children}
  </div>
)
}
export default PostContainer;

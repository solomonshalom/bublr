/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { useEffect, useState } from 'react'

/**
 * Bublr Pro's look: the warm orange gradient with film grain that the
 * custom-domain promo has always used, shared by every Pro surface.
 */

export const PRO_GRADIENT = 'linear-gradient(315deg, #DD814C, #BC3C00)'

// Film grain as inline SVG noise (used to be hotlinked from another site)
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

export const proSurface = css`
  position: relative;
  overflow: hidden;
  isolation: isolate;
  color: #fff;
  background: #bc3c00;
  background: ${PRO_GRADIENT};

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background-image: ${GRAIN};
    background-size: 140px 140px;
    mix-blend-mode: overlay;
    opacity: 0.45;
    pointer-events: none;
  }
`

/** Small "PRO" tag for nav items and headings */
export const proPill = css`
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.38rem;
  border-radius: 999px;
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
  color: #fff;
  background: ${PRO_GRADIENT};
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
`

/** White call-to-action button that sits on the gradient */
export const proButton = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.6rem 1.05rem;
  border: none;
  border-radius: 8px;
  background: #fff;
  color: #a33400;
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.2;
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.08), 0 6px 18px -6px rgba(80, 20, 0, 0.55);
  transition: transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease;

  /* As a link inside a container that sets "a { color: inherit }" */
  &:link,
  &:visited {
    color: #a33400;
  }

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.08), 0 10px 24px -8px rgba(80, 20, 0, 0.6);
  }

  &:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`

/** Translucent secondary button on the gradient */
export const proGhostButton = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.45rem 0.8rem;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-family: 'Inter', sans-serif;
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  white-space: nowrap;
  transition: background 150ms ease, border-color 150ms ease;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.22);
    border-color: rgba(255, 255, 255, 0.65);
  }

  &:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const SparkleIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5c.4 3.9 1.5 6.3 3.1 7.7 1.6 1.4 3.9 2 6.4 2.3-2.5.3-4.8.9-6.4 2.3-1.6 1.4-2.7 3.8-3.1 7.7-.4-3.9-1.5-6.3-3.1-7.7-1.6-1.4-3.9-2-6.4-2.3 2.5-.3 4.8-.9 6.4-2.3C10.5 8.8 11.6 6.4 12 2.5z" />
  </svg>
)

export const LockIcon = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

const blink = keyframes`
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
`

/**
 * Types out each of `words` in turn, like someone trying out addresses.
 * Shows the first word without animation for people who prefer less motion.
 */
export function useTypewriter(words, { typeMs = 85, holdMs = 1600, eraseMs = 40 } = {}) {
  const [text, setText] = useState(words[0] || '')
  const key = words.join('|')

  useEffect(() => {
    if (typeof window === 'undefined' || words.length === 0) return undefined
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || words.length === 1) {
      setText(words[0])
      return undefined
    }

    let wordIndex = 0
    let length = words[0].length
    let erasing = false
    let timer

    const tick = () => {
      const word = words[wordIndex]
      if (!erasing && length === word.length) {
        erasing = true
        timer = setTimeout(tick, holdMs)
        return
      }
      if (erasing && length === 0) {
        erasing = false
        wordIndex = (wordIndex + 1) % words.length
        timer = setTimeout(tick, 300)
        return
      }
      length += erasing ? -1 : 1
      setText(words[wordIndex].slice(0, length))
      timer = setTimeout(tick, erasing ? eraseMs : typeMs)
    }

    timer = setTimeout(tick, holdMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return text
}

const addressStyle = css`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  max-width: 100%;
  padding: 0.38rem 0.65rem;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.28);
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  line-height: 1.2;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;

  svg {
    flex-shrink: 0;
    opacity: 0.85;
  }
`

const caretStyle = css`
  display: inline-block;
  width: 1px;
  height: 0.95em;
  margin-left: 1px;
  background: currentColor;
  animation: ${blink} 1s step-end infinite;
`

/** A little browser address bar showing the writer's future domain. */
export function DomainAddress({ username, compact = false }) {
  const handle = String(username || 'yourname').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'yourname'
  const text = useTypewriter([`${handle}.com`, `blog.${handle}.com`, `${handle}.blog`])
  return (
    <span css={[addressStyle, compact && css`font-size: 0.72rem; padding: 0.3rem 0.5rem;`]} aria-label={`${handle}.com`}>
      <LockIcon />
      <span aria-hidden="true">
        {text}
        <span css={caretStyle} />
      </span>
    </span>
  )
}

/** "bublr.life/alice  →  alice.com" */
export function DomainMorph({ username }) {
  const handle = String(username || 'yourname').toLowerCase()
  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        font-size: 0.78rem;
      `}
    >
      <span
        css={css`
          font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
          opacity: 0.75;
          text-decoration: line-through;
          text-decoration-color: rgba(255, 255, 255, 0.55);
        `}
      >
        bublr.life/{handle}
      </span>
      <span aria-hidden="true" css={css`opacity: 0.8;`}>→</span>
      <DomainAddress username={handle} />
    </div>
  )
}

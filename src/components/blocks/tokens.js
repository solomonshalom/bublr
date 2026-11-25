/** @jsxImportSource @emotion/react */
import { css, Global, keyframes } from '@emotion/react'

/**
 * Shared look for the profile blocks (gallery, music, shop), ported from
 * jeremybosma.nl (github.com/jeremybosma/jeremybosma). Its neutral
 * foreground/secondary/border palette is mapped onto Bublr's profile colours
 * so the blocks sit in a profile without changing it.
 */

// Reference: cubic-bezier(0.32, 0.72, 0, 1) for every move, 0.24s slides.
export const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'

export const blockTokens = css`
  --blk-fg: rgb(33, 37, 41);
  --blk-muted: rgba(33, 37, 41, 0.6);
  --blk-secondary: rgba(0, 0, 0, 0.04);
  --blk-secondary-strong: rgba(0, 0, 0, 0.075);
  --blk-highlight: rgba(0, 0, 0, 0.035);
  --blk-border: rgb(222, 223, 223);
  --blk-ring: rgba(33, 37, 41, 0.2);
  --blk-bg: var(--grey-1, #fcfcfc);
  --blk-shadow: 0 4px 12px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08);
  --blk-danger: #dc2626;

  [data-theme='dark'] & {
    --blk-fg: rgb(229, 231, 235);
    --blk-muted: rgba(229, 231, 235, 0.6);
    --blk-secondary: rgba(255, 255, 255, 0.06);
    --blk-secondary-strong: rgba(255, 255, 255, 0.11);
    --blk-highlight: rgba(255, 255, 255, 0.055);
    --blk-border: rgba(255, 255, 255, 0.15);
    --blk-ring: rgba(229, 231, 235, 0.22);
    --blk-shadow: 0 4px 14px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.4);
    --blk-danger: #f87171;
  }
`

export const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

// The reference's page-panel entrance: rise 16px and fade in.
export const panelIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: none; }
`

/**
 * View-transition rules for the gallery lightbox/expand and the shop's
 * grid-to-product morph. Rendered once by any page that shows a block.
 * Browsers without view transitions simply swap states.
 */
export function BlockStyles() {
  return (
    <Global
      styles={css`
        @supports (view-transition-name: none) {
          html.blk-vt::view-transition-group(root),
          html.blk-vt::view-transition-old(root),
          html.blk-vt::view-transition-new(root) {
            animation-duration: 0s !important;
          }

          html.blk-vt::view-transition-group(*),
          html.blk-vt::view-transition-old(*),
          html.blk-vt::view-transition-new(*) {
            animation-duration: 0.45s;
            animation-timing-function: ${EASE};
          }

          html.gallery-expand-vt::view-transition-group(*),
          html.gallery-expand-vt::view-transition-old(*),
          html.gallery-expand-vt::view-transition-new(*) {
            animation-duration: 0.5s;
            animation-timing-function: ${EASE};
          }

          html.gallery-lightbox-vt::view-transition-group(*) {
            z-index: 1;
          }

          html.gallery-lightbox-vt::view-transition-group(gallery-scrim) {
            z-index: 90;
            animation-duration: 0.32s;
            animation-timing-function: ease-out;
          }

          html.gallery-lightbox-vt::view-transition-group(gallery-photo) {
            z-index: 100;
            animation-duration: 0.45s;
            animation-timing-function: ${EASE};
          }

          html.gallery-lightbox-vt::view-transition-image-pair(gallery-photo) {
            isolation: isolate;
          }

          html.gallery-lightbox-vt::view-transition-old(gallery-scrim) {
            animation: blk-scrim-out 0.28s ease-out both;
          }

          html.gallery-lightbox-vt::view-transition-new(gallery-scrim) {
            animation: blk-scrim-in 0.28s ease-out both;
          }

          html.gallery-lightbox-vt::view-transition-old(gallery-photo),
          html.gallery-lightbox-vt::view-transition-new(gallery-photo) {
            animation-duration: 0.45s;
            animation-timing-function: ${EASE};
            animation-fill-mode: both;
          }

          /* Shop: the page around the morphing photo and title fades. */
          html.shop-vt::view-transition-old(root) {
            animation: blk-panel-out 0.35s ${EASE} both;
          }
          html.shop-vt::view-transition-new(root) {
            animation: blk-panel-in 0.45s ${EASE} both;
          }
          html.shop-vt::view-transition-group(*) {
            animation-duration: 0.45s;
            animation-timing-function: ${EASE};
          }
        }

        @keyframes blk-scrim-in {
          from { opacity: 0; }
        }
        @keyframes blk-scrim-out {
          to { opacity: 0; }
        }
        @keyframes blk-panel-in {
          from { opacity: 0; transform: translateY(16px); }
        }
        @keyframes blk-panel-out {
          to { opacity: 0; transform: translateY(-8px) scale(0.985); }
        }

        @media (prefers-reduced-motion: reduce) {
          ::view-transition-group(*),
          ::view-transition-old(*),
          ::view-transition-new(*) {
            animation-duration: 0s !important;
          }
        }
      `}
    />
  )
}

export const supportsViewTransition = () =>
  typeof document !== 'undefined' && 'startViewTransition' in document &&
  !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/**
 * Run a DOM update inside a view transition (port of runGalleryViewTransition).
 * `update` must apply the new state synchronously (use flushSync).
 */
export function runViewTransition(update, { htmlClass = 'blk-vt', waitForPaint = false, onReady, onFinished } = {}) {
  if (!supportsViewTransition()) {
    update()
    onReady?.()
    onFinished?.()
    return
  }
  const start = () => {
    document.documentElement.classList.add(htmlClass)
    let transition
    try {
      transition = document.startViewTransition(update)
    } catch (_) {
      document.documentElement.classList.remove(htmlClass)
      update()
      onReady?.()
      onFinished?.()
      return
    }
    if (onReady) transition.ready.then(onReady).catch(() => onReady())
    transition.finished.finally(() => {
      document.documentElement.classList.remove(htmlClass)
      onFinished?.()
    })
  }
  if (waitForPaint) {
    requestAnimationFrame(() => requestAnimationFrame(start))
  } else {
    start()
  }
}

/** A view-transition-name safe for CSS from any id. */
export function vtName(prefix, id) {
  return `${prefix}-${String(id || 'x').replace(/[^a-zA-Z0-9-]/g, '') || 'x'}`
}

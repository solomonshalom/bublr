/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { forwardRef, useEffect, useRef } from 'react'
import { EASE } from './tokens'

/**
 * A list whose hover highlight slides from item to item, ported from
 * hover-slide-list.tsx / hover-slide-list-dom.ts on jeremybosma.nl. The
 * highlight is one absolutely positioned element moved with CSS variables,
 * so it glides instead of blinking on and off.
 */

const listStyle = css`
  position: relative;
  isolation: isolate;
  --hover-slide-x: 0px;
  --hover-slide-y: 0px;
  --hover-slide-w: 0px;
  --hover-slide-h: 0px;
  --hover-slide-opacity: 0;

  &.hover-slide-list--instant .hover-slide-highlight {
    transition: none;
  }

  .hover-slide-highlight {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 0;
    width: var(--hover-slide-w);
    height: var(--hover-slide-h);
    border-radius: 10px;
    background: var(--blk-highlight);
    opacity: var(--hover-slide-opacity);
    transform: translate3d(var(--hover-slide-x), var(--hover-slide-y), 0);
    transition: transform 0.24s ${EASE}, width 0.24s ${EASE}, height 0.24s ${EASE}, opacity 0.14s ease;
    pointer-events: none;
    will-change: transform, width, height, opacity;
  }

  .hover-slide-item {
    position: relative;
    z-index: 1;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.12s ${EASE};
    color: inherit;
    text-decoration: none;
  }

  button.hover-slide-item {
    border: 0;
    background: transparent;
    font: inherit;
    color: inherit;
    text-align: left;
  }

  .hover-slide-item:active {
    transform: scale(0.988);
  }

  .hover-slide-muted {
    transition: color 0.18s ${EASE};
  }

  .hover-slide-item:hover .hover-slide-muted,
  .hover-slide-item:focus-visible .hover-slide-muted {
    color: color-mix(in srgb, var(--blk-fg) 82%, var(--blk-muted));
  }

  .hover-slide-title {
    transition: color 0.18s ${EASE};
  }

  .hover-slide-item:hover .hover-slide-title,
  .hover-slide-item:focus-visible .hover-slide-title {
    color: var(--blk-fg);
  }

  .hover-slide-item--pinned::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 10px;
    background: var(--blk-highlight);
    z-index: -1;
  }

  .hover-slide-item--pinned .hover-slide-title {
    color: var(--blk-fg);
  }

  @media (prefers-reduced-motion: reduce) {
    .hover-slide-highlight,
    .hover-slide-item {
      transition: none;
    }
  }

  @media (hover: none) {
    .hover-slide-highlight {
      display: none;
    }
  }
`

const HIDDEN = {
  '--hover-slide-x': '0px',
  '--hover-slide-y': '0px',
  '--hover-slide-w': '0px',
  '--hover-slide-h': '0px',
  '--hover-slide-opacity': '0',
}

function applyVars(list, vars) {
  for (const [key, value] of Object.entries(vars)) list.style.setProperty(key, value)
}

function useHoverSlide(ref) {
  useEffect(() => {
    const list = ref.current
    if (!list) return undefined
    let active = null

    const setActive = element => {
      if (element === active) return
      active = element
      if (!element) {
        applyVars(list, HIDDEN)
        return
      }
      const listRect = list.getBoundingClientRect()
      const itemRect = element.getBoundingClientRect()
      const wasHidden = list.style.getPropertyValue('--hover-slide-opacity') !== '1'
      // Appear in place, then slide between items.
      if (wasHidden) list.classList.add('hover-slide-list--instant')
      applyVars(list, {
        '--hover-slide-x': `${itemRect.left - listRect.left + list.scrollLeft}px`,
        '--hover-slide-y': `${itemRect.top - listRect.top + list.scrollTop}px`,
        '--hover-slide-w': `${itemRect.width}px`,
        '--hover-slide-h': `${itemRect.height}px`,
        '--hover-slide-opacity': '1',
      })
      if (wasHidden) {
        requestAnimationFrame(() => requestAnimationFrame(() => list.classList.remove('hover-slide-list--instant')))
      }
    }

    const itemFrom = target => {
      const item = target instanceof Element ? target.closest('.hover-slide-item') : null
      return item instanceof HTMLElement && list.contains(item) ? item : null
    }
    const onOver = event => {
      const item = itemFrom(event.target)
      if (item) setActive(item)
    }
    const onLeave = event => {
      if (event.relatedTarget instanceof Node && list.contains(event.relatedTarget)) return
      setActive(null)
    }
    const onResize = () => setActive(null)

    list.addEventListener('mouseover', onOver)
    list.addEventListener('mouseleave', onLeave)
    list.addEventListener('focusin', onOver)
    list.addEventListener('focusout', onLeave)
    window.addEventListener('resize', onResize)
    return () => {
      list.removeEventListener('mouseover', onOver)
      list.removeEventListener('mouseleave', onLeave)
      list.removeEventListener('focusin', onOver)
      list.removeEventListener('focusout', onLeave)
      window.removeEventListener('resize', onResize)
    }
  }, [ref])
}

export const HoverSlideList = forwardRef(function HoverSlideList({ children, className, css: extraCss, ...props }, forwardedRef) {
  const innerRef = useRef(null)
  useHoverSlide(innerRef)
  const setRef = node => {
    innerRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }
  return (
    <div ref={setRef} css={[listStyle, extraCss]} className={['hover-slide-list', className].filter(Boolean).join(' ')} {...props}>
      <div className="hover-slide-highlight" aria-hidden="true" />
      {children}
    </div>
  )
})

export default HoverSlideList

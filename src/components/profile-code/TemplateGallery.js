/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildProfileDocument, FRAME_SANDBOX } from '../../lib/profile-code'

const gridStyle = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
`

const cardStyle = css`
  display: flex;
  flex-direction: column;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--grey-1);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;

  &:hover {
    border-color: var(--accent-border);
    box-shadow: var(--chord-shadow-md);
  }

  &:focus-visible {
    outline: none;
    border-color: var(--accent-border);
    box-shadow: 0 0 0 3px var(--accent-soft-strong);
  }

  &[aria-current='true'] {
    border-color: var(--accent-border);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
`

const thumbStyle = css`
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--accent-bg);
  border-bottom: 1px solid var(--border);

  iframe {
    position: absolute;
    top: 0;
    left: 0;
    border: 0;
    transform-origin: 0 0;
    pointer-events: none;
    background: transparent;
  }
`

const metaStyle = css`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.7rem 0.8rem 0.8rem;
  font-family: 'Inter', sans-serif;

  strong {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--grey-4);
  }

  span {
    font-size: 0.75rem;
    line-height: 1.45;
    color: var(--grey-3);
  }
`

const blankThumbStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 1.6rem;
  color: var(--grey-3);
  background: repeating-linear-gradient(45deg, var(--accent-bg), var(--accent-bg) 8px, transparent 8px, transparent 16px);
`

const groupTitleStyle = css`
  margin: 1.75rem 0 0.25rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--grey-4);
`

const groupHintStyle = css`
  margin: 0 0 0.85rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.78rem;
  color: var(--grey-3);
`

// The size each kind of page is drawn at before it's scaled down
const RENDER_WIDTH = { page: 1100, block: 550 }

/**
 * A live, scaled-down picture of one template filled in with the writer's
 * own data. It only loads once it scrolls into view.
 */
function TemplateThumb({ doc, theme, embed }) {
  const box = useRef(null)
  const frame = useRef(null)
  const docRef = useRef(doc)
  const themeRef = useRef(theme)
  docRef.current = doc
  themeRef.current = theme
  const [visible, setVisible] = useState(false)
  const [scale, setScale] = useState(0.25)
  const [shown, setShown] = useState(false)
  const width = RENDER_WIDTH[embed] || RENDER_WIDTH.page

  useEffect(() => {
    const el = box.current
    if (!el) return undefined
    const measure = () => setScale(el.clientWidth / width || 0.25)
    measure()
    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      ro.observe(el)
    }
    let io
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      }, { rootMargin: '200px' })
      io.observe(el)
    } else {
      setVisible(true)
    }
    return () => {
      if (ro) ro.disconnect()
      if (io) io.disconnect()
    }
  }, [width])

  useEffect(() => {
    function onMessage(event) {
      const el = frame.current
      if (!el || event.source !== el.contentWindow) return
      const message = event.data || {}
      if (message.type === 'bublr:preview-shell') {
        el.contentWindow.postMessage({ type: 'bublr:render', html: docRef.current }, '*')
      } else if (message.type === 'bublr:ready') {
        el.contentWindow.postMessage({ type: 'bublr:theme', theme: themeRef.current }, '*')
        setShown(true)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    try {
      frame.current?.contentWindow?.postMessage({ type: 'bublr:theme', theme }, '*')
    } catch (_) {
      // not loaded yet
    }
  }, [theme])

  const height = Math.round((width * 3) / 4)

  return (
    <div ref={box} css={thumbStyle} aria-hidden="true">
      {visible && (
        <iframe
          ref={frame}
          src="/api/profile-preview"
          title=""
          tabIndex={-1}
          sandbox={FRAME_SANDBOX}
          css={css`
            width: ${width}px;
            height: ${height}px;
            transform: scale(${scale});
            opacity: ${shown ? 1 : 0};
            transition: opacity 200ms ease;
            color-scheme: ${theme === 'dark' ? 'dark' : 'light'};
            padding: ${embed === 'block' ? '24px' : '0'};
            box-sizing: border-box;
          `}
        />
      )}
    </div>
  )
}

/**
 * Every starter template as a card with a live thumbnail. Picking one is
 * instant: it only replaces what's in the editor (with Undo), never what's
 * on the profile.
 */
export default function TemplateGallery({ templates, data, theme, onPick, currentId }) {
  const docs = useMemo(() => {
    const out = {}
    if (!data) return out
    for (const t of templates) {
      if (t.id === 'blank') continue
      const { html } = buildProfileDocument({ code: t, data, embed: t.mode === 'block' ? 'block' : 'page', preview: true })
      // A thumbnail is a still picture: no scrollbars
      out[t.id] = `${html}<style>html,body{overflow:hidden!important;scrollbar-width:none}</style>`
    }
    return out
  }, [templates, data])

  const pages = templates.filter(t => t.mode !== 'block' && t.id !== 'blank')
  const blocks = templates.filter(t => t.mode === 'block')
  const blank = templates.find(t => t.id === 'blank')

  const card = t => (
    <button
      key={t.id}
      type="button"
      css={cardStyle}
      onClick={() => onPick(t)}
      aria-current={currentId === t.id ? 'true' : undefined}
    >
      {t.id === 'blank' ? (
        <div css={[thumbStyle, blankThumbStyle]} aria-hidden="true">
          {'</>'}
        </div>
      ) : (
        <TemplateThumb doc={docs[t.id]} theme={theme} embed={t.mode === 'block' ? 'block' : 'page'} />
      )}
      <span css={metaStyle}>
        <strong>{t.name}</strong>
        <span>{t.description}</span>
      </span>
    </button>
  )

  return (
    <div>
      <h3 css={groupTitleStyle}>Whole page</h3>
      <p css={groupHintStyle}>Replaces your profile. Visitors can still reach your normal profile from a small bar.</p>
      <div css={gridStyle}>
        {pages.map(card)}
        {blank && card(blank)}
      </div>

      {blocks.length > 0 && (
        <>
          <h3 css={groupTitleStyle}>Section</h3>
          <p css={groupHintStyle}>A box inside your normal profile, above or below your other sections.</p>
          <div css={gridStyle}>{blocks.map(card)}</div>
        </>
      )}
    </div>
  )
}

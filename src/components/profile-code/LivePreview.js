/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useEffect, useRef, useState } from 'react'
import { FRAME_SANDBOX } from '../../lib/profile-code'

const MAX_HEIGHT = 20000

/**
 * The editor's live preview. Each new version of the page loads into a fresh
 * sandboxed shell (/api/profile-preview) behind the current one and swaps in
 * once it reports ready, so typing never flashes a blank frame.
 */
export default function LivePreview({ doc, theme, embed = 'page', device = 'desktop', label = 'Preview' }) {
  const [frames, setFrames] = useState([])
  const [visibleId, setVisibleId] = useState(0)
  const [heights, setHeights] = useState({})
  const framesRef = useRef(frames)
  const visibleRef = useRef(visibleId)
  const themeRef = useRef(theme)
  const nextId = useRef(1)
  const elements = useRef(new Map())
  framesRef.current = frames
  visibleRef.current = visibleId
  themeRef.current = theme

  useEffect(() => {
    if (typeof doc !== 'string') return
    const id = nextId.current++
    // Keep the frame on screen, replace anything still loading
    setFrames(prev => [...prev.filter(f => f.id === visibleRef.current), { id, doc }])
  }, [doc])

  useEffect(() => {
    function onMessage(event) {
      for (const frame of framesRef.current) {
        const el = elements.current.get(frame.id)
        if (!el || event.source !== el.contentWindow) continue
        const message = event.data || {}
        if (message.type === 'bublr:preview-shell') {
          el.contentWindow.postMessage({ type: 'bublr:render', html: frame.doc }, '*')
        } else if (message.type === 'bublr:ready') {
          el.contentWindow.postMessage({ type: 'bublr:theme', theme: themeRef.current }, '*')
          if (frame.id > visibleRef.current) {
            visibleRef.current = frame.id
            setVisibleId(frame.id)
            setFrames(prev => prev.filter(f => f.id >= frame.id))
          }
        } else if (message.type === 'bublr:height') {
          const h = Math.max(40, Math.min(MAX_HEIGHT, Math.round(Number(message.height) || 0)))
          setHeights(prev => (prev[frame.id] === h ? prev : { ...prev, [frame.id]: h }))
        }
        return
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    for (const el of elements.current.values()) {
      try {
        el.contentWindow?.postMessage({ type: 'bublr:theme', theme }, '*')
      } catch (_) {
        // gone
      }
    }
  }, [theme])

  const isBlock = embed === 'block'
  const visibleHeight = heights[visibleId] || 200

  return (
    <div
      css={css`
        position: relative;
        height: 100%;
        overflow: auto;
        background: ${isBlock ? 'var(--grey-1)' : 'var(--accent-bg)'};
        display: flex;
        justify-content: center;
      `}
    >
      <div
        css={css`
          position: relative;
          width: ${device === 'phone' ? '390px' : '100%'};
          max-width: 100%;
          height: ${isBlock ? 'auto' : '100%'};
          min-height: ${isBlock ? `${visibleHeight + 48}px` : 'auto'};
          padding: ${isBlock ? '24px' : '0'};
          ${device === 'phone' ? 'border-left: 1px solid var(--border); border-right: 1px solid var(--border);' : ''}
          ${isBlock ? 'max-width: min(100%, 550px);' : ''}
        `}
      >
        {isBlock && (
          <p
            css={css`
              font-family: 'Inter', sans-serif;
              font-size: 11px;
              color: var(--grey-3);
              margin: 0 0 8px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            `}
          >
            Section on your profile
          </p>
        )}
        {frames.map(frame => (
          <iframe
            key={frame.id}
            ref={el => {
              if (el) elements.current.set(frame.id, el)
              else elements.current.delete(frame.id)
            }}
            src="/api/profile-preview"
            title={label}
            sandbox={FRAME_SANDBOX}
            aria-hidden={frame.id !== visibleId}
            tabIndex={frame.id === visibleId ? 0 : -1}
            css={css`
              display: block;
              width: 100%;
              border: 0;
              background: transparent;
              color-scheme: ${theme === 'dark' ? 'dark' : 'light'};
              height: ${isBlock ? `${heights[frame.id] || 200}px` : '100%'};
              ${frame.id === visibleId
                ? ''
                : `position: absolute; top: ${isBlock ? '48px' : '0'}; left: ${isBlock ? '24px' : '0'}; right: ${isBlock ? '24px' : '0'}; width: auto; visibility: hidden; pointer-events: none;`}
            `}
          />
        ))}
      </div>
    </div>
  )
}

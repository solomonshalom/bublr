/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useEffect, useRef, useState } from 'react'
import { FRAME_SANDBOX } from '../../lib/profile-code'
import { heightFollower } from './height'

// A section sits in the classic profile's 550px column, inside its gutters and
// the content box's padding: 430px wide on a desktop, 318px on a 390px phone.
const SECTION = {
  desktop: { width: 550, padding: 60 },
  phone: { width: 390, padding: 36 },
}
const SECTION_TOP = 40 // room for the "Section on your profile" label

/**
 * The editor's live preview. Each new version of the page loads into a fresh
 * sandboxed shell (/api/profile-preview) behind the current one and swaps in
 * once it reports ready, so typing never flashes a blank frame.
 */
export default function LivePreview({ doc, theme, embed = 'page', device = 'desktop', label = 'Preview', onSave }) {
  const [frames, setFrames] = useState([])
  const [visibleId, setVisibleId] = useState(0)
  const [heights, setHeights] = useState({})
  const framesRef = useRef(frames)
  const visibleRef = useRef(visibleId)
  const themeRef = useRef(theme)
  const nextId = useRef(1)
  const elements = useRef(new Map())
  const followers = useRef(new Map())
  const scroller = useRef(null)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
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
        } else if (message.type === 'bublr:save') {
          // ⌘S pressed inside the preview. Only while the writer is in the
          // frame and just pressed a key, so code in the preview can't save itself.
          const typing = document.activeElement === el && (!navigator.userActivation || navigator.userActivation.isActive)
          if (typing && frame.id === visibleRef.current && onSaveRef.current) onSaveRef.current()
        } else if (message.type === 'bublr:height') {
          // Same rules as the live section, so the preview can't run away either
          if (!followers.current.has(frame.id)) followers.current.set(frame.id, heightFollower())
          const h = followers.current.get(frame.id)(message.height)
          if (h !== null) setHeights(prev => (prev[frame.id] === h ? prev : { ...prev, [frame.id]: h }))
        } else if (message.type === 'bublr:scroll') {
          // A "#section" link in a section: scroll the preview to it
          const box = scroller.current
          const y = Number(message.top)
          const clicked = document.activeElement === el && (!navigator.userActivation || navigator.userActivation.isActive)
          if (clicked && box && Number.isFinite(y) && frame.id === visibleRef.current) {
            const offset = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
            box.scrollTo({ top: Math.max(0, offset + Math.min(y, el.clientHeight) - 16), behavior: 'smooth' })
          }
        }
        return
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Forget the height rules of frames that are gone
  useEffect(() => {
    const live = new Set(frames.map(f => f.id))
    for (const id of followers.current.keys()) if (!live.has(id)) followers.current.delete(id)
  }, [frames])

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
  const section = SECTION[device === 'phone' ? 'phone' : 'desktop']

  return (
    <div
      ref={scroller}
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
          box-sizing: border-box;
          width: ${isBlock ? `${section.width}px` : device === 'phone' ? '390px' : '100%'};
          max-width: 100%;
          height: ${isBlock ? 'auto' : '100%'};
          min-height: ${isBlock ? `${visibleHeight + SECTION_TOP + 24}px` : 'auto'};
          padding: ${isBlock ? `${SECTION_TOP}px min(${section.padding}px, 5%) 24px` : '0'};
          ${device === 'phone' ? 'border-left: 1px solid var(--border); border-right: 1px solid var(--border);' : ''}
          flex: none;
        `}
      >
        {isBlock && (
          <p
            css={css`
              position: absolute;
              top: 14px;
              left: min(${section.padding}px, 5%);
              right: min(${section.padding}px, 5%);
              margin: 0;
              font-family: 'Inter', sans-serif;
              font-size: 11px;
              color: var(--grey-3);
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
                : `position: absolute; top: ${isBlock ? `${SECTION_TOP}px` : '0'}; left: ${isBlock ? `min(${section.padding}px, 5%)` : '0'}; right: ${isBlock ? `min(${section.padding}px, 5%)` : '0'}; width: auto; visibility: hidden; pointer-events: none;`}
            `}
          />
        ))}
      </div>
    </div>
  )
}

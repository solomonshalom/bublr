/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { FRAME_SANDBOX } from '../../lib/profile-code'

const MIN_HEIGHT = 40
const MAX_HEIGHT = 20000

/**
 * A writer's Profile HTML in a sandboxed iframe (see lib/profile-code.js for
 * the safety model). Tells the page which theme the visitor is using and, as
 * a block on the classic profile, grows to the height the page reports.
 *
 * Only messages from this frame's own window are read, and the only things a
 * page can say are "ready" and "my height is N".
 */
const ProfileCodeFrame = forwardRef(function ProfileCodeFrame(
  { src, embed = 'page', theme, title, onReady, css: extraCss, ...rest },
  forwardedRef
) {
  const ref = useRef(null)
  const [height, setHeight] = useState(160)
  const heightRef = useRef(160)
  const growth = useRef({ count: 0, since: 0, frozen: false })
  const themeRef = useRef(theme)
  themeRef.current = theme
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useImperativeHandle(forwardedRef, () => ref.current)

  const post = useCallback(message => {
    try {
      // The frame has an opaque origin, so '*' is the only target that reaches
      // it. Nothing private is ever sent.
      ref.current?.contentWindow?.postMessage(message, '*')
    } catch (_) {
      // frame gone
    }
  }, [])

  const acceptHeight = useCallback(value => {
    let next = Math.round(Number(value) || 0)
    if (!Number.isFinite(next)) return
    next = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, next))
    const g = growth.current
    const now = Date.now()
    if (next > heightRef.current) {
      // A page sized to "100% of the frame plus a margin" grows every time we
      // resize it. Stop following after a burst of growth.
      if (now - g.since > 2000) {
        g.since = now
        g.count = 0
      }
      g.count += 1
      if (g.count > 25) g.frozen = true
      if (g.frozen) return
    } else {
      g.frozen = false
      g.count = 0
    }
    heightRef.current = next
    setHeight(next)
  }, [])

  useEffect(() => {
    function onMessage(event) {
      const frame = ref.current
      if (!frame || event.source !== frame.contentWindow) return
      const message = event.data
      if (!message || typeof message !== 'object') return
      if (message.type === 'bublr:ready') {
        if (themeRef.current) post({ type: 'bublr:theme', theme: themeRef.current })
        if (onReadyRef.current) onReadyRef.current()
      } else if (message.type === 'bublr:height' && embed === 'block') {
        acceptHeight(message.height)
      }
    }
    window.addEventListener('message', onMessage)
    // The frame may have finished loading before this listener existed
    post({ type: 'bublr:hello' })
    return () => window.removeEventListener('message', onMessage)
  }, [embed, post, acceptHeight])

  useEffect(() => {
    if (theme) post({ type: 'bublr:theme', theme })
  }, [theme, post])

  useEffect(() => {
    growth.current = { count: 0, since: 0, frozen: false }
  }, [src])

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      sandbox={FRAME_SANDBOX}
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={() => post({ type: 'bublr:hello' })}
      css={[
        css`
          display: block;
          width: 100%;
          border: 0;
          background: transparent;
          color-scheme: ${theme === 'dark' ? 'dark' : 'light'};
        `,
        embed === 'block' &&
          css`
            height: ${height}px;
            transition: height 120ms ease;
          `,
        extraCss,
      ]}
      {...rest}
    />
  )
})

export default ProfileCodeFrame

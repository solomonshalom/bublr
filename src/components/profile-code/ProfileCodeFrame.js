/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { FRAME_SANDBOX } from '../../lib/profile-code'
import { heightFollower } from './height'

/**
 * A writer's Profile HTML in a sandboxed iframe (see lib/profile-code.js for
 * the safety model). Tells the page which theme the visitor is using and, as
 * a block on the classic profile, grows to the height the page reports.
 *
 * Only messages from this frame's own window are read, and the only things a
 * page can say are "ready", "my height is N" and (as a section, right after a
 * click on a #link) "scroll to N px from my top".
 */
const ProfileCodeFrame = forwardRef(function ProfileCodeFrame(
  { src, embed = 'page', theme, title, onReady, css: extraCss, ...rest },
  forwardedRef
) {
  const ref = useRef(null)
  const [height, setHeight] = useState(160)
  const follow = useRef(heightFollower({ start: 160 }))
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
    const next = follow.current(value)
    if (next !== null) setHeight(next)
  }, [])

  // A "#section" link inside a section: scroll the profile to it
  const scrollToOffset = useCallback(top => {
    const frame = ref.current
    const y = Math.round(Number(top))
    if (!frame || !Number.isFinite(y)) return
    // Only right after a click inside this frame (it has focus, and the click's
    // activation reaches this page), so a section can't keep pulling the
    // visitor back to itself
    if (document.activeElement !== frame) return
    if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.isActive) return
    const rect = frame.getBoundingClientRect()
    const within = Math.max(0, Math.min(y, rect.height))
    window.scrollTo({ top: window.scrollY + rect.top + within - 24, behavior: 'smooth' })
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
      } else if (message.type === 'bublr:scroll' && embed === 'block') {
        scrollToOffset(message.top)
      }
    }
    window.addEventListener('message', onMessage)
    // The frame may have finished loading before this listener existed
    post({ type: 'bublr:hello', path: window.location.pathname })
    return () => window.removeEventListener('message', onMessage)
  }, [embed, post, acceptHeight, scrollToOffset])

  useEffect(() => {
    if (theme) post({ type: 'bublr:theme', theme })
  }, [theme, post])

  useEffect(() => {
    follow.current = heightFollower({ start: 160 })
  }, [src])

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      sandbox={FRAME_SANDBOX}
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={() => post({ type: 'bublr:hello', path: window.location.pathname })}
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

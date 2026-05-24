/** @jsxImportSource @emotion/react */
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { prefersReducedMotion, GSAP_ENTER } from '../lib/animation-config'

/**
 * GsapReveal — fades + settles its children in on mount.
 *
 * Use it for content that appears AFTER the page transition has already
 * finished — typically async data that loads in (e.g. a post opening in the
 * editor). Without this, that content hard-swaps into place and pops in
 * instantly; GsapReveal gives it the same buttery feel as page navigation,
 * because both share the GSAP_ENTER tokens.
 *
 * Like PageTransition, it animates `transform` (y), so it clearProps:'transform'
 * once the entrance finishes — restoring transform:none so any position:fixed
 * descendants (modals, toolbars) stay anchored to the viewport.
 */
export function GsapReveal({
  children,
  className,
  style,
  duration = GSAP_ENTER.duration,
  y = GSAP_ENTER.y,
  ease = GSAP_ENTER.ease,
  delay = 0,
}) {
  const ref = useRef(null)

  useGSAP(
    () => {
      if (!ref.current) return

      if (prefersReducedMotion()) {
        gsap.set(ref.current, { opacity: 1, clearProps: 'transform' })
        return
      }

      gsap.set(ref.current, { opacity: 0, y })
      gsap.to(ref.current, {
        opacity: 1,
        y: 0,
        duration,
        delay,
        ease,
        clearProps: 'transform',
      })
    },
    { scope: ref }
  )

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}

export default GsapReveal

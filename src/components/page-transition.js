/** @jsxImportSource @emotion/react */
import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { prefersReducedMotion, GSAP_ENTER, GSAP_EXIT } from '../lib/animation-config'

// Entrance/exit feel lives in lib/animation-config (GSAP_ENTER / GSAP_EXIT) so
// page navigation and content-load reveals (GsapReveal) stay perfectly in sync.
// Enter = opacity 0→1 + an 8px upward settle; exit = quick opacity fade only.
const { duration: ENTER_DURATION, y: ENTER_Y, ease: ENTER_EASE } = GSAP_ENTER
const { duration: EXIT_DURATION, ease: EXIT_EASE } = GSAP_EXIT

/**
 * PageTransition — global, buttery page transitions (GSAP).
 *
 * Wraps the whole app in _app.js, so it runs on every client-side navigation:
 *   • Enter: opacity 0→1 + y 8→0 (subtle settle)
 *   • Exit:  opacity 1→0 only (no transform) so leaving never offsets overlays
 *   • Sequence: fade out → scroll reset → swap content → fade + settle in
 *
 * Built on the official useGSAP() hook from @gsap/react: it's SSR-safe (uses the
 * isomorphic layout effect under the hood) and auto-reverts tweens via
 * gsap.context() on unmount. Tweens fired from router-event handlers are wrapped
 * in contextSafe() so they're tracked by that context.
 *
 * IMPORTANT: the entrance animates `transform` (y). An inline transform turns the
 * container into a containing block for `position: fixed` descendants (modals,
 * notification panel, etc.). We clearProps:'transform' the moment the entrance
 * finishes, so the container returns to transform:none and fixed overlays stay
 * anchored to the viewport. The exit is opacity-only for the same reason.
 */
export function PageTransition({ children }) {
  const containerRef = useRef(null)
  const router = useRouter()
  const [displayedChildren, setDisplayedChildren] = useState(children)
  const isFirstMount = useRef(true)
  const isNavigating = useRef(false)

  // Always-current children, without retriggering the route effect
  const childrenRef = useRef(children)
  childrenRef.current = children

  // Initial mount: animate the first paint in (SSR-safe via useGSAP)
  useGSAP(
    () => {
      if (!containerRef.current || !isFirstMount.current) return
      isFirstMount.current = false

      if (prefersReducedMotion()) {
        gsap.set(containerRef.current, { opacity: 1, clearProps: 'transform' })
        return
      }

      gsap.set(containerRef.current, { opacity: 0, y: ENTER_Y })
      gsap.to(containerRef.current, {
        opacity: 1,
        y: 0,
        duration: ENTER_DURATION,
        ease: ENTER_EASE,
        clearProps: 'transform',
      })
    },
    { scope: containerRef }
  )

  // Route changes: fade out → swap → fade + settle in
  useGSAP(
    (context, contextSafe) => {
      const fadeOut = contextSafe(() =>
        gsap.to(containerRef.current, {
          opacity: 0,
          duration: EXIT_DURATION,
          ease: EXIT_EASE,
        })
      )

      const fadeIn = contextSafe(() =>
        gsap.to(containerRef.current, {
          opacity: 1,
          y: 0,
          duration: ENTER_DURATION,
          ease: ENTER_EASE,
          clearProps: 'transform', // drop inline transform so fixed overlays aren't contained
          onComplete: () => {
            isNavigating.current = false
          },
        })
      )

      const handleStart = (url) => {
        if (url === router.asPath || !containerRef.current) return
        isNavigating.current = true
        if (prefersReducedMotion()) return // reduced motion: swap instantly in handleComplete
        fadeOut()
      }

      const handleComplete = () => {
        if (!containerRef.current) return

        // Scroll to top while faded out (single source of truth for scroll reset)
        window.scrollTo(0, 0)

        if (prefersReducedMotion()) {
          setDisplayedChildren(childrenRef.current)
          gsap.set(containerRef.current, { opacity: 1, clearProps: 'transform' })
          isNavigating.current = false
          return
        }

        // Hide + offset the incoming content before it paints, then settle it in
        gsap.set(containerRef.current, { opacity: 0, y: ENTER_Y })
        setDisplayedChildren(childrenRef.current)
        requestAnimationFrame(() => {
          if (containerRef.current) fadeIn()
        })
      }

      const handleError = () => {
        if (containerRef.current) {
          gsap.set(containerRef.current, { opacity: 1, clearProps: 'transform' })
        }
        isNavigating.current = false
      }

      router.events.on('routeChangeStart', handleStart)
      router.events.on('routeChangeComplete', handleComplete)
      router.events.on('routeChangeError', handleError)

      return () => {
        router.events.off('routeChangeStart', handleStart)
        router.events.off('routeChangeComplete', handleComplete)
        router.events.off('routeChangeError', handleError)
      }
    },
    { scope: containerRef, dependencies: [router] }
  )

  // Reflect in-page children updates while we're NOT mid-navigation
  // (plain effect — this is React state sync, not animation)
  useEffect(() => {
    if (!isNavigating.current) {
      setDisplayedChildren(children)
    }
  }, [children])

  return <div ref={containerRef}>{displayedChildren}</div>
}

export default PageTransition

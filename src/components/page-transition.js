/** @jsxImportSource @emotion/react */
import { useRef, useEffect, useLayoutEffect, useState } from 'react'
import { useRouter } from 'next/router'
import gsap from 'gsap'

// Use useLayoutEffect on client, useEffect on server (to avoid SSR warnings)
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * PageTransition - Buttery smooth page transitions using GSAP
 *
 * Uses opacity-only crossfade to avoid conflicts with scroll reset.
 * Proper sequencing: fade out → scroll reset → content swap → fade in
 */
export function PageTransition({ children }) {
  const containerRef = useRef(null)
  const router = useRouter()
  const [displayedChildren, setDisplayedChildren] = useState(children)
  const isFirstMount = useRef(true)
  const isNavigating = useRef(false)

  // Stable refs to avoid effect dependencies changing
  const childrenRef = useRef(children)
  childrenRef.current = children

  // Initial mount - set opacity immediately before paint
  useIsomorphicLayoutEffect(() => {
    if (containerRef.current && isFirstMount.current) {
      // Set initial opacity to 0, then animate in
      gsap.set(containerRef.current, { opacity: 0 })
      gsap.to(containerRef.current, {
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out'
      })
      isFirstMount.current = false
    }
  }, [])

  // Handle route changes
  useEffect(() => {
    const handleStart = (url) => {
      if (url === router.asPath || !containerRef.current) return

      isNavigating.current = true

      // Quick fade out
      gsap.to(containerRef.current, {
        opacity: 0,
        duration: 0.15,
        ease: 'power1.in'
      })
    }

    const handleComplete = () => {
      if (!containerRef.current) return

      // Scroll to top while faded out
      window.scrollTo(0, 0)

      // Update content
      setDisplayedChildren(childrenRef.current)

      // Fade in after a frame to ensure DOM updated
      requestAnimationFrame(() => {
        if (containerRef.current) {
          gsap.to(containerRef.current, {
            opacity: 1,
            duration: 0.4,
            ease: 'power2.out',
            onComplete: () => {
              isNavigating.current = false
            }
          })
        }
      })
    }

    const handleError = () => {
      if (containerRef.current) {
        gsap.set(containerRef.current, { opacity: 1 })
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
  }, [router])

  // Sync children when not navigating (for in-page updates)
  useEffect(() => {
    if (!isNavigating.current) {
      setDisplayedChildren(children)
    }
  }, [children])

  return (
    <div ref={containerRef}>
      {displayedChildren}
    </div>
  )
}

export default PageTransition

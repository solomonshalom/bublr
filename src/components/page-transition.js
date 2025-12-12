/** @jsxImportSource @emotion/react */
import { useRef, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { prefersReducedMotion } from '../lib/animation-config'

// Register GSAP plugin
gsap.registerPlugin(useGSAP)

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
  const [currentPath, setCurrentPath] = useState(router.asPath)
  const isAnimatingRef = useRef(false)
  const pendingChildrenRef = useRef(null)

  // Check reduced motion preference
  const reducedMotion = typeof window !== 'undefined' && prefersReducedMotion()

  // Fade in animation when content changes
  const fadeIn = useCallback(() => {
    if (!containerRef.current) return

    if (reducedMotion) {
      gsap.set(containerRef.current, { opacity: 1 })
      return
    }

    gsap.fromTo(
      containerRef.current,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out',
        clearProps: 'opacity',
        onComplete: () => {
          isAnimatingRef.current = false
        }
      }
    )
  }, [reducedMotion])

  // Handle route changes with proper sequencing
  useEffect(() => {
    const handleStart = (url) => {
      // Only animate if navigating to a different page
      if (url === router.asPath || !containerRef.current) return

      isAnimatingRef.current = true

      if (reducedMotion) {
        gsap.set(containerRef.current, { opacity: 0 })
        return
      }

      // Quick fade out
      gsap.to(containerRef.current, {
        opacity: 0,
        duration: 0.15,
        ease: 'power1.in'
      })
    }

    const handleComplete = (url) => {
      // Scroll to top immediately (while faded out)
      window.scrollTo(0, 0)

      // Update path and trigger content swap
      setCurrentPath(url)
    }

    const handleError = () => {
      // On error, ensure we're visible
      if (containerRef.current) {
        gsap.set(containerRef.current, { opacity: 1 })
      }
      isAnimatingRef.current = false
    }

    router.events.on('routeChangeStart', handleStart)
    router.events.on('routeChangeComplete', handleComplete)
    router.events.on('routeChangeError', handleError)

    return () => {
      router.events.off('routeChangeStart', handleStart)
      router.events.off('routeChangeComplete', handleComplete)
      router.events.off('routeChangeError', handleError)
    }
  }, [router, reducedMotion])

  // Update displayed children when path changes
  useEffect(() => {
    pendingChildrenRef.current = children
  }, [children])

  // When path changes, swap content and fade in
  useEffect(() => {
    if (pendingChildrenRef.current) {
      setDisplayedChildren(pendingChildrenRef.current)
      pendingChildrenRef.current = null
      // Small delay to ensure DOM has updated before animating
      requestAnimationFrame(() => {
        fadeIn()
      })
    }
  }, [currentPath, fadeIn])

  // Initial mount animation
  useEffect(() => {
    if (containerRef.current) {
      fadeIn()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount - fadeIn is stable via useCallback

  return (
    <div
      ref={containerRef}
      style={{ opacity: 0 }} // Start invisible, animate in
    >
      {displayedChildren}
    </div>
  )
}

export default PageTransition

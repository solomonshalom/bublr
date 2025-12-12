/** @jsxImportSource @emotion/react */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Lenis from '@studio-freight/lenis'
import { prefersReducedMotion } from '../lib/animation-config'

const SmoothScrollContext = createContext(null)

export function useSmoothScroll() {
  return useContext(SmoothScrollContext)
}

export function SmoothScrollProvider({ children }) {
  const [lenis, setLenis] = useState(null)
  const rafRef = useRef(null)
  const router = useRouter()

  useEffect(() => {
    // Don't initialize on server or if user prefers reduced motion
    if (typeof window === 'undefined' || prefersReducedMotion()) {
      return
    }

    const lenisInstance = new Lenis({
      lerp: 0.12, // Slightly higher for snappier feel
      duration: 1.0, // Shorter duration
      smoothWheel: true,
      wheelMultiplier: 1, // Normal wheel speed
      touchMultiplier: 1.5,
      infinite: false,
    })

    setLenis(lenisInstance)

    // RAF loop for smooth updates
    function raf(time) {
      lenisInstance.raf(time)
      rafRef.current = requestAnimationFrame(raf)
    }

    rafRef.current = requestAnimationFrame(raf)

    // Add lenis class to html for CSS targeting
    document.documentElement.classList.add('lenis')

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      lenisInstance.destroy()
      document.documentElement.classList.remove('lenis')
    }
  }, [])

  // Stop Lenis during navigation to prevent scroll interference
  // Note: Scroll reset is handled by PageTransition component (single source of truth)
  useEffect(() => {
    const handleStart = () => {
      if (lenis) {
        lenis.stop()
      }
    }
    const handleComplete = () => {
      if (lenis) {
        // Just restart Lenis - scroll reset is handled by PageTransition
        lenis.start()
      }
    }

    router.events.on('routeChangeStart', handleStart)
    router.events.on('routeChangeComplete', handleComplete)
    router.events.on('routeChangeError', handleComplete)

    return () => {
      router.events.off('routeChangeStart', handleStart)
      router.events.off('routeChangeComplete', handleComplete)
      router.events.off('routeChangeError', handleComplete)
    }
  }, [lenis, router])

  return (
    <SmoothScrollContext.Provider value={lenis}>
      {children}
    </SmoothScrollContext.Provider>
  )
}

// Hook to scroll to a specific element or position
export function useScrollTo() {
  const lenis = useSmoothScroll()

  return (target, options = {}) => {
    if (lenis) {
      lenis.scrollTo(target, {
        offset: 0,
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        ...options,
      })
    } else if (typeof window !== 'undefined') {
      // Fallback for when Lenis is not available
      if (typeof target === 'number') {
        window.scrollTo({ top: target, behavior: 'smooth' })
      } else if (target instanceof Element) {
        target.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }
}

/** @jsxImportSource @emotion/react */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import Lenis from '@studio-freight/lenis'
import { prefersReducedMotion } from '../lib/animation-config'

const SmoothScrollContext = createContext(null)

export function useSmoothScroll() {
  return useContext(SmoothScrollContext)
}

export function SmoothScrollProvider({ children }) {
  const [lenis, setLenis] = useState(null)
  const rafRef = useRef(null)

  useEffect(() => {
    // Don't initialize on server or if user prefers reduced motion
    if (typeof window === 'undefined' || prefersReducedMotion()) {
      return
    }

    const lenisInstance = new Lenis({
      lerp: 0.1, // Smoothness factor (lower = smoother)
      duration: 1.2, // Scroll duration
      smoothWheel: true,
      wheelMultiplier: 0.8, // Slightly reduce wheel speed for premium feel
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

  // Handle route changes - scroll to top
  useEffect(() => {
    if (lenis) {
      lenis.scrollTo(0, { immediate: true })
    }
  }, [lenis])

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

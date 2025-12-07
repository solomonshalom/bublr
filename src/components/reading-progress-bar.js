/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect, useRef } from 'react'

// Default color if no post color is provided
const DEFAULT_COLOR = '#4D96FF'

export default function ReadingProgressBar({ color = DEFAULT_COLOR }) {
  const [progress, setProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const rafRef = useRef(null)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const calculateProgress = () => {
      // Get the article content or use the full document
      const article = document.querySelector('article')
      const element = article || document.documentElement

      // Calculate scroll progress
      const windowHeight = window.innerHeight
      const documentHeight = element.scrollHeight
      const scrollTop = window.scrollY || document.documentElement.scrollTop

      // For article-specific progress, we need to account for the article's position
      let start = 0
      let end = documentHeight - windowHeight

      if (article) {
        const rect = article.getBoundingClientRect()
        start = scrollTop + rect.top - windowHeight * 0.3 // Start when article is ~30% visible
        end = scrollTop + rect.bottom - windowHeight * 0.7 // End when ~70% of article is read
      }

      // Calculate the percentage
      let percentage = 0
      if (scrollTop >= start) {
        percentage = Math.min(100, Math.max(0, ((scrollTop - start) / (end - start)) * 100))
      }

      setProgress(percentage)

      // Show the bar after scrolling a bit (50px)
      setIsVisible(scrollTop > 50)
    }

    const handleScroll = () => {
      // Throttle using RAF for performance
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }

      rafRef.current = requestAnimationFrame(() => {
        // Only update if scroll position changed significantly
        const currentScrollY = window.scrollY
        if (Math.abs(currentScrollY - lastScrollY.current) > 2) {
          lastScrollY.current = currentScrollY
          calculateProgress()
        }
      })
    }

    // Initial calculation
    calculateProgress()

    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  // Don't render if not visible (before user starts scrolling)
  if (!isVisible && progress === 0) {
    return null
  }

  return (
    <div
      css={css`
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        z-index: 9999;
        background: transparent;
        pointer-events: none;
        opacity: ${isVisible ? 1 : 0};
        transition: opacity 0.3s ease;
      `}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    >
      {/* Progress fill */}
      <div
        css={css`
          height: 100%;
          width: ${progress}%;
          background: ${color};
          transition: width 0.1s ease-out;
          will-change: width;
          box-shadow: 0 0 10px ${color}40;
        `}
      />
    </div>
  )
}

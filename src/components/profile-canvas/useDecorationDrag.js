/** @jsxImportSource @emotion/react */
import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Custom hook for handling decoration drag operations
 * Supports both mouse and touch events
 */
export default function useDecorationDrag({
  containerRef,
  onDragEnd,
  enabled = true,
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const startPosRef = useRef({ x: 0, y: 0 })
  const currentPosRef = useRef({ x: 0, y: 0 })

  const getPointerPosition = useCallback((e) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    return { x: e.clientX, y: e.clientY }
  }, [])

  const handleDragStart = useCallback((e, initialX, initialY) => {
    if (!enabled) return

    e.preventDefault()
    e.stopPropagation()

    const pos = getPointerPosition(e)
    startPosRef.current = pos
    currentPosRef.current = { x: initialX, y: initialY }

    setIsDragging(true)
    setDragOffset({ x: 0, y: 0 })
  }, [enabled, getPointerPosition])

  const handleDragMove = useCallback((e) => {
    if (!isDragging || !containerRef?.current) return

    e.preventDefault()

    const pos = getPointerPosition(e)
    const container = containerRef.current.getBoundingClientRect()

    // Calculate delta from start position
    const deltaX = pos.x - startPosRef.current.x
    const deltaY = pos.y - startPosRef.current.y

    // Convert to percentage of container
    const deltaXPercent = (deltaX / container.width) * 100
    const deltaYPercent = (deltaY / container.height) * 100

    setDragOffset({ x: deltaXPercent, y: deltaYPercent })
  }, [isDragging, containerRef, getPointerPosition])

  const handleDragEnd = useCallback((e) => {
    if (!isDragging) return

    e?.preventDefault()

    // Calculate final position
    const finalX = Math.max(0, Math.min(100, currentPosRef.current.x + dragOffset.x))
    const finalY = Math.max(0, Math.min(100, currentPosRef.current.y + dragOffset.y))

    setIsDragging(false)
    setDragOffset({ x: 0, y: 0 })

    if (onDragEnd) {
      onDragEnd(finalX, finalY)
    }
  }, [isDragging, dragOffset, onDragEnd])

  // Global event listeners for drag
  useEffect(() => {
    if (!isDragging) return

    const handleMove = (e) => handleDragMove(e)
    const handleEnd = (e) => handleDragEnd(e)

    // Mouse events
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)

    // Touch events
    document.addEventListener('touchmove', handleMove, { passive: false })
    document.addEventListener('touchend', handleEnd)
    document.addEventListener('touchcancel', handleEnd)

    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
      document.removeEventListener('touchcancel', handleEnd)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  return {
    isDragging,
    dragOffset,
    handleDragStart,
  }
}

/** @jsxImportSource @emotion/react */
import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Custom hook for handling decoration resize operations
 * Supports 8 handles (corners + edges) with aspect ratio preservation option
 */
export default function useDecorationResize({
  onResizeEnd,
  enabled = true,
  minSize = 30,
  maxSize = 500,
}) {
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState(null)
  const [resizeDelta, setResizeDelta] = useState({ width: 0, height: 0 })

  const startPosRef = useRef({ x: 0, y: 0 })
  const initialSizeRef = useRef({ width: 0, height: 0 })

  const getPointerPosition = useCallback((e) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    return { x: e.clientX, y: e.clientY }
  }, [])

  const handleResizeStart = useCallback((e, handle, initialWidth, initialHeight) => {
    if (!enabled) return

    e.preventDefault()
    e.stopPropagation()

    const pos = getPointerPosition(e)
    startPosRef.current = pos
    initialSizeRef.current = { width: initialWidth, height: initialHeight }

    setIsResizing(true)
    setResizeHandle(handle)
    setResizeDelta({ width: 0, height: 0 })
  }, [enabled, getPointerPosition])

  const handleResizeMove = useCallback((e) => {
    if (!isResizing || !resizeHandle) return

    e.preventDefault()

    const pos = getPointerPosition(e)
    const deltaX = pos.x - startPosRef.current.x
    const deltaY = pos.y - startPosRef.current.y

    let widthDelta = 0
    let heightDelta = 0

    // Calculate deltas based on which handle is being dragged
    switch (resizeHandle) {
      case 'nw':
        widthDelta = -deltaX
        heightDelta = -deltaY
        break
      case 'n':
        heightDelta = -deltaY
        break
      case 'ne':
        widthDelta = deltaX
        heightDelta = -deltaY
        break
      case 'e':
        widthDelta = deltaX
        break
      case 'se':
        widthDelta = deltaX
        heightDelta = deltaY
        break
      case 's':
        heightDelta = deltaY
        break
      case 'sw':
        widthDelta = -deltaX
        heightDelta = deltaY
        break
      case 'w':
        widthDelta = -deltaX
        break
      default:
        break
    }

    // Apply aspect ratio lock for corner handles (shift key not needed for simplicity)
    if (['nw', 'ne', 'se', 'sw'].includes(resizeHandle)) {
      const aspectRatio = initialSizeRef.current.width / initialSizeRef.current.height
      // Use the larger delta to maintain aspect ratio
      if (Math.abs(widthDelta) > Math.abs(heightDelta * aspectRatio)) {
        heightDelta = widthDelta / aspectRatio
      } else {
        widthDelta = heightDelta * aspectRatio
      }
    }

    setResizeDelta({ width: widthDelta, height: heightDelta })
  }, [isResizing, resizeHandle, getPointerPosition])

  const handleResizeEnd = useCallback((e) => {
    if (!isResizing) return

    e?.preventDefault()

    // Calculate final size with constraints
    let finalWidth = initialSizeRef.current.width + resizeDelta.width
    let finalHeight = initialSizeRef.current.height + resizeDelta.height

    // Apply min/max constraints
    finalWidth = Math.max(minSize, Math.min(maxSize, finalWidth))
    finalHeight = Math.max(minSize, Math.min(maxSize, finalHeight))

    setIsResizing(false)
    setResizeHandle(null)
    setResizeDelta({ width: 0, height: 0 })

    if (onResizeEnd) {
      onResizeEnd(Math.round(finalWidth), Math.round(finalHeight))
    }
  }, [isResizing, resizeDelta, minSize, maxSize, onResizeEnd])

  // Global event listeners for resize
  useEffect(() => {
    if (!isResizing) return

    const handleMove = (e) => handleResizeMove(e)
    const handleEnd = (e) => handleResizeEnd(e)

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
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
  }, [isResizing, handleResizeMove, handleResizeEnd])

  // Calculate current size during resize
  const currentSize = {
    width: Math.max(minSize, Math.min(maxSize, initialSizeRef.current.width + resizeDelta.width)),
    height: Math.max(minSize, Math.min(maxSize, initialSizeRef.current.height + resizeDelta.height)),
  }

  return {
    isResizing,
    resizeDelta,
    currentSize,
    handleResizeStart,
  }
}

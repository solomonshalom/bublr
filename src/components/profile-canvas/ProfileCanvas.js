/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'

import { auth, firestore } from '../../lib/firebase'
import DecorationItem from './DecorationItem'
import DecorationControls from './DecorationControls'
import StickerLibraryModal from './StickerLibraryModal'
import CanvasEditToggle from './CanvasEditToggle'
import useDecorationDrag from './useDecorationDrag'
import useDecorationResize from './useDecorationResize'

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 11)

const MAX_DECORATIONS = 20

/**
 * ProfileCanvas - Main canvas wrapper component
 * Handles decoration state, persistence, and edit mode
 */
export default function ProfileCanvas({
  userId,
  profileOwnerId,
  initialDecorations = [],
  children,
}) {
  const [currentUser] = useAuthState(auth)
  const isOwner = currentUser?.uid === profileOwnerId

  // State
  const [isEditMode, setIsEditMode] = useState(false)
  const [decorations, setDecorations] = useState(initialDecorations)
  const [selectedId, setSelectedId] = useState(null)
  const [showStickerModal, setShowStickerModal] = useState(false)
  const [saveStatus, setSaveStatus] = useState('saved')
  const [isRotating, setIsRotating] = useState(false)
  const [rotationStart, setRotationStart] = useState({ angle: 0, startAngle: 0 })

  // Refs
  const canvasRef = useRef(null)
  const saveTimeoutRef = useRef(null)
  const lastSavedRef = useRef(JSON.stringify(initialDecorations))

  // Get selected decoration
  const selectedDecoration = useMemo(() => {
    return decorations.find(d => d.id === selectedId) || null
  }, [decorations, selectedId])

  // Drag hook
  const {
    isDragging,
    dragOffset,
    handleDragStart,
  } = useDecorationDrag({
    containerRef: canvasRef,
    enabled: isEditMode && !!selectedId,
    onDragEnd: useCallback((newX, newY) => {
      if (!selectedId) return
      setDecorations(prev => prev.map(d =>
        d.id === selectedId ? { ...d, x: newX, y: newY } : d
      ))
    }, [selectedId]),
  })

  // Resize hook
  const {
    isResizing,
    resizeDelta,
    handleResizeStart,
  } = useDecorationResize({
    enabled: isEditMode && !!selectedId,
    onResizeEnd: useCallback((newWidth, newHeight) => {
      if (!selectedId) return
      setDecorations(prev => prev.map(d =>
        d.id === selectedId ? { ...d, width: newWidth, height: newHeight } : d
      ))
    }, [selectedId]),
  })

  // Rotation handling
  const handleRotateStart = useCallback((e, currentRotation) => {
    if (!isEditMode || !selectedId || !canvasRef.current) return
    e.preventDefault()
    e.stopPropagation()

    const rect = canvasRef.current.getBoundingClientRect()
    const decoration = decorations.find(d => d.id === selectedId)
    if (!decoration) return

    // Get center of decoration in screen coordinates
    const centerX = rect.left + (decoration.x / 100) * rect.width
    const centerY = rect.top + (decoration.y / 100) * rect.height

    // Get initial mouse angle from center
    const pos = e.touches ? e.touches[0] : e
    const startAngle = Math.atan2(pos.clientY - centerY, pos.clientX - centerX) * (180 / Math.PI)

    setIsRotating(true)
    setRotationStart({ angle: currentRotation, startAngle, centerX, centerY })
  }, [isEditMode, selectedId, decorations])

  // Rotation move handler
  useEffect(() => {
    if (!isRotating) return

    const handleMove = (e) => {
      e.preventDefault()
      const pos = e.touches ? e.touches[0] : e
      const currentAngle = Math.atan2(
        pos.clientY - rotationStart.centerY,
        pos.clientX - rotationStart.centerX
      ) * (180 / Math.PI)

      const angleDelta = currentAngle - rotationStart.startAngle
      let newRotation = rotationStart.angle + angleDelta

      // Normalize to -360 to 360
      while (newRotation > 360) newRotation -= 360
      while (newRotation < -360) newRotation += 360

      // Snap to 0, 90, 180, 270 if close
      const snapAngles = [0, 90, 180, 270, -90, -180, -270]
      for (const snap of snapAngles) {
        if (Math.abs(newRotation - snap) < 5) {
          newRotation = snap
          break
        }
      }

      setDecorations(prev => prev.map(d =>
        d.id === selectedId ? { ...d, rotation: Math.round(newRotation) } : d
      ))
    }

    const handleEnd = () => {
      setIsRotating(false)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleMove, { passive: false })
    document.addEventListener('touchend', handleEnd)

    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [isRotating, rotationStart, selectedId])

  // Auto-save with debounce
  useEffect(() => {
    if (!isOwner || !isEditMode) return

    const currentState = JSON.stringify(decorations)
    if (currentState === lastSavedRef.current) {
      setSaveStatus('saved')
      return
    }

    setSaveStatus('unsaved')

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await firestore.collection('users').doc(profileOwnerId).update({
          profileDecorations: {
            enabled: true,
            updatedAt: Date.now(),
            items: decorations,
          },
        })
        lastSavedRef.current = currentState
        setSaveStatus('saved')
      } catch (err) {
        console.error('Failed to save decorations:', err)
        setSaveStatus('unsaved')
      }
    }, 1000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [decorations, isOwner, isEditMode, profileOwnerId])

  // Click outside to deselect
  const handleCanvasClick = useCallback((e) => {
    if (!isEditMode) return
    // Only deselect if clicking directly on canvas, not on a decoration
    if (e.target === canvasRef.current || e.target.closest('[data-canvas-content]')) {
      setSelectedId(null)
    }
  }, [isEditMode])

  // Add sticker handler
  const handleAddSticker = useCallback((stickerData) => {
    if (decorations.length >= MAX_DECORATIONS) return

    const newDecoration = {
      id: generateId(),
      type: stickerData.type,
      src: stickerData.src,
      x: 50, // Center of canvas
      y: 50,
      width: stickerData.width || 80,
      height: stickerData.height || 80,
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: decorations.length + 1,
      opacity: 1,
      createdAt: Date.now(),
    }

    setDecorations(prev => [...prev, newDecoration])
    setSelectedId(newDecoration.id)
  }, [decorations.length])

  // Delete selected decoration
  const handleDelete = useCallback(() => {
    if (!selectedId) return
    setDecorations(prev => prev.filter(d => d.id !== selectedId))
    setSelectedId(null)
  }, [selectedId])

  // Layer controls
  const handleBringToFront = useCallback(() => {
    if (!selectedId) return
    const maxZ = Math.max(...decorations.map(d => d.zIndex))
    setDecorations(prev => prev.map(d =>
      d.id === selectedId ? { ...d, zIndex: maxZ + 1 } : d
    ))
  }, [selectedId, decorations])

  const handleSendToBack = useCallback(() => {
    if (!selectedId) return
    const minZ = Math.min(...decorations.map(d => d.zIndex))
    setDecorations(prev => prev.map(d =>
      d.id === selectedId ? { ...d, zIndex: minZ - 1 } : d
    ))
  }, [selectedId, decorations])

  // Flip controls
  const handleFlipH = useCallback(() => {
    if (!selectedId) return
    setDecorations(prev => prev.map(d =>
      d.id === selectedId ? { ...d, flipX: !d.flipX } : d
    ))
  }, [selectedId])

  const handleFlipV = useCallback(() => {
    if (!selectedId) return
    setDecorations(prev => prev.map(d =>
      d.id === selectedId ? { ...d, flipY: !d.flipY } : d
    ))
  }, [selectedId])

  // Rotate 90 degrees
  const handleRotate90 = useCallback(() => {
    if (!selectedId) return
    setDecorations(prev => prev.map(d =>
      d.id === selectedId ? { ...d, rotation: (d.rotation + 90) % 360 } : d
    ))
  }, [selectedId])

  // Opacity control
  const handleOpacityChange = useCallback((opacity) => {
    if (!selectedId) return
    setDecorations(prev => prev.map(d =>
      d.id === selectedId ? { ...d, opacity } : d
    ))
  }, [selectedId])

  // Toggle edit mode
  const handleToggleEditMode = useCallback(() => {
    if (isEditMode) {
      // Exiting edit mode - clear selection
      setSelectedId(null)
    }
    setIsEditMode(prev => !prev)
  }, [isEditMode])

  // Don't render canvas functionality if no decorations and not owner
  if (!isOwner && decorations.length === 0) {
    return <>{children}</>
  }

  return (
    <div
      ref={canvasRef}
      css={css`
        position: relative;
        min-height: 100%;
      `}
      onClick={handleCanvasClick}
    >
      {/* Original profile content */}
      <div data-canvas-content>
        {children}
      </div>

      {/* Decorations layer */}
      {decorations.map((decoration) => (
        <DecorationItem
          key={decoration.id}
          decoration={decoration}
          isSelected={selectedId === decoration.id}
          isEditMode={isEditMode}
          dragOffset={selectedId === decoration.id && isDragging ? dragOffset : { x: 0, y: 0 }}
          resizeDelta={selectedId === decoration.id && isResizing ? resizeDelta : { width: 0, height: 0 }}
          onSelect={setSelectedId}
          onDragStart={handleDragStart}
          onResizeStart={handleResizeStart}
          onRotateStart={handleRotateStart}
        />
      ))}

      {/* Edit mode overlay - subtle background when editing */}
      {isEditMode && (
        <div
          css={css`
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.02);
            pointer-events: none;
            z-index: 998;
          `}
        />
      )}

      {/* Controls - only for owner */}
      {isOwner && (
        <>
          {/* Edit toggle button */}
          <CanvasEditToggle
            isEditMode={isEditMode}
            onClick={handleToggleEditMode}
            decorationsCount={decorations.length}
          />

          {/* Floating toolbar - only in edit mode */}
          {isEditMode && (
            <DecorationControls
              selectedDecoration={selectedDecoration}
              decorationsCount={decorations.length}
              maxDecorations={MAX_DECORATIONS}
              onAddSticker={() => setShowStickerModal(true)}
              onDelete={handleDelete}
              onBringForward={handleBringToFront}
              onSendBackward={handleSendToBack}
              onBringToFront={handleBringToFront}
              onSendToBack={handleSendToBack}
              onFlipH={handleFlipH}
              onFlipV={handleFlipV}
              onRotate90={handleRotate90}
              onOpacityChange={handleOpacityChange}
              saveStatus={saveStatus}
            />
          )}

          {/* Sticker library modal */}
          <StickerLibraryModal
            open={showStickerModal}
            onClose={() => setShowStickerModal(false)}
            onAddSticker={handleAddSticker}
          />
        </>
      )}
    </div>
  )
}

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useCallback, memo, useState } from 'react'

/**
 * Individual decoration item with transform capabilities
 * Renders the image with position, rotation, flip, and selection handles
 */
const DecorationItem = memo(function DecorationItem({
  decoration,
  isSelected,
  isEditMode,
  dragOffset = { x: 0, y: 0 },
  resizeDelta = { width: 0, height: 0 },
  onSelect,
  onDragStart,
  onResizeStart,
  onRotateStart,
}) {
  const {
    id,
    src,
    x,
    y,
    width,
    height,
    rotation = 0,
    flipX = false,
    flipY = false,
    zIndex = 1,
    opacity = 1,
  } = decoration

  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  // Calculate actual position and size during drag/resize
  const actualX = x + dragOffset.x
  const actualY = y + dragOffset.y
  const actualWidth = Math.max(30, width + resizeDelta.width)
  const actualHeight = Math.max(30, height + resizeDelta.height)

  const handleClick = useCallback((e) => {
    if (!isEditMode) return
    e.stopPropagation()
    onSelect?.(id)
  }, [isEditMode, id, onSelect])

  const handlePointerDown = useCallback((e) => {
    if (!isEditMode || !isSelected) return
    e.stopPropagation()
    onDragStart?.(e, x, y)
  }, [isEditMode, isSelected, x, y, onDragStart])

  const handleResizePointerDown = useCallback((e, handle) => {
    if (!isEditMode || !isSelected) return
    e.stopPropagation()
    onResizeStart?.(e, handle, width, height)
  }, [isEditMode, isSelected, width, height, onResizeStart])

  // Resize handles configuration
  const handles = [
    { id: 'nw', cursor: 'nw-resize', top: 0, left: 0 },
    { id: 'n', cursor: 'n-resize', top: 0, left: '50%' },
    { id: 'ne', cursor: 'ne-resize', top: 0, right: 0 },
    { id: 'e', cursor: 'e-resize', top: '50%', right: 0 },
    { id: 'se', cursor: 'se-resize', bottom: 0, right: 0 },
    { id: 's', cursor: 's-resize', bottom: 0, left: '50%' },
    { id: 'sw', cursor: 'sw-resize', bottom: 0, left: 0 },
    { id: 'w', cursor: 'w-resize', top: '50%', left: 0 },
  ]

  return (
    <div
      css={css`
        position: absolute;
        left: ${actualX}%;
        top: ${actualY}%;
        width: ${actualWidth}px;
        height: ${actualHeight}px;
        transform: translate(-50%, -50%) rotate(${rotation}deg) scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1});
        z-index: ${zIndex + (isSelected ? 1000 : 0)};
        opacity: ${opacity};
        cursor: ${isEditMode ? (isSelected ? 'move' : 'pointer') : 'default'};
        user-select: none;
        will-change: ${isEditMode ? 'transform' : 'auto'};
        transition: ${isEditMode ? 'none' : 'opacity 0.2s ease'};

        &:hover {
          ${isEditMode && !isSelected && `
            outline: 2px dashed rgba(79, 150, 255, 0.5);
            outline-offset: 2px;
          `}
        }
      `}
      onClick={handleClick}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
    >
      {/* The decoration image */}
      {!imageError ? (
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          css={css`
            width: 100%;
            height: 100%;
            object-fit: contain;
            pointer-events: none;
            opacity: ${imageLoaded ? 1 : 0};
            transition: opacity 0.2s ease;
          `}
        />
      ) : (
        <div
          css={css`
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--grey-2);
            border-radius: 4px;
            color: var(--grey-3);
            font-size: 0.7rem;
          `}
        >
          Failed
        </div>
      )}

      {/* Selection UI - only in edit mode when selected */}
      {isEditMode && isSelected && (
        <>
          {/* Selection border */}
          <div
            css={css`
              position: absolute;
              inset: -2px;
              border: 2px solid #4D96FF;
              border-radius: 2px;
              pointer-events: none;
            `}
          />

          {/* Resize handles */}
          {handles.map((handle) => (
            <div
              key={handle.id}
              css={css`
                position: absolute;
                width: 12px;
                height: 12px;
                background: #fff;
                border: 2px solid #4D96FF;
                border-radius: 2px;
                cursor: ${handle.cursor};
                transform: translate(-50%, -50%);
                z-index: 10;

                /* Position based on handle location */
                ${handle.top !== undefined && `top: ${handle.top};`}
                ${handle.bottom !== undefined && `bottom: ${handle.bottom}; top: auto; transform: translate(-50%, 50%);`}
                ${handle.left !== undefined && `left: ${handle.left};`}
                ${handle.right !== undefined && `right: ${handle.right}; left: auto; transform: translate(50%, -50%);`}

                /* Adjust corner transforms */
                ${handle.id === 'nw' && `transform: translate(-50%, -50%);`}
                ${handle.id === 'ne' && `transform: translate(50%, -50%);`}
                ${handle.id === 'se' && `transform: translate(50%, 50%);`}
                ${handle.id === 'sw' && `transform: translate(-50%, 50%);`}
                ${handle.id === 'n' && `transform: translate(-50%, -50%);`}
                ${handle.id === 's' && `transform: translate(-50%, 50%);`}
                ${handle.id === 'e' && `transform: translate(50%, -50%);`}
                ${handle.id === 'w' && `transform: translate(-50%, -50%);`}

                /* Touch-friendly size on mobile */
                @media (max-width: 768px) {
                  width: 16px;
                  height: 16px;
                }

                &:hover {
                  background: #4D96FF;
                }
              `}
              onMouseDown={(e) => handleResizePointerDown(e, handle.id)}
              onTouchStart={(e) => handleResizePointerDown(e, handle.id)}
            />
          ))}

          {/* Rotation handle */}
          <div
            css={css`
              position: absolute;
              top: -30px;
              left: 50%;
              transform: translateX(-50%);
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 0;
            `}
          >
            {/* Line connecting to rotation handle */}
            <div
              css={css`
                width: 1px;
                height: 16px;
                background: #4D96FF;
              `}
            />
            {/* Rotation handle circle */}
            <div
              css={css`
                width: 14px;
                height: 14px;
                background: #fff;
                border: 2px solid #4D96FF;
                border-radius: 50%;
                cursor: grab;

                &:hover {
                  background: #4D96FF;
                }

                &:active {
                  cursor: grabbing;
                }

                @media (max-width: 768px) {
                  width: 18px;
                  height: 18px;
                }
              `}
              onMouseDown={(e) => {
                e.stopPropagation()
                onRotateStart?.(e, rotation)
              }}
              onTouchStart={(e) => {
                e.stopPropagation()
                onRotateStart?.(e, rotation)
              }}
            />
          </div>
        </>
      )}
    </div>
  )
})

export default DecorationItem

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { memo } from 'react'

// Icons as inline SVGs to match existing patterns
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

const LayerUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
)

const LayerDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12l7 7 7-7" />
  </svg>
)

const FlipHIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18M16 7l4 5-4 5M8 7l-4 5 4 5" />
  </svg>
)

const FlipVIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h18M7 8l5-4 5 4M7 16l5 4 5-4" />
  </svg>
)

const RotateIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
)

const ControlButton = memo(function ControlButton({ onClick, title, children, disabled, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: var(--grey-1);
        border: 1px solid var(--grey-2);
        border-radius: 8px;
        color: ${danger ? '#E23E57' : 'var(--grey-4)'};
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover:not(:disabled) {
          background: ${danger ? 'rgba(226, 62, 87, 0.1)' : 'var(--grey-2)'};
          border-color: ${danger ? '#E23E57' : 'var(--grey-3)'};
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          width: 44px;
          height: 44px;
        }
      `}
    >
      {children}
    </button>
  )
})

const Divider = () => (
  <div
    css={css`
      width: 1px;
      height: 24px;
      background: var(--grey-2);
      margin: 0 4px;
    `}
  />
)

/**
 * Floating toolbar for decoration controls
 * Shows when in edit mode, provides actions for selected decoration
 */
const DecorationControls = memo(function DecorationControls({
  selectedDecoration,
  decorationsCount,
  maxDecorations = 20,
  onAddSticker,
  onDelete,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onFlipH,
  onFlipV,
  onRotate90,
  onOpacityChange,
  saveStatus,
}) {
  const hasSelection = !!selectedDecoration
  const canAdd = decorationsCount < maxDecorations

  return (
    <div
      css={css`
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: var(--grey-1);
        border: 1px solid var(--grey-2);
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 9999;

        @media (max-width: 768px) {
          bottom: 16px;
          left: 16px;
          right: 16px;
          transform: none;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
          padding: 12px;
        }
      `}
    >
      {/* Add sticker button */}
      <ControlButton
        onClick={onAddSticker}
        title={canAdd ? 'Add sticker' : `Max ${maxDecorations} decorations`}
        disabled={!canAdd}
      >
        <PlusIcon />
      </ControlButton>

      <Divider />

      {/* Layer controls */}
      <ControlButton
        onClick={onBringToFront}
        title="Bring to front"
        disabled={!hasSelection}
      >
        <LayerUpIcon />
      </ControlButton>

      <ControlButton
        onClick={onSendToBack}
        title="Send to back"
        disabled={!hasSelection}
      >
        <LayerDownIcon />
      </ControlButton>

      <Divider />

      {/* Flip controls */}
      <ControlButton
        onClick={onFlipH}
        title="Flip horizontal"
        disabled={!hasSelection}
      >
        <FlipHIcon />
      </ControlButton>

      <ControlButton
        onClick={onFlipV}
        title="Flip vertical"
        disabled={!hasSelection}
      >
        <FlipVIcon />
      </ControlButton>

      {/* Rotate 90° */}
      <ControlButton
        onClick={onRotate90}
        title="Rotate 90°"
        disabled={!hasSelection}
      >
        <RotateIcon />
      </ControlButton>

      <Divider />

      {/* Opacity slider */}
      {hasSelection && (
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 0 8px;
          `}
        >
          <span
            css={css`
              font-size: 0.75rem;
              color: var(--grey-3);
              white-space: nowrap;
            `}
          >
            Opacity
          </span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={selectedDecoration?.opacity ?? 1}
            onChange={(e) => onOpacityChange?.(parseFloat(e.target.value))}
            css={css`
              width: 80px;
              height: 4px;
              appearance: none;
              background: var(--grey-2);
              border-radius: 2px;
              cursor: pointer;

              &::-webkit-slider-thumb {
                appearance: none;
                width: 14px;
                height: 14px;
                background: #4D96FF;
                border-radius: 50%;
                cursor: pointer;
              }

              &::-moz-range-thumb {
                width: 14px;
                height: 14px;
                background: #4D96FF;
                border: none;
                border-radius: 50%;
                cursor: pointer;
              }
            `}
          />
        </div>
      )}

      {hasSelection && <Divider />}

      {/* Delete button */}
      <ControlButton
        onClick={onDelete}
        title="Delete"
        disabled={!hasSelection}
        danger
      >
        <TrashIcon />
      </ControlButton>

      {/* Save status indicator */}
      <div
        css={css`
          margin-left: 8px;
          padding: 4px 8px;
          font-size: 0.7rem;
          color: var(--grey-3);
          background: var(--grey-0);
          border-radius: 4px;
        `}
      >
        {saveStatus === 'saving' && 'Saving...'}
        {saveStatus === 'saved' && 'Saved'}
        {saveStatus === 'unsaved' && 'Unsaved'}
      </div>
    </div>
  )
})

export default DecorationControls

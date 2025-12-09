/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { memo } from 'react'

// Sparkle animation for the icon
const sparkle = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`

// Paintbrush icon
const PaintbrushIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
    <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" />
    <path d="M14.5 17.5 4.5 15" />
  </svg>
)

// Check icon
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

// Spinner animation
const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

// Small spinner for button
const ButtonSpinner = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    css={css`animation: ${spin} 1s linear infinite;`}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)

/**
 * Toggle button for entering/exiting canvas edit mode
 * Fixed position at bottom-right of screen
 * Only visible to profile owner
 */
const CanvasEditToggle = memo(function CanvasEditToggle({
  isEditMode,
  isSaving = false,
  onClick,
  decorationsCount = 0,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSaving}
      title={isSaving ? 'Saving...' : isEditMode ? 'Done editing' : 'Edit decorations'}
      css={css`
        position: fixed;
        bottom: ${isEditMode ? '100px' : '24px'};
        right: 24px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: ${isEditMode ? '10px 16px' : '10px 14px'};
        font-size: 0.85rem;
        font-weight: 500;
        color: ${isEditMode ? '#fff' : 'var(--grey-4)'};
        background: ${isEditMode ? '#4D96FF' : 'var(--grey-1)'};
        border: 1px solid ${isEditMode ? '#4D96FF' : 'var(--grey-2)'};
        border-radius: 50px;
        cursor: ${isSaving ? 'wait' : 'pointer'};
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
        z-index: 9998;
        opacity: ${isSaving ? 0.8 : 1};

        &:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
          background: ${isEditMode ? '#3d86ef' : 'var(--grey-2)'};
        }

        &:active:not(:disabled) {
          transform: translateY(0);
        }

        &:disabled {
          cursor: wait;
        }

        svg {
          ${!isEditMode && !isSaving && decorationsCount === 0 && `
            animation: ${sparkle} 2s ease-in-out infinite;
          `}
        }

        @media (max-width: 768px) {
          bottom: ${isEditMode ? '140px' : '24px'};
          right: 16px;
          padding: ${isEditMode ? '12px 20px' : '12px 16px'};
        }
      `}
    >
      {isSaving ? (
        <>
          <ButtonSpinner />
          Saving...
        </>
      ) : isEditMode ? (
        <>
          <CheckIcon />
          Done
        </>
      ) : (
        <>
          <PaintbrushIcon />
          {decorationsCount > 0 ? `Edit (${decorationsCount})` : 'Decorate'}
        </>
      )}
    </button>
  )
})

export default CanvasEditToggle

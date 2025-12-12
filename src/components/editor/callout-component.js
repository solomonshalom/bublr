/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { NodeViewWrapper } from '@tiptap/react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Typography from '@tiptap/extension-typography'
import { useState, useCallback, useEffect, useRef } from 'react'

// Color palette for popup dots (same as post dots)
const DOT_COLORS = [
  { color: '#cf52f2', name: 'Purple' },
  { color: '#6BCB77', name: 'Green' },
  { color: '#4D96FF', name: 'Blue' },
  { color: '#A66CFF', name: 'Violet' },
  { color: '#E23E57', name: 'Red' },
  { color: '#ff3e00', name: 'Orange' },
]

const overlayFadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const popupFadeIn = keyframes`
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`

function CalloutComponent({ node, updateAttributes, editor: parentEditor, getPos }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const { dotColor, title, content } = node.attrs
  const colorPickerRef = useRef(null)
  const popupRef = useRef(null)
  const hasUnsavedChanges = useRef(false)

  // Create a separate editor instance for the popup content
  const popupEditor = useEditor({
    extensions: [
      StarterKit.configure({
        // Enable markdown shortcuts
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Placeholder.configure({
        placeholder: 'Write something... (Markdown supported)',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
        },
      }),
      Typography,
    ],
    content: content || '<p></p>',
    editorProps: {
      attributes: {
        class: 'popup-editor-content',
      },
      // Comprehensive event isolation to prevent parent editor interference
      handleDOMEvents: {
        keydown: (view, event) => {
          event.stopPropagation()
          return false
        },
        keyup: (view, event) => {
          event.stopPropagation()
          return false
        },
        keypress: (view, event) => {
          event.stopPropagation()
          return false
        },
        input: (view, event) => {
          event.stopPropagation()
          return false
        },
        textInput: (view, event) => {
          event.stopPropagation()
          return false
        },
        compositionstart: (view, event) => {
          event.stopPropagation()
          return false
        },
        compositionupdate: (view, event) => {
          event.stopPropagation()
          return false
        },
        compositionend: (view, event) => {
          event.stopPropagation()
          return false
        },
        beforeinput: (view, event) => {
          event.stopPropagation()
          return false
        },
        focus: (view, event) => {
          event.stopPropagation()
          return false
        },
        blur: (view, event) => {
          event.stopPropagation()
          return false
        },
        mousedown: (view, event) => {
          event.stopPropagation()
          return false
        },
        mouseup: (view, event) => {
          event.stopPropagation()
          return false
        },
        click: (view, event) => {
          event.stopPropagation()
          return false
        },
        paste: (view, event) => {
          event.stopPropagation()
          return false
        },
        cut: (view, event) => {
          event.stopPropagation()
          return false
        },
        copy: (view, event) => {
          event.stopPropagation()
          return false
        },
        drop: (view, event) => {
          event.stopPropagation()
          return false
        },
        dragstart: (view, event) => {
          event.stopPropagation()
          return false
        },
        dragover: (view, event) => {
          event.stopPropagation()
          return false
        },
      },
    },
    onUpdate: ({ editor }) => {
      hasUnsavedChanges.current = true
    },
  }, []) // Empty deps - we'll manually update content

  // Update popup editor content when node content changes externally
  useEffect(() => {
    if (popupEditor && !isOpen && content !== popupEditor.getHTML()) {
      popupEditor.commands.setContent(content || '<p></p>')
    }
  }, [content, popupEditor, isOpen])

  // Save content when popup closes
  const saveContent = useCallback(() => {
    if (popupEditor && hasUnsavedChanges.current) {
      const html = popupEditor.getHTML()
      // Only update if content actually changed
      if (html !== content) {
        updateAttributes({ content: html })
      }
      hasUnsavedChanges.current = false
    }
  }, [popupEditor, content, updateAttributes])

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowColorPicker(false)
      }
    }
    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showColorPicker])

  const selectColor = useCallback((newColor) => {
    updateAttributes({ dotColor: newColor })
    setShowColorPicker(false)
  }, [updateAttributes])

  const openPopup = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()

    // Disable and blur parent editor to prevent interference
    if (parentEditor) {
      parentEditor.commands.blur()
      parentEditor.setEditable(false)
    }

    setIsOpen(true)

    // Focus popup editor after it opens
    setTimeout(() => {
      if (popupEditor) {
        popupEditor.commands.focus('end')
      }
    }, 50)
  }, [parentEditor, popupEditor])

  const closePopup = useCallback((e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    // Save content before closing
    saveContent()

    // Blur popup editor first
    if (popupEditor) {
      popupEditor.commands.blur()
    }

    setIsOpen(false)
    setShowColorPicker(false)

    // Re-enable parent editor after popup closes
    if (parentEditor) {
      parentEditor.setEditable(true)
      // Small delay before focusing to ensure smooth transition
      setTimeout(() => {
        parentEditor.commands.focus()
      }, 50)
    }
  }, [saveContent, popupEditor, parentEditor])

  // Handle escape key to close popup
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        e.stopPropagation()
        closePopup()
      }
    }
    if (isOpen) {
      // Use capture phase to catch it before anything else
      document.addEventListener('keydown', handleKeyDown, true)
      return () => document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, closePopup])

  // Click outside is now handled by overlay onClick, no need for document listener

  // Prevent scroll on body when popup is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  // Capture phase prevention of focus stealing by parent editor
  useEffect(() => {
    if (!isOpen) return

    // Get the parent editor DOM element
    const parentEditorElement = parentEditor?.view?.dom

    // Prevent focus events on parent editor when popup is open
    const preventFocus = (e) => {
      if (parentEditorElement && parentEditorElement.contains(e.target)) {
        e.preventDefault()
        e.stopPropagation()
        // Refocus popup editor if parent tries to steal focus
        if (popupEditor && !popupEditor.isFocused) {
          popupEditor.commands.focus()
        }
      }
    }

    // Use capture phase to intercept before any handlers
    document.addEventListener('focus', preventFocus, true)
    document.addEventListener('focusin', preventFocus, true)

    return () => {
      document.removeEventListener('focus', preventFocus, true)
      document.removeEventListener('focusin', preventFocus, true)
    }
  }, [isOpen, parentEditor, popupEditor])

  // Ensure parent editor stays disabled while popup is open
  useEffect(() => {
    if (isOpen && parentEditor) {
      parentEditor.setEditable(false)
    }
  }, [isOpen, parentEditor])

  // Cleanup editor on unmount - re-enable parent editor
  useEffect(() => {
    return () => {
      if (popupEditor) {
        popupEditor.destroy()
      }
      // Re-enable parent editor if component unmounts while popup is open
      if (parentEditor && !parentEditor.isEditable) {
        parentEditor.setEditable(true)
      }
    }
  }, [popupEditor, parentEditor])

  const currentColor = dotColor || DOT_COLORS[0].color

  // Check if there's content to show preview
  const hasContent = content && content !== '<p></p>' && content.trim() !== ''

  return (
    <NodeViewWrapper as="span" css={css`display: inline; vertical-align: baseline;`}>
      {/* Inline trigger pill */}
      <button
        onClick={openPopup}
        type="button"
        contentEditable={false}
        css={css`
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.75rem;
          margin: 0 0.25rem;
          background: var(--grey-1);
          border: 1px solid var(--grey-2);
          border-radius: 2rem;
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 0.85rem;
          color: var(--grey-4);
          font-family: inherit;
          vertical-align: middle;

          &:hover {
            border-color: var(--grey-3);
            background: var(--grey-2);
          }

          html[data-theme='dark'] & {
            background: var(--grey-2);
            border-color: var(--grey-3);
          }

          html[data-theme='dark'] &:hover {
            background: var(--grey-3);
          }
        `}
      >
        <span
          css={css`
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: ${currentColor};
            flex-shrink: 0;
          `}
        />
        <span css={css`font-weight: 500;`}>{title || 'Pop-up'}</span>
        {hasContent && (
          <span css={css`
            font-size: 0.7rem;
            color: var(--grey-3);
            margin-left: 0.125rem;
          `}>
            •
          </span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" css={css`opacity: 0.5;`}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </button>

      {/* Modal popup */}
      {isOpen && (
        <>
          {/* Overlay - captures all events to prevent parent editor interaction */}
          <div
            onClick={(e) => {
              e.stopPropagation()
              closePopup()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            css={css`
              position: fixed;
              inset: 0;
              background: rgba(0, 0, 0, 0.4);
              z-index: 99998;
              backdrop-filter: blur(2px);
              animation: ${overlayFadeIn} 0.15s ease-out;
            `}
          />

          {/* Popup - comprehensive event isolation */}
          <div
            ref={popupRef}
            css={css`
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: var(--grey-1);
              border-radius: 0.5rem;
              width: 90%;
              max-width: 560px;
              max-height: 80vh;
              display: flex;
              flex-direction: column;
              animation: ${popupFadeIn} 0.2s ease-out;
              border: 1px solid var(--grey-2);
              overflow: hidden;
              z-index: 99999;
            `}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            onInput={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
            onBlur={(e) => e.stopPropagation()}
            onPaste={(e) => e.stopPropagation()}
            onCut={(e) => e.stopPropagation()}
            onCopy={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 1rem 1.25rem;
                border-bottom: 1px solid var(--grey-2);
                flex-shrink: 0;
              `}
            >
              {/* Color selector */}
              <div ref={colorPickerRef} css={css`position: relative;`}>
                <button
                  type="button"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  css={css`
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0.25rem;
                    border-radius: 0.25rem;
                    transition: background 0.15s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;

                    &:hover {
                      background: var(--grey-2);
                    }
                  `}
                  title="Change color"
                >
                  <span
                    css={css`
                      width: 18px;
                      height: 18px;
                      border-radius: 50%;
                      background-color: ${currentColor};
                      display: block;
                      box-shadow: 0 0 0 2px var(--grey-1), 0 0 0 3px ${currentColor}40;
                    `}
                  />
                </button>

                {/* Color picker dropdown */}
                {showColorPicker && (
                  <div
                    css={css`
                      position: absolute;
                      top: 100%;
                      left: 0;
                      margin-top: 4px;
                      background: var(--grey-1);
                      border: 1px solid var(--grey-2);
                      border-radius: 0.375rem;
                      padding: 0.5rem;
                      display: flex;
                      gap: 0.375rem;
                      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                      z-index: 10;

                      html[data-theme='dark'] & {
                        background: var(--grey-2);
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                      }
                    `}
                  >
                    {DOT_COLORS.map(({ color, name }) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => selectColor(color)}
                        title={name}
                        css={css`
                          width: 24px;
                          height: 24px;
                          border-radius: 50%;
                          background-color: ${color};
                          border: 2px solid ${currentColor === color ? 'var(--grey-5)' : 'transparent'};
                          cursor: pointer;
                          transition: all 0.15s ease;
                          padding: 0;

                          &:hover {
                            transform: scale(1.15);
                          }
                        `}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Editable title */}
              <input
                type="text"
                value={title || ''}
                onChange={(e) => updateAttributes({ title: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Pop-up title..."
                css={css`
                  flex: 1;
                  border: none;
                  background: none;
                  font-size: 1rem;
                  font-weight: 500;
                  color: var(--grey-5);
                  outline: none;
                  padding: 0.25rem;
                  font-family: inherit;

                  &::placeholder {
                    color: var(--grey-3);
                  }
                `}
              />

              {/* Close button */}
              <button
                type="button"
                onClick={closePopup}
                css={css`
                  background: none;
                  border: none;
                  cursor: pointer;
                  padding: 0.375rem;
                  border-radius: 0.25rem;
                  color: var(--grey-3);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.15s ease;

                  &:hover {
                    background: var(--grey-2);
                    color: var(--grey-4);
                  }
                `}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Content area - separate TipTap editor */}
            <div
              data-lenis-prevent
              css={css`
                flex: 1;
                overflow-y: auto;
                padding: 1rem 1.25rem;
                min-height: 150px;
                max-height: 60vh;

                &::-webkit-scrollbar { display: none; }
                -ms-overflow-style: none;
                scrollbar-width: none;

                .popup-editor-content {
                  outline: none;
                  min-height: 100px;
                  font-size: 1rem;
                  line-height: 1.6;
                  color: var(--grey-4);
                }

                .popup-editor-content p {
                  margin: 0.75rem 0;
                }

                .popup-editor-content p:first-of-type {
                  margin-top: 0;
                }

                .popup-editor-content p:last-of-type {
                  margin-bottom: 0;
                }

                .popup-editor-content h1,
                .popup-editor-content h2,
                .popup-editor-content h3 {
                  color: var(--grey-5);
                  font-weight: 500;
                  margin: 1.5rem 0 0.5rem 0;
                }

                .popup-editor-content h1:first-child,
                .popup-editor-content h2:first-child,
                .popup-editor-content h3:first-child {
                  margin-top: 0;
                }

                .popup-editor-content h1 { font-size: 1.5rem; }
                .popup-editor-content h2 { font-size: 1.25rem; }
                .popup-editor-content h3 { font-size: 1.1rem; }

                .popup-editor-content ul,
                .popup-editor-content ol {
                  margin: 0.75rem 0;
                  padding-left: 1.5rem;
                }

                .popup-editor-content li {
                  margin: 0.25rem 0;
                }

                .popup-editor-content blockquote {
                  border-left: 3px solid var(--grey-2);
                  margin: 1rem 0;
                  padding-left: 1rem;
                  color: var(--grey-3);
                }

                .popup-editor-content code {
                  background: var(--grey-2);
                  padding: 0.1rem 0.3rem;
                  border-radius: 0.25rem;
                  font-size: 0.9em;
                  font-family: 'JetBrains Mono', monospace;
                }

                .popup-editor-content pre {
                  background: var(--grey-5);
                  color: var(--grey-2);
                  padding: 1rem;
                  border-radius: 0.5rem;
                  overflow-x: auto;
                  margin: 1rem 0;
                }

                .popup-editor-content pre code {
                  background: none;
                  padding: 0;
                }

                .popup-editor-content a {
                  color: var(--grey-5);
                  text-decoration: underline;
                }

                .popup-editor-content strong {
                  font-weight: 600;
                }

                .popup-editor-content hr {
                  border: none;
                  border-top: 2px solid var(--grey-2);
                  margin: 1.5rem 0;
                }

                /* Placeholder */
                .popup-editor-content p.is-editor-empty:first-child::before {
                  content: attr(data-placeholder);
                  float: left;
                  color: var(--grey-3);
                  pointer-events: none;
                  height: 0;
                }
              `}
            >
              <EditorContent editor={popupEditor} />
            </div>

            {/* Footer with hint */}
            <div
              css={css`
                padding: 0.5rem 1.25rem;
                border-top: 1px solid var(--grey-2);
                font-size: 0.7rem;
                color: var(--grey-3);
                display: flex;
                justify-content: space-between;
                align-items: center;
              `}
            >
              <span>Markdown: **bold**, *italic*, # heading, - list</span>
              <span>Esc to close</span>
            </div>
          </div>
        </>
      )}
    </NodeViewWrapper>
  )
}

export default CalloutComponent

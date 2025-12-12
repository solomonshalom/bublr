/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { FloatingMenu } from '@tiptap/react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { PlusIcon } from '@radix-ui/react-icons'

// Quick-access block types for the floating menu
const QUICK_BLOCKS = [
  {
    title: 'Text',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>
    ),
    action: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    title: 'Heading 1',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 12h8"></path>
        <path d="M4 18V6"></path>
        <path d="M12 18V6"></path>
        <path d="M17 12l3-2v8"></path>
      </svg>
    ),
    action: (editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 12h8"></path>
        <path d="M4 18V6"></path>
        <path d="M12 18V6"></path>
        <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"></path>
      </svg>
    ),
    action: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    title: 'Bullet List',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
    ),
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: 'Task List',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="6" height="6" rx="1"></rect>
        <path d="M3 17h6"></path>
        <path d="M13 6h8"></path>
        <path d="M13 12h8"></path>
        <path d="M13 18h8"></path>
      </svg>
    ),
    action: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: 'Quote',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"></path>
        <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"></path>
      </svg>
    ),
    action: (editor) => editor.chain().focus().setBlockquote().run(),
  },
  {
    title: 'Code',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
    ),
    action: (editor) => editor.chain().focus().setCodeBlock().run(),
  },
  {
    title: 'Divider',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="2" y1="12" x2="22" y2="12"></line>
      </svg>
    ),
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
]

function EditorFloatingMenu({ editor }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const menuRef = useRef(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsExpanded(false)
      }
    }

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded])

  // Close menu on escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isExpanded) {
        setIsExpanded(false)
        editor.commands.focus()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isExpanded, editor])

  const handleBlockSelect = useCallback(
    (block) => {
      block.action(editor)
      setIsExpanded(false)
    },
    [editor]
  )

  if (!editor) return null

  return (
    <FloatingMenu
      editor={editor}
      tippyOptions={{
        duration: 150,
        placement: 'left-start',
        offset: [0, 8],
      }}
      shouldShow={({ editor, view, state }) => {
        // Only show on empty paragraphs (not in code blocks, lists, etc.)
        const { $from } = state.selection
        const isEmptyTextBlock =
          $from.parent.isTextblock &&
          $from.parent.content.size === 0 &&
          $from.depth <= 1

        // Don't show in certain node types
        const isCodeBlock = editor.isActive('codeBlock')
        const isImage = editor.isActive('image')

        return isEmptyTextBlock && !isCodeBlock && !isImage
      }}
    >
      <div
        ref={menuRef}
        css={css`
          position: relative;
        `}
      >
        {/* Plus button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          css={css`
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 4px;
            border: none;
            background: transparent;
            color: var(--grey-3);
            cursor: pointer;
            transition: all 0.15s ease;
            transform: ${isExpanded ? 'rotate(45deg)' : 'rotate(0deg)'};

            &:hover {
              background: var(--grey-2);
              color: var(--grey-4);
            }
          `}
          title="Add block"
        >
          <PlusIcon width={16} height={16} />
        </button>

        {/* Expanded menu */}
        {isExpanded && (
          <div
            css={css`
              position: absolute;
              left: 100%;
              top: -8px;
              margin-left: 8px;
              background: var(--grey-1);
              border: 1px solid var(--grey-2);
              border-radius: 0.5rem;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
              min-width: 200px;
              padding: 0.5rem;
              z-index: 100;
              animation: fadeIn 0.15s ease;

              @keyframes fadeIn {
                from {
                  opacity: 0;
                  transform: translateX(-4px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }

              html[data-theme='dark'] & {
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
              }
            `}
          >
            <div
              css={css`
                font-size: 0.7rem;
                font-weight: 500;
                color: var(--grey-3);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                padding: 0.25rem 0.5rem;
                margin-bottom: 0.25rem;
              `}
            >
              Basic blocks
            </div>
            {QUICK_BLOCKS.map((block) => (
              <button
                key={block.title}
                onClick={() => handleBlockSelect(block)}
                css={css`
                  display: flex;
                  align-items: center;
                  gap: 0.6rem;
                  width: 100%;
                  padding: 0.5rem;
                  border: none;
                  border-radius: 0.375rem;
                  background: transparent;
                  cursor: pointer;
                  text-align: left;
                  transition: background 0.15s ease;
                  color: var(--grey-4);

                  &:hover {
                    background: var(--grey-2);
                  }
                `}
              >
                <span
                  css={css`
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    background: var(--grey-2);
                    color: var(--grey-4);
                    flex-shrink: 0;

                    html[data-theme='dark'] & {
                      background: var(--grey-3);
                    }
                  `}
                >
                  {block.icon}
                </span>
                <span
                  css={css`
                    font-size: 0.85rem;
                    color: var(--grey-5);
                  `}
                >
                  {block.title}
                </span>
              </button>
            ))}
            <div
              css={css`
                font-size: 0.7rem;
                color: var(--grey-3);
                padding: 0.5rem 0.5rem 0.25rem;
                border-top: 1px solid var(--grey-2);
                margin-top: 0.25rem;
              `}
            >
              Type <kbd css={css`
                background: var(--grey-2);
                padding: 1px 4px;
                border-radius: 3px;
                font-family: inherit;
                font-size: 0.7rem;
              `}>/</kbd> for commands
            </div>
          </div>
        )}
      </div>
    </FloatingMenu>
  )
}

export default EditorFloatingMenu

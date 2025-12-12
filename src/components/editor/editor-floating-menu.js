/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { FloatingMenu } from '@tiptap/react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { PlusIcon } from '@radix-ui/react-icons'

// Same minimal icons as slash commands
const MENU_ITEMS = [
  {
    title: 'Text',
    description: 'Just start writing with plain text.',
    category: 'basic',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7V4h16v3" />
        <path d="M9 20h6" />
        <path d="M12 4v16" />
      </svg>
    ),
    action: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    title: 'Heading 1',
    description: 'Big section heading.',
    category: 'basic',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h8" />
        <path d="M4 18V6" />
        <path d="M12 18V6" />
        <path d="M17 12l3-2v8" />
      </svg>
    ),
    action: (editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading.',
    category: 'basic',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h8" />
        <path d="M4 18V6" />
        <path d="M12 18V6" />
        <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
      </svg>
    ),
    action: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading.',
    category: 'basic',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h8" />
        <path d="M4 18V6" />
        <path d="M12 18V6" />
        <path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2" />
        <path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2" />
      </svg>
    ),
    action: (editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    title: 'To-do List',
    description: 'Track tasks with a to-do list.',
    category: 'basic',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="6" height="6" rx="1" />
        <path d="m3 17 2 2 4-4" />
        <path d="M13 6h8" />
        <path d="M13 12h8" />
        <path d="M13 18h8" />
      </svg>
    ),
    action: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list.',
    category: 'basic',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Create a numbered list.',
    category: 'basic',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="10" y1="6" x2="21" y2="6" />
        <line x1="10" y1="12" x2="21" y2="12" />
        <line x1="10" y1="18" x2="21" y2="18" />
        <path d="M4 6h1v4" />
        <path d="M4 10h2" />
        <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
      </svg>
    ),
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: 'Quote',
    description: 'Capture a quote.',
    category: 'basic',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
        <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z" />
      </svg>
    ),
    action: (editor) => editor.chain().focus().setBlockquote().run(),
  },
  {
    title: 'Divider',
    description: 'Visual divider line.',
    category: 'basic',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="12" x2="21" y2="12" />
      </svg>
    ),
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: 'Code',
    description: 'Capture a code snippet.',
    category: 'media',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    action: (editor) => editor.chain().focus().setCodeBlock().run(),
  },
  {
    title: 'Image',
    description: 'Upload or embed an image.',
    category: 'media',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
    action: (editor) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async (event) => {
        const file = event.target.files[0]
        if (!file) return
        window.dispatchEvent(new CustomEvent('tiptap-image-upload', { detail: { file } }))
      }
      input.click()
    },
  },
  {
    title: 'Pop-up',
    description: 'Collapsible content block.',
    category: 'media',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 9h6" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
      </svg>
    ),
    action: (editor) => editor.chain().focus().setCallout().run(),
  },
]

// Group items by category
const groupByCategory = (items) => {
  const groups = {}
  items.forEach((item) => {
    const category = item.category || 'other'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(item)
  })
  return groups
}

const CATEGORY_LABELS = {
  basic: 'Basic Blocks',
  media: 'Media',
}

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

  const groupedItems = groupByCategory(MENU_ITEMS)

  return (
    <FloatingMenu
      editor={editor}
      tippyOptions={{
        duration: 150,
        placement: 'left-start',
        offset: [0, 8],
      }}
      shouldShow={({ editor, view, state }) => {
        // Don't show if editor doesn't have focus (e.g., popup editor is focused)
        if (!editor.isFocused) return false

        const { $from } = state.selection
        const isEmptyTextBlock =
          $from.parent.isTextblock &&
          $from.parent.content.size === 0 &&
          $from.depth <= 1

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

        {/* Expanded menu - matches slash command style */}
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
              min-width: 240px;
              max-height: 250px;
              overflow-y: scroll;
              overflow-x: hidden;
              padding: 0.375rem;
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

              /* Hide scrollbar but keep scroll functionality */
              scrollbar-width: none; /* Firefox */
              -ms-overflow-style: none; /* IE/Edge */
              &::-webkit-scrollbar {
                display: none; /* Chrome/Safari */
                width: 0;
                height: 0;
              }
            `}
          >
            {Object.entries(groupedItems).map(([category, categoryItems]) => (
              <div key={category}>
                {/* Category Header */}
                <div
                  css={css`
                    font-size: 0.65rem;
                    font-weight: 500;
                    color: var(--grey-3);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    padding: 0.375rem 0.5rem 0.25rem;
                    margin-top: 0.125rem;

                    &:first-of-type {
                      margin-top: 0;
                    }
                  `}
                >
                  {CATEGORY_LABELS[category] || category}
                </div>

                {/* Category Items */}
                {categoryItems.map((item) => (
                  <button
                    key={item.title}
                    onClick={() => handleBlockSelect(item)}
                    css={css`
                      display: flex;
                      align-items: center;
                      gap: 0.625rem;
                      width: 100%;
                      padding: 0.375rem 0.5rem;
                      border: none;
                      border-radius: 0.25rem;
                      background: transparent;
                      cursor: pointer;
                      text-align: left;
                      transition: background 0.1s ease;

                      &:hover {
                        background: var(--grey-2);
                      }
                    `}
                  >
                    {/* Icon - minimal, no container */}
                    <span
                      css={css`
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 18px;
                        height: 18px;
                        color: var(--grey-3);
                        flex-shrink: 0;
                      `}
                    >
                      {item.icon}
                    </span>

                    {/* Text Content */}
                    <div css={css`min-width: 0; flex: 1;`}>
                      <div
                        css={css`
                          font-size: 0.8125rem;
                          font-weight: 500;
                          color: var(--grey-5);
                        `}
                      >
                        {item.title}
                      </div>
                      <div
                        css={css`
                          font-size: 0.6875rem;
                          color: var(--grey-3);
                          white-space: nowrap;
                          overflow: hidden;
                          text-overflow: ellipsis;
                        `}
                      >
                        {item.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </FloatingMenu>
  )
}

export default EditorFloatingMenu

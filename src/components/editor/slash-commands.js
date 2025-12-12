/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import tippy from 'tippy.js'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
  useRef,
} from 'react'

// Command definitions organized by category - minimal icons
const SLASH_COMMANDS = [
  // Basic Blocks
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
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run()
    },
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
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run()
    },
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
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
    },
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
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
    },
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
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
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
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
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
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
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
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setBlockquote().run()
    },
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
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
  // Media
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
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run()
    },
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
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      // Trigger image upload - this will be handled by the editor
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async (event) => {
        const file = event.target.files[0]
        if (!file) return
        // Dispatch custom event for image upload
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
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout().run()
    },
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
  other: 'Other',
}

// Command List Component
const CommandList = forwardRef(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const scrollContainerRef = useRef(null)
  const itemRefs = useRef([])

  const selectItem = useCallback(
    (index) => {
      const item = items[index]
      if (item) {
        command(item)
      }
    },
    [items, command]
  )

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = itemRefs.current[selectedIndex]
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0)
    itemRefs.current = []
  }, [items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length)
        return true
      }

      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % items.length)
        return true
      }

      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }

      return false
    },
  }))

  if (items.length === 0) {
    return (
      <div
        css={css`
          padding: 1rem 1.25rem;
          color: var(--grey-3);
          font-size: 0.875rem;
        `}
      >
        No results
      </div>
    )
  }

  const groupedItems = groupByCategory(items)
  let globalIndex = -1

  return (
    <div
      ref={scrollContainerRef}
      css={css`
        display: flex;
        flex-direction: column;
        padding: 0.375rem;
        min-width: 240px;
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
          {categoryItems.map((item) => {
            globalIndex++
            const currentIndex = globalIndex

            return (
              <button
                key={item.title}
                ref={(el) => (itemRefs.current[currentIndex] = el)}
                onClick={() => selectItem(currentIndex)}
                onMouseEnter={() => setSelectedIndex(currentIndex)}
                css={css`
                  display: flex;
                  align-items: center;
                  gap: 0.625rem;
                  width: 100%;
                  padding: 0.375rem 0.5rem;
                  border: none;
                  border-radius: 0.25rem;
                  background: ${selectedIndex === currentIndex ? 'var(--grey-2)' : 'transparent'};
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
            )
          })}
        </div>
      ))}
    </div>
  )
})

CommandList.displayName = 'CommandList'

// Suggestion configuration
const suggestion = {
  items: ({ query }) => {
    return SLASH_COMMANDS.filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10)
  },

  render: () => {
    let component = null
    let popup = null

    return {
      onStart: (props) => {
        component = new ReactRenderer(CommandList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) {
          return
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          animation: 'shift-away',
          theme: 'slash-command',
        })
      },

      onUpdate(props) {
        if (!component) return
        component.updateProps(props)

        if (!props.clientRect || !popup?.[0]) {
          return
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        })
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          if (popup?.[0]) {
            popup[0].hide()
          }
          return true
        }

        return component?.ref?.onKeyDown(props) ?? false
      },

      onExit() {
        if (popup?.[0]) {
          popup[0].destroy()
        }
        if (component) {
          component.destroy()
        }
      },
    }
  },
}

// Slash Commands Extension
const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          props.command({ editor, range })
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        ...suggestion,
      }),
    ]
  },
})

export default SlashCommands
export { SLASH_COMMANDS }

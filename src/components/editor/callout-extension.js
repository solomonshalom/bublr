import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import CalloutComponent from './callout-component'

// Callout Extension - creates an inline expandable callout/popup
const Callout = Node.create({
  name: 'callout',

  // Inline so it stays on the same line as surrounding text
  group: 'inline',
  inline: true,

  // No content - we store it as an HTML attribute
  atom: true,

  defining: true,

  addAttributes() {
    return {
      dotColor: {
        default: '#cf52f2',
        parseHTML: element => element.getAttribute('data-dot-color') || '#cf52f2',
        renderHTML: attributes => ({
          'data-dot-color': attributes.dotColor,
        }),
      },
      title: {
        default: '',
        parseHTML: element => element.getAttribute('data-title') || '',
        renderHTML: attributes => ({
          'data-title': attributes.title,
        }),
      },
      content: {
        default: '<p></p>',
        parseHTML: element => {
          const contentEl = element.querySelector('.callout-content')
          return contentEl ? contentEl.innerHTML : '<p></p>'
        },
        renderHTML: attributes => ({
          'data-content': attributes.content,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="callout"]',
      },
      // Also support div for backwards compatibility with existing content
      {
        tag: 'div[data-type="callout"]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const dotColor = HTMLAttributes['data-dot-color'] || '#cf52f2'
    const title = HTMLAttributes['data-title'] || 'Pop-up'

    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-type': 'callout', class: 'tiptap-callout' }),
      // Trigger pill
      ['button', { class: 'callout-trigger' },
        ['span', { class: 'callout-dot', style: `background-color: ${dotColor}` }],
        ['span', { class: 'callout-title' }, title],
        ['svg', { width: '12', height: '12', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'callout-icon' },
          ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }],
          ['polyline', { points: '15 3 21 3 21 9' }],
          ['line', { x1: '10', y1: '14', x2: '21', y2: '3' }]
        ]
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutComponent)
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              ...attributes,
              content: '<p></p>',
            },
          })
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-C': () => this.editor.commands.setCallout(),
    }
  },
})

export default Callout

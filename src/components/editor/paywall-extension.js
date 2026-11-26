import { Node, mergeAttributes } from '@tiptap/core'

/**
 * The paywall line in a paid post: everything above it is the free preview
 * anyone can read; everything below is for paid subscribers. Saved as
 * <div data-type="paywall"></div>, which the server splits on
 * (lib/paid-content). A post has at most one: adding a line moves it.
 */
const PaywallLine = Node.create({
  name: 'paywall',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="paywall"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'paywall', class: 'tiptap-paywall' })]
  },

  addCommands() {
    return {
      setPaywallLine:
        () =>
        ({ state, tr, dispatch }) => {
          const type = state.schema.nodes.paywall
          if (!type) return false
          if (dispatch) {
            const existing = []
            tr.doc.descendants((node, pos) => {
              if (node.type === type) existing.push({ pos, size: node.nodeSize })
            })
            for (const { pos, size } of existing.reverse()) tr.delete(pos, pos + size)
            // Between blocks, never splitting a paragraph: an empty paragraph
            // (where "/paywall" was typed) becomes the line; otherwise it goes
            // after the block the cursor is in.
            const { $from } = tr.selection
            if ($from.depth >= 1) {
              const block = $from.node(1)
              const start = $from.before(1)
              if (block.isTextblock && block.content.size === 0) tr.replaceWith(start, start + block.nodeSize, type.create())
              else tr.insert($from.after(1), type.create())
            } else {
              tr.insert($from.pos, type.create())
            }
          }
          return true
        },
      removePaywallLine:
        () =>
        ({ state, tr, dispatch }) => {
          const type = state.schema.nodes.paywall
          if (!type) return false
          const existing = []
          tr.doc.descendants((node, pos) => {
            if (node.type === type) existing.push({ pos, size: node.nodeSize })
          })
          if (!existing.length) return false
          if (dispatch) for (const { pos, size } of existing.reverse()) tr.delete(pos, pos + size)
          return true
        },
    }
  },
})

export default PaywallLine

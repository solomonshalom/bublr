/**
 * Convert the HTML Bublr's editor produces into Markdown, for exports.
 *
 * Works on any DOM-like tree (nodeType, nodeName, childNodes, getAttribute,
 * textContent), so the browser can hand it a DOMParser document and tests can
 * hand it a parsed tree. Covers what the editor makes: paragraphs, headings,
 * bold/italic/underline/strike/code/highlight, links, images, lists, task
 * lists, quotes, code blocks, rules and pop-up callouts. Anything else keeps
 * its text.
 */

const ELEMENT = 1
const TEXT = 3

const name = node => String(node.nodeName || '').toLowerCase()
const attr = (node, key) => (node.getAttribute ? node.getAttribute(key) : null)
const children = node => Array.from(node.childNodes || [])

function escapeText(text) {
  return text.replace(/([\\`*_[\]])/g, '\\$1')
}

function inline(node, ctx) {
  return children(node)
    .map(child => renderInline(child, ctx))
    .join('')
}

function renderInline(node, ctx) {
  if (node.nodeType === TEXT) {
    const text = String(node.textContent || node.nodeValue || '').replace(/\s+/g, ' ')
    return escapeText(text)
  }
  if (node.nodeType !== ELEMENT) return ''

  const tag = name(node)
  const content = () => inline(node, ctx)
  const wrap = (mark, inner) => {
    const text = inner.trim()
    if (!text) return inner
    // Keep surrounding spaces outside the markers so "**bold** text" works
    const lead = inner.match(/^\s*/)[0]
    const trail = inner.match(/\s*$/)[0]
    return `${lead}${mark}${text}${mark}${trail}`
  }

  switch (tag) {
    case 'strong':
    case 'b':
      return wrap('**', content())
    case 'em':
    case 'i':
      return wrap('*', content())
    case 's':
    case 'strike':
    case 'del':
      return wrap('~~', content())
    case 'u':
      return `<u>${content()}</u>`
    case 'mark':
      return `<mark>${content()}</mark>`
    case 'code':
      return '`' + String(node.textContent || '').replace(/`/g, '\\`') + '`'
    case 'br':
      return '  \n'
    case 'a': {
      const href = attr(node, 'href')
      const text = content()
      return href ? `[${text || href}](${href})` : text
    }
    case 'img': {
      const src = attr(node, 'src')
      if (!src) return ''
      return `![${escapeText(attr(node, 'alt') || '')}](${src})`
    }
    case 'span':
      if (attr(node, 'data-type') === 'callout') return renderCallout(node, ctx).trim()
      return content()
    case 'label':
    case 'input':
    case 'button':
    case 'svg':
      return ''
    default:
      return content()
  }
}

function renderCallout(node, ctx) {
  const title = attr(node, 'data-title') || 'Note'
  const body = ctx.parse ? blocks(ctx.parse(attr(node, 'data-content') || ''), ctx).trim() : ''
  const lines = [`**${escapeText(title)}**`]
  if (body) lines.push('', ...body.split('\n'))
  return '\n' + lines.map(l => (l ? `> ${l}` : '>')).join('\n') + '\n\n'
}

function listItems(node, ctx, ordered, depth) {
  const start = Number(attr(node, 'start')) || 1
  return children(node)
    .filter(child => child.nodeType === ELEMENT && name(child) === 'li')
    .map((li, index) => {
      const isTask = attr(li, 'data-type') === 'taskItem'
      let marker = ordered ? `${start + index}.` : '-'
      if (isTask) marker = `- [${attr(li, 'data-checked') === 'true' ? 'x' : ' '}]`
      const indent = '  '.repeat(depth)

      const parts = []
      let text = ''
      for (const child of children(li)) {
        const tag = child.nodeType === ELEMENT ? name(child) : ''
        if (tag === 'ul' || tag === 'ol') {
          if (text.trim()) parts.push(text.trim())
          text = ''
          parts.push(listItems(child, ctx, tag === 'ol', depth + 1).replace(/\n$/, ''))
        } else if (tag === 'p' || tag === 'div') {
          // A task item wraps its text in <div><p>..</p></div>; nested lists can live there too
          for (const grand of children(child)) {
            const gtag = grand.nodeType === ELEMENT ? name(grand) : ''
            if (gtag === 'ul' || gtag === 'ol') {
              if (text.trim()) parts.push(text.trim())
              text = ''
              parts.push(listItems(grand, ctx, gtag === 'ol', depth + 1).replace(/\n$/, ''))
            } else if (gtag === 'p') {
              text += (text ? ' ' : '') + inline(grand, ctx).trim()
            } else {
              text += renderInline(grand, ctx)
            }
          }
        } else {
          text += renderInline(child, ctx)
        }
      }
      if (text.trim()) parts.push(text.trim())

      const [first = '', ...rest] = parts
      return [`${indent}${marker} ${first}`.trimEnd(), ...rest].join('\n')
    })
    .join('\n') + '\n'
}

function blocks(node, ctx) {
  let out = ''
  let pendingInline = ''
  const flushInline = () => {
    if (pendingInline.trim()) out += pendingInline.trim() + '\n\n'
    pendingInline = ''
  }

  for (const child of children(node)) {
    if (child.nodeType === TEXT) {
      pendingInline += renderInline(child, ctx)
      continue
    }
    if (child.nodeType !== ELEMENT) continue
    const tag = name(child)

    switch (tag) {
      case 'p': {
        flushInline()
        const text = inline(child, ctx).trim()
        if (text) out += text + '\n\n'
        break
      }
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        flushInline()
        out += `${'#'.repeat(Number(tag[1]))} ${inline(child, ctx).trim()}\n\n`
        break
      case 'ul':
      case 'ol':
        flushInline()
        out += listItems(child, ctx, tag === 'ol', 0) + '\n'
        break
      case 'blockquote': {
        flushInline()
        const inner = blocks(child, ctx).trim()
        out += inner.split('\n').map(l => (l ? `> ${l}` : '>')).join('\n') + '\n\n'
        break
      }
      case 'pre': {
        flushInline()
        const codeEl = children(child).find(c => c.nodeType === ELEMENT && name(c) === 'code')
        const lang = ((codeEl && attr(codeEl, 'class')) || '').match(/language-([\w+-]+)/)
        const code = String((codeEl || child).textContent || '').replace(/\n$/, '')
        const fence = code.includes('```') ? '````' : '```'
        out += `${fence}${lang ? lang[1] : ''}\n${code}\n${fence}\n\n`
        break
      }
      case 'hr':
        flushInline()
        out += '---\n\n'
        break
      case 'img':
        flushInline()
        out += renderInline(child, ctx) + '\n\n'
        break
      case 'div':
      case 'section':
      case 'article':
        if (attr(child, 'data-type') === 'callout') {
          flushInline()
          out += renderCallout(child, ctx)
        } else {
          flushInline()
          out += blocks(child, ctx)
        }
        break
      case 'span':
        if (attr(child, 'data-type') === 'callout') {
          flushInline()
          out += renderCallout(child, ctx)
          break
        }
        pendingInline += renderInline(child, ctx)
        break
      default:
        pendingInline += renderInline(child, ctx)
    }
  }
  flushInline()
  return out
}

/**
 * @param {object} root  DOM-like root (e.g. document.body)
 * @param {object} [options]
 * @param {(html: string) => object} [options.parse]  parses an HTML string to
 *   a DOM-like root; used for callout bodies stored as HTML in an attribute
 */
export function domToMarkdown(root, options = {}) {
  return blocks(root, { parse: options.parse })
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n'
}

/** Browser helper: HTML string → Markdown using the native DOMParser. */
export function htmlToMarkdown(html) {
  if (typeof DOMParser === 'undefined') throw new Error('htmlToMarkdown needs a browser DOMParser')
  const parse = value => new DOMParser().parseFromString(`<body>${value || ''}</body>`, 'text/html').body
  return domToMarkdown(parse(html), { parse })
}

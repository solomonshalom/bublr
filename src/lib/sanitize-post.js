import sanitizeHtml from 'sanitize-html'

/**
 * One sanitizer for post HTML wherever it is shown to readers (the public
 * post page and the dashboard preview).
 *
 * Posts used to go through sanitize-html's defaults, which strip `class`,
 * `data-*`, `style`, `<input>` and `<button>`. That silently broke what the
 * editor produces: pop-up callouts turned into empty boxes, task lists lost
 * their checkboxes and highlight colours disappeared. This allow-list keeps
 * exactly those pieces and nothing that can run script.
 */

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const CSS_COLOR = /^(?:#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(?:,\s*[\d.]+\s*)?\)|[a-z]{3,20})$/i

// The callout's pop-up body is stored as HTML inside an attribute, so it gets
// sanitized on its own with the same rules (minus nested callouts).
function sanitizeCalloutBody(html) {
  return sanitizeHtml(String(html || ''), baseOptions())
}

function baseOptions() {
  return {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      // task lists: <label><input type="checkbox"></label>
      'label',
      'input',
    ]),
    allowedAttributes: {
      '*': ['class', 'dir'],
      a: ['href', 'name', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      ul: ['data-type'],
      li: ['data-type', 'data-checked'],
      input: ['type', 'checked', 'disabled'],
      mark: ['data-color', 'style'],
      code: ['class'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      ol: ['start'],
    },
    allowedStyles: {
      mark: {
        'background-color': [CSS_COLOR],
        color: [/^inherit$/],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowProtocolRelative: false,
    transformTags: {
      // Only read-only checkboxes survive
      input: (tagName, attribs) => {
        if (attribs.type !== 'checkbox') return { tagName: 'span', attribs: {} }
        const out = { type: 'checkbox', disabled: 'disabled' }
        if (attribs.checked !== undefined) out.checked = 'checked'
        return { tagName, attribs: out }
      },
      // Links in posts are user-generated: mark them nofollow/ugc (the
      // standard signal to search engines, which removes the backlink payoff
      // that draws SEO spam), and links opening a new tab never get a handle
      // on this window.
      a: (tagName, attribs) => {
        const rel = new Set(String(attribs.rel || '').split(/\s+/).filter(Boolean))
        rel.add('nofollow')
        rel.add('ugc')
        if (attribs.target === '_blank') {
          rel.add('noopener')
          rel.add('noreferrer')
        }
        return { tagName, attribs: { ...attribs, rel: [...rel].join(' ') } }
      },
    },
  }
}

function postOptions() {
  const options = baseOptions()
  return {
    ...options,
    allowedTags: options.allowedTags.concat([
      // pop-up callouts render a trigger button with an inline icon
      'button',
      'svg',
      'path',
      'polyline',
      'line',
    ]),
    allowedAttributes: {
      ...options.allowedAttributes,
      span: ['data-type', 'data-dot-color', 'data-title', 'data-content', 'style'],
      div: ['data-type', 'data-dot-color', 'data-title', 'data-content'],
      button: ['type'],
      svg: ['width', 'height', 'viewbox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'],
      path: ['d'],
      polyline: ['points'],
      line: ['x1', 'y1', 'x2', 'y2'],
    },
    allowedStyles: {
      ...options.allowedStyles,
      span: { 'background-color': [HEX_COLOR] },
    },
    transformTags: {
      ...options.transformTags,
      span: (tagName, attribs) => sanitizeCalloutAttributes(tagName, attribs),
      div: (tagName, attribs) => sanitizeCalloutAttributes(tagName, attribs),
      // Keep the class (the post page looks for .callout-trigger) and make
      // sure it's never a submit button
      button: (tagName, attribs) => ({
        tagName,
        attribs: attribs.class ? { type: 'button', class: attribs.class } : { type: 'button' },
      }),
    },
    // sanitize-html lowercases attribute names; keep the SVG viewBox working
    parser: { lowerCaseAttributeNames: false },
  }
}

function sanitizeCalloutAttributes(tagName, attribs) {
  if (attribs['data-type'] !== 'callout') {
    // Ordinary spans/divs keep only the generic attributes (class, dir, style
    // filtered by allowedStyles).
    const { 'data-type': _t, 'data-dot-color': _c, 'data-title': _ti, 'data-content': _co, ...rest } = attribs
    return { tagName, attribs: rest }
  }
  const out = { ...attribs }
  if (out['data-dot-color'] && !HEX_COLOR.test(out['data-dot-color'])) delete out['data-dot-color']
  if (out['data-title'] !== undefined) out['data-title'] = String(out['data-title']).slice(0, 200)
  if (out['data-content'] !== undefined) out['data-content'] = sanitizeCalloutBody(out['data-content'])
  return { tagName, attribs: out }
}

export function sanitizePostHtml(html) {
  const options = postOptions()
  // With lowerCaseAttributeNames off, SVG's viewBox arrives as "viewBox"
  options.allowedAttributes.svg = options.allowedAttributes.svg.concat(['viewBox'])
  return sanitizeHtml(String(html || ''), options)
}

export const _private = { HEX_COLOR, CSS_COLOR }

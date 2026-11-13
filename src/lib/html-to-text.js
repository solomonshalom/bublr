import { htmlToText as convert } from 'html-to-text'

/**
 * html-to-text, but forgiving about what it's handed, the way version 8 was.
 *
 * Version 10 throws on anything that isn't a string, and post fields aren't
 * always strings: a title saved as a number through the API, a missing
 * excerpt. One odd post shouldn't take down a whole feed or page, so
 * everything imports htmlToText from here rather than from the package.
 */
export function htmlToText(html, options) {
  const text = typeof html === 'string' ? html : html ? String(html) : ''
  return convert(text, options)
}

export default htmlToText

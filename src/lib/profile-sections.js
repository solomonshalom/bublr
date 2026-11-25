/**
 * Profile section order. Gallery, Music and Shop came later than the other
 * sections, so older saved orders don't list them: they're slotted in after
 * Writing (or before the Guest Book). A section only shows once it has content.
 */
export const BLOCK_SECTIONS = ['gallery', 'music', 'shop']

export const DEFAULT_SECTION_ORDER = ['skills', 'work', 'education', 'writing', 'gallery', 'music', 'shop', 'guestbook', 'custom']

export function withBlockSections(order) {
  const result = Array.isArray(order) ? order.filter((s, i) => typeof s === 'string' && order.indexOf(s) === i) : []
  const missing = BLOCK_SECTIONS.filter(section => !result.includes(section))
  if (!missing.length) return result
  let at = result.indexOf('writing')
  if (at >= 0) at += 1
  else {
    at = result.indexOf('guestbook')
    if (at < 0) at = result.length
  }
  result.splice(at, 0, ...missing)
  return result
}

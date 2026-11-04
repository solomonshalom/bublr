// Parses changelog.md into entries so /changelog can show every release
// without anyone hand-copying text into a page.
//
// Format: each release starts with "# Title (date)". Inside a release,
// "## Heading" starts a section, "- " lines are bullets, anything else is a
// paragraph. Blocks are separated by blank lines.

export function parseChangelog(markdown) {
  const entries = []
  let entry = null
  let list = null
  let para = []

  const flushPara = () => {
    if (entry && para.length) entry.blocks.push({ type: 'p', text: para.join(' ') })
    para = []
  }
  const flushList = () => {
    list = null
  }

  for (const raw of String(markdown || '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    const h1 = line.match(/^#\s+(.+)$/)
    const h2 = line.match(/^##\s+(.+)$/)
    const bullet = line.match(/^\s*[-*]\s+(.+)$/)

    if (h1) {
      flushPara()
      flushList()
      const m = h1[1].match(/^(.*?)\s*\(([^)]+)\)\s*$/)
      entry = { title: (m ? m[1] : h1[1]).trim(), date: m ? m[2].trim() : '', blocks: [] }
      entries.push(entry)
    } else if (!entry) {
      continue
    } else if (h2) {
      flushPara()
      flushList()
      entry.blocks.push({ type: 'h', text: h2[1].trim() })
    } else if (bullet) {
      flushPara()
      if (!list) {
        list = { type: 'ul', items: [] }
        entry.blocks.push(list)
      }
      list.items.push(bullet[1].trim())
    } else if (!line.trim()) {
      flushPara()
      flushList()
    } else {
      flushList()
      para.push(line.trim())
    }
  }
  flushPara()

  // Newest first: changelog.md is written oldest-first.
  return entries.reverse()
}

// Inline markup -> tokens. Only `code`, **bold**, *italic* and [text](url)
// are understood; everything else stays plain text. Links are limited to
// http(s), mailto and site-relative URLs, so a changelog entry can never
// inject a javascript: link.
export function parseInline(text) {
  const tokens = []
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let m
  const str = String(text || '')
  while ((m = re.exec(str))) {
    if (m.index > last) tokens.push({ type: 'text', text: str.slice(last, m.index) })
    if (m[1] !== undefined) tokens.push({ type: 'code', text: m[1] })
    else if (m[2] !== undefined) tokens.push({ type: 'strong', text: m[2] })
    else if (m[3] !== undefined) tokens.push({ type: 'em', text: m[3] })
    else if (/^(https?:\/\/|mailto:|\/(?!\/))/i.test(m[5])) {
      tokens.push({ type: 'link', text: m[4], href: m[5] })
    } else tokens.push({ type: 'text', text: m[4] })
    last = re.lastIndex
  }
  if (last < str.length) tokens.push({ type: 'text', text: str.slice(last) })
  return tokens
}

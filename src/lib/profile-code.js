/**
 * Profile HTML: a writer can replace or extend their profile with their own
 * HTML, CSS and JavaScript, the way MySpace let people restyle their page.
 *
 * Safety model. The writer's code never runs on bublr.life's origin. It is
 * served by /api/profile-frame/[username] (and previewed through
 * /api/profile-preview) with a `Content-Security-Policy: sandbox` header and
 * shown in an <iframe sandbox> without `allow-same-origin`. That gives the
 * document an opaque origin: its scripts can't read the visitor's Firebase
 * sign-in, cookies or storage, can't touch the profile page around it, can't
 * submit forms, open dialogs or navigate the visitor away without a click.
 * The header applies even if someone opens the frame URL directly.
 *
 * Supercharged parts, all in this file so the editor preview and the live
 * page build exactly the same document:
 *   - template tags: {{displayName}}, {{#posts}}…{{/posts}}, {{^posts}}…
 *   - widgets: <bublr-posts>, <bublr-guestbook>, <bublr-friends> (a Top 8),
 *     <bublr-music>, <bublr-counter> and more, expanded on the server so
 *     they work without JavaScript
 *   - window.bublr: the same public data for scripts, plus theme events
 *   - light/dark: <html data-theme> follows the visitor's Bublr theme
 */

import { escapeHtml, safeJsonLd } from './escape'

export const PROFILE_CODE_MODES = ['off', 'block', 'page']
export const PROFILE_CODE_PLACEMENTS = ['top', 'bottom']

// Bytes (UTF-8). The code lives in the user document, which Firestore caps at
// 1 MiB together with everything else on the profile.
export const PROFILE_CODE_LIMITS = {
  html: 120 * 1024,
  css: 60 * 1024,
  js: 60 * 1024,
  total: 200 * 1024,
}

export const MAX_REVISIONS = 20
export const MAX_FRIENDS = 12

// Rendering budget: template sections nested inside each other over the
// same list multiply. The frame is rendered on our server, so a page can't be
// allowed to ask for millions of iterations.
const RENDER_BUDGET = 60000
const MAX_OUTPUT = 1500000
const MAX_COMPONENTS = 300
const MAX_LOOP_ITEMS = 500

const FIELD_NAMES = ['html', 'css', 'js']

export function byteLength(value) {
  return new TextEncoder().encode(String(value || '')).length
}

/** Strings only; NUL characters dropped (they're our placeholder marker); \r\n -> \n. */
export function normalizeCode(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\u0000/g, '').replace(/\r\n?/g, '\n')
}

// Each pattern is a single pass (no two quantifiers over the same text), so
// they stay linear on hostile input.
const PASSWORD_PATTERNS = [
  /\btype\s*[=:][\s"'`\\]*password/i,
  /["'`]type["'`]\s*,\s*["'`]password/i,
  /-webkit-text-security\s*:\s*(?:disc|circle|square)/i,
]

/**
 * A profile page has no reason to ask a visitor for a password, and a fake
 * "sign in" box on bublr.life is the easiest phishing there is. This is a
 * speed bump (the sandbox already stops forms from submitting), not the
 * security boundary.
 */
export function asksForPassword({ html = '', css = '', js = '' } = {}) {
  const text = `${decodeEntities(String(html))}\n${css}\n${js}`
  return PASSWORD_PATTERNS.some(re => re.test(text))
}

// Strings in the writer's script, so text a page only draws with JavaScript
// is moderated too. Alternatives can't overlap and the length is bounded.
const JS_STRING = /(["'`])((?:\\.|(?!\1)[^\\\n]){3,300})\1/g

/** What moderation reads: the HTML plus the text inside the script's strings. */
export function moderationText({ html = '', js = '' } = {}) {
  const strings = []
  let total = 0
  let m
  JS_STRING.lastIndex = 0
  while (total < 4000 && (m = JS_STRING.exec(String(js))) !== null) {
    strings.push(m[2])
    total += m[2].length
  }
  return strings.length ? `${html}\n<p>${escapeHtml(strings.join(' '))}</p>` : String(html)
}

/**
 * Check what the editor sends. Returns { ok: true, value } with clean values,
 * or { ok: false, error, field? } with a sentence the writer can act on.
 */
export function validateProfileCode(input) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Nothing to save' }

  for (const field of FIELD_NAMES) {
    if (input[field] !== undefined && input[field] !== null && typeof input[field] !== 'string') {
      return { ok: false, error: `${field.toUpperCase()} must be text`, field }
    }
  }

  const value = {
    html: normalizeCode(input.html),
    css: normalizeCode(input.css),
    js: normalizeCode(input.js),
    mode: input.mode === undefined ? 'off' : input.mode,
    placement: input.placement === undefined ? 'bottom' : input.placement,
  }

  if (!PROFILE_CODE_MODES.includes(value.mode)) {
    return { ok: false, error: `Mode must be one of: ${PROFILE_CODE_MODES.join(', ')}`, field: 'mode' }
  }
  if (!PROFILE_CODE_PLACEMENTS.includes(value.placement)) {
    return { ok: false, error: `Placement must be top or bottom`, field: 'placement' }
  }

  let total = 0
  for (const field of FIELD_NAMES) {
    const size = byteLength(value[field])
    total += size
    if (size > PROFILE_CODE_LIMITS[field]) {
      return {
        ok: false,
        error: `${field.toUpperCase()} is ${formatKb(size)}; the limit is ${formatKb(PROFILE_CODE_LIMITS[field])}`,
        field,
      }
    }
  }
  if (total > PROFILE_CODE_LIMITS.total) {
    return { ok: false, error: `Your code is ${formatKb(total)} in total; the limit is ${formatKb(PROFILE_CODE_LIMITS.total)}` }
  }

  if (value.mode !== 'off' && !value.html.trim()) {
    return { ok: false, error: 'Add some HTML before showing it on your profile', field: 'html' }
  }

  if (asksForPassword(value)) {
    return {
      ok: false,
      error: 'Password fields aren’t allowed on profiles. Nobody should be asked for a password on your page.',
      field: 'html',
    }
  }

  return { ok: true, value, size: total }
}

export function formatKb(bytes) {
  return `${Math.round((bytes / 1024) * 10) / 10} KB`
}

/** What a public page needs to know about the code (never the code itself). */
export function summarizeProfileCode(profileCode) {
  if (!profileCode || typeof profileCode !== 'object') return null
  const mode = PROFILE_CODE_MODES.includes(profileCode.mode) ? profileCode.mode : 'off'
  const placement = PROFILE_CODE_PLACEMENTS.includes(profileCode.placement) ? profileCode.placement : 'bottom'
  const version = Number.isFinite(profileCode.version) ? profileCode.version : 0
  const hasHtml = typeof profileCode.html === 'string' ? profileCode.html.trim().length > 0 : !!profileCode.hasHtml
  return { mode: hasHtml ? mode : 'off', placement, version }
}

// ---------------------------------------------------------------------------
// Escaping

export { escapeHtml }

/** For values dropped into CSS (url(...), content: "..."). Keeps declarations intact. */
export function escapeCss(value) {
  return String(value ?? '').replace(/[\\"'()<>{};\n\r]/g, ch => `\\${ch.charCodeAt(0).toString(16)} `)
}

/** Only links a visitor can safely follow: http(s), mailto, or a path on this site. */
export function safeUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^\/(?!\/)/.test(url)) return url
  if (/^https?:\/\//i.test(url)) return url
  if (/^mailto:[^\s]+$/i.test(url)) return url
  return ''
}

export function normalizeWebsite(link) {
  const raw = String(link || '').trim()
  if (!raw) return ''
  return safeUrl(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
}

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(text, max) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
}

// ---------------------------------------------------------------------------
// Template data

const SOCIAL_NETWORKS = [
  { key: 'github', label: 'GitHub', url: h => `https://github.com/${h}` },
  { key: 'twitter', label: 'X / Twitter', url: h => `https://twitter.com/${h}` },
  { key: 'instagram', label: 'Instagram', url: h => `https://instagram.com/${h}` },
  { key: 'linkedin', label: 'LinkedIn', url: h => `https://linkedin.com/in/${h}` },
  { key: 'youtube', label: 'YouTube', url: h => `https://youtube.com/@${h}` },
  { key: 'email', label: 'Email', url: h => `mailto:${h}` },
]

const DOT_COLORS = ['#cf52f2', '#6BCB77', '#4D96FF', '#A66CFF', '#E23E57', '#ff3e00']

function postDotColor(post, index) {
  if (post.dotColor && DOT_COLORS.includes(post.dotColor)) return post.dotColor
  const id = String(post.id || index)
  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return DOT_COLORS[hash % DOT_COLORS.length]
}

function toMs(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value._seconds === 'number') return value._seconds * 1000
  if (typeof value.seconds === 'number') return value.seconds * 1000
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatDate(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function experienceList(list) {
  return (Array.isArray(list) ? list : [])
    .filter(e => e && ((e.title || '').trim() || (e.organization || '').trim()))
    .slice(0, 30)
    .map(e => {
      const start = String(e.startDate || '').trim()
      const end = e.current ? 'Present' : String(e.endDate || '').trim()
      return {
        title: String(e.title || ''),
        organization: String(e.organization || ''),
        location: String(e.location || ''),
        description: String(e.description || ''),
        dates: start && end ? `${start} – ${end}` : start || end,
        url: e.url ? normalizeWebsite(e.url) : '',
      }
    })
}

const SVG_PATH = /^[MLHVCSQTAZmlhvcsqtaz0-9eE.,\s+-]{1,20000}$/
const VIEW_BOX = /^-?[\d.]+(?:[ ,]+-?[\d.]+){3}$/

/**
 * The public data a profile page may use. `user` is a profile with posts
 * already loaded (getUserByName); only published posts are used. Everything
 * here is already public on the classic profile.
 */
export function buildTemplateData(user, { guestbook = [], friends = {}, now = Date.now() } = {}) {
  const u = user || {}
  const name = String(u.name || '')
  const allPosts = Array.isArray(u.posts) ? u.posts : []
  const published = allPosts
    .filter(p => p && typeof p === 'object' && p.published)
    .map(p => ({ post: p, ms: toMs(p.lastEdited) }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 50)

  const posts = published.map(({ post, ms }, i) => ({
    title: truncate(stripTags(post.title) || 'Untitled', 200),
    url: `/${encodeURIComponent(name)}/${encodeURIComponent(String(post.slug || ''))}`,
    slug: String(post.slug || ''),
    excerpt: truncate(stripTags(post.excerpt), 280),
    date: formatDate(ms),
    isoDate: ms ? new Date(ms).toISOString() : '',
    dotColor: postDotColor(post, i),
    reads: Number.isFinite(post.views) ? post.views : 0,
    index: i + 1,
  }))

  const socialLinks = u.socialLinks && typeof u.socialLinks === 'object' ? u.socialLinks : {}
  const socials = SOCIAL_NETWORKS.filter(n => typeof socialLinks[n.key] === 'string' && socialLinks[n.key].trim())
    .map(n => {
      const handle = socialLinks[n.key].trim().replace(/^@/, '')
      return { network: n.key, label: n.label, handle, url: safeUrl(n.url(encodeURI(handle))) }
    })
  const website = normalizeWebsite(u.link)
  if (website) {
    let host = website
    try {
      host = new URL(website).hostname.replace(/^www\./, '')
    } catch (_) {
      // keep the full link
    }
    socials.push({ network: 'website', label: host, handle: host, url: website })
  }

  const count = (n, list) => (Number.isFinite(n) ? n : Array.isArray(list) ? list.length : 0)

  const entries = (Array.isArray(guestbook) ? guestbook : []).slice(0, 50).map(entry => {
    const d = typeof entry.signaturePath === 'string' && SVG_PATH.test(entry.signaturePath) ? entry.signaturePath : ''
    const viewBox = typeof entry.signatureViewBox === 'string' && entry.signatureViewBox.length < 100 && VIEW_BOX.test(entry.signatureViewBox.trim())
      ? entry.signatureViewBox.trim()
      : '0 0 300 100'
    const ms = toMs(entry.createdAt)
    return {
      name: String(entry.name || 'Someone').slice(0, 80),
      message: String(entry.message || '').slice(0, 500),
      date: formatDate(ms),
      signature: d ? { d, viewBox } : null,
    }
  })

  const skills = (Array.isArray(u.skills) ? u.skills : []).filter(s => typeof s === 'string' && s.trim()).slice(0, 60)
  const work = experienceList(u.workExperience)
  const education = experienceList(u.education)

  const friendMap = {}
  for (const [key, f] of Object.entries(friends && typeof friends === 'object' ? friends : {})) {
    if (!f || typeof f !== 'object') continue
    friendMap[key.toLowerCase()] = {
      name: String(f.name || key),
      displayName: String(f.displayName || f.name || key),
      photo: safeUrl(f.photo) || '',
      url: `/${encodeURIComponent(String(f.name || key))}`,
    }
  }

  return scrub({
    name,
    username: name,
    displayName: String(u.displayName || name),
    about: String(u.about || ''),
    photo: safeUrl(u.photo) || '',
    banner: safeUrl(u.banner) || '',
    link: website,
    profileUrl: `/${encodeURIComponent(name)}`,
    followerCount: count(u.followerCount, u.followers),
    followingCount: count(u.followingCount, u.following),
    subscriberCount: count(u.subscriberCount, null),
    postCount: posts.length,
    totalReads: posts.reduce((sum, p) => sum + p.reads, 0),
    hasPosts: posts.length > 0,
    hasSkills: skills.length > 0,
    hasSocials: socials.length > 0,
    hasGuestbook: entries.length > 0,
    year: new Date(now).getUTCFullYear(),
    skills,
    socials,
    posts,
    latestPost: posts[0] || null,
    guestbook: entries,
    work,
    education,
    hasWork: work.length > 0,
    hasEducation: education.length > 0,
    friends: friendMap,
  })
}

// NUL marks our placeholders while rendering; profile data never carries one.
function scrub(value) {
  if (typeof value === 'string') return value.indexOf('\u0000') === -1 ? value : value.replace(/\u0000/g, '')
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[scrub(k)] = scrub(v)
    return out
  }
  return value
}

// ---------------------------------------------------------------------------
// Template engine: a small, safe subset of Mustache.
//   {{name}}             escaped value (missing -> empty)
//   {{#list}}…{{/list}}  repeat for each item / show when truthy
//   {{^list}}…{{/list}}  show when empty or falsy
//   {{.}}                the current item (for lists of text, like skills)
//   {{! note }}          comment
// Anything else in braces ({{ a + b }}) is left as written.

// {{ … }} with no braces inside. Whitespace and the sigil are read in JS:
// several \s* over the same characters make a regex take n^4 time.
const TAG_RE = /\{\{([^{}]*)\}\}/g
const MAX_DEPTH = 64
const NAME_RE = /^(?:\.|[A-Za-z_]\w*(?:\.(?:[A-Za-z_]\w*|\d+))*)$/

export function parseTemplate(source) {
  const src = String(source || '')
  const root = { type: 'root', children: [] }
  const stack = [root]
  const warnings = []
  let last = 0
  const top = () => stack[stack.length - 1]

  // Turn an unclosed section back into its literal tag followed by its
  // contents. An open section is always its parent's last child.
  const flatten = (parent, node) => {
    parent.children.pop()
    parent.children.push({ type: 'text', value: node.raw })
    for (const child of node.children) parent.children.push(child)
  }

  TAG_RE.lastIndex = 0
  let m
  while ((m = TAG_RE.exec(src)) !== null) {
    const whole = m[0]
    let name = m[1].trim()
    let sigil = ''
    if (name && '#^/!'.includes(name[0])) {
      sigil = name[0]
      name = name.slice(1).trim()
    }
    if (m.index > last) top().children.push({ type: 'text', value: src.slice(last, m.index) })
    last = m.index + whole.length

    if (sigil === '!') continue
    if (!NAME_RE.test(name)) {
      top().children.push({ type: 'text', value: whole })
      continue
    }

    if ((sigil === '#' || sigil === '^') && stack.length > MAX_DEPTH) {
      warnings.push(`Sections are nested more than ${MAX_DEPTH} deep`)
      top().children.push({ type: 'text', value: whole })
    } else if (sigil === '#' || sigil === '^') {
      const node = { type: 'section', inverted: sigil === '^', name, children: [], raw: whole }
      top().children.push(node)
      stack.push(node)
    } else if (sigil === '/') {
      let idx = -1
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].name === name) {
          idx = i
          break
        }
      }
      if (idx === -1) {
        warnings.push(`{{/${name}}} has no matching {{#${name}}}`)
        top().children.push({ type: 'text', value: whole })
        continue
      }
      while (stack.length - 1 > idx) {
        const open = stack.pop()
        warnings.push(`{{${open.inverted ? '^' : '#'}${open.name}}} is never closed`)
        flatten(top(), open)
      }
      stack.pop()
    } else {
      top().children.push({ type: 'var', name })
    }
  }
  if (last < src.length) top().children.push({ type: 'text', value: src.slice(last) })
  while (stack.length > 1) {
    const open = stack.pop()
    warnings.push(`{{${open.inverted ? '^' : '#'}${open.name}}} is never closed`)
    flatten(top(), open)
  }
  return { tree: root, warnings }
}

const own = (obj, key) => obj !== null && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key)

function lookup(contexts, name) {
  if (name === '.') return contexts[contexts.length - 1]
  const [head, ...rest] = name.split('.')
  for (let i = contexts.length - 1; i >= 0; i--) {
    if (own(contexts[i], head)) {
      let value = contexts[i][head]
      for (const key of rest) value = own(value, key) ? value[key] : undefined
      return value
    }
  }
  return undefined
}

function stringify(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.filter(v => typeof v === 'string' || typeof v === 'number').join(', ')
  return ''
}

function isTruthy(value) {
  if (Array.isArray(value)) return value.length > 0
  return !!value
}

function renderNodes(nodes, contexts, escape, state) {
  let out = ''
  for (const node of nodes) {
    if (state.exhausted) return out
    if (++state.steps > RENDER_BUDGET || state.length > MAX_OUTPUT) {
      state.exhausted = true
      return out
    }
    let piece = ''
    if (node.type === 'text') piece = node.value
    else if (node.type === 'var') piece = escape(stringify(lookup(contexts, node.name)))
    else if (node.type === 'section') {
      const value = lookup(contexts, node.name)
      if (node.inverted) {
        if (!isTruthy(value)) piece = renderNodes(node.children, contexts, escape, state)
      } else if (Array.isArray(value)) {
        for (const item of value.slice(0, MAX_LOOP_ITEMS)) {
          piece += renderNodes(node.children, [...contexts, item], escape, state)
          if (state.exhausted) break
        }
      } else if (isTruthy(value)) {
        piece = renderNodes(node.children, typeof value === 'object' ? [...contexts, value] : contexts, escape, state)
      }
    }
    out += piece
    state.length += piece.length
  }
  return out
}

function newState() {
  return { steps: 0, length: 0, exhausted: false }
}

/** Render a template string. Never throws; problems come back as warnings. */
export function renderTemplate(source, data, { escape = escapeHtml, contexts, state } = {}) {
  const { tree, warnings } = parseTemplate(source)
  const s = state || newState()
  const output = renderNodes(tree.children, contexts || [data], escape, s)
  if (s.exhausted && !state) warnings.push('This page asks for too much repetition; the rest was cut off')
  return { output, warnings }
}

// ---------------------------------------------------------------------------
// Widgets: <bublr-*> elements, expanded into plain HTML on the server.

const ATTR_RE = /([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole
  })
}

function parseAttributes(source) {
  const attrs = {}
  ATTR_RE.lastIndex = 0
  let m
  while ((m = ATTR_RE.exec(source)) !== null) {
    const key = m[1].toLowerCase()
    if (!(key in attrs)) attrs[key] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  }
  return attrs
}

function intAttr(value, fallback, min, max) {
  const n = parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

/**
 * Find <bublr-*> elements in `html`. Supports <bublr-x />, <bublr-x></bublr-x>
 * (with an optional per-item template inside) and a lone <bublr-x>.
 */
export function findComponents(html, limit = MAX_COMPONENTS) {
  const src = String(html || '')
  const found = []
  // The name can't be followed by a name character, and the attributes are a
  // single run up to the next < or >: linear on any input.
  const OPEN_RE = /<bublr-([a-z][a-z0-9-]*)(?=[\s/>])([^<>]*)>/gi
  let m
  while ((m = OPEN_RE.exec(src)) !== null) {
    if (found.length >= limit) break
    const name = m[1].toLowerCase()
    const start = m.index
    let end = m.index + m[0].length
    let inner = ''
    const attrSource = m[2].trimEnd()
    const selfClosing = attrSource.endsWith('/')
    if (!selfClosing) {
      const closeRe = new RegExp(`</bublr-${name}\\s*>`, 'i')
      const rest = src.slice(end)
      const close = closeRe.exec(rest)
      const nextOpen = rest.search(new RegExp(`<bublr-${name}(?=[\\s/>])`, 'i'))
      if (close && (nextOpen === -1 || close.index < nextOpen)) {
        inner = rest.slice(0, close.index)
        end = end + close.index + close[0].length
      }
    }
    const attrs = parseAttributes((selfClosing ? attrSource.slice(0, -1) : attrSource).slice(0, 4000))
    found.push({ name, attrs, inner, start, end })
    OPEN_RE.lastIndex = end
  }
  return found
}

export const COMPONENT_NAMES = [
  'avatar',
  'name',
  'username',
  'bio',
  'banner',
  'posts',
  'latest-post',
  'skills',
  'socials',
  'stats',
  'counter',
  'guestbook',
  'friends',
  'music',
  'work',
  'education',
  'year',
]

function ul(cls, items) {
  return `<ul class="${cls}">${items.join('')}</ul>`
}

function itemTemplate(component, items, data, state, fallback) {
  if (component.inner.trim()) {
    return items
      .map(item => renderTemplate(component.inner, data, { contexts: [data, item], state }).output)
      .join('')
  }
  return fallback()
}

const e = escapeHtml

function renderPosts(component, data, state) {
  const a = component.attrs
  const limit = intAttr(a.limit, 10, 1, 50)
  const layout = ['list', 'cards', 'grid', 'compact'].includes(a.layout) ? a.layout : 'list'
  const posts = data.posts.slice(0, limit)
  if (!posts.length) return `<p class="bublr-empty">${e(a.empty || 'No posts yet.')}</p>`
  const showExcerpt = a.excerpt !== 'false' && layout !== 'compact'
  const showDate = a.date !== 'false'
  return itemTemplate(component, posts, data, state, () =>
    ul(
      `bublr-posts bublr-posts--${layout}`,
      posts.map(p =>
        `<li class="bublr-post" style="--dot:${p.dotColor}"><a class="bublr-post__title" href="${e(p.url)}">${e(p.title)}</a>` +
        (showDate && p.date ? ` <time class="bublr-post__date" datetime="${e(p.isoDate)}">${e(p.date)}</time>` : '') +
        (showExcerpt && p.excerpt ? `<p class="bublr-post__excerpt">${e(p.excerpt)}</p>` : '') +
        '</li>'
      )
    )
  )
}

function renderGuestbook(component, data, state) {
  const limit = intAttr(component.attrs.limit, 8, 1, 50)
  const entries = data.guestbook.slice(0, limit)
  if (!entries.length) return `<p class="bublr-empty">${e(component.attrs.empty || 'No guest book signatures yet.')}</p>`
  return itemTemplate(component, entries, data, state, () =>
    ul(
      'bublr-guestbook',
      entries.map(g =>
        '<li class="bublr-guestbook__entry">' +
        (g.signature
          ? `<svg class="bublr-guestbook__signature" viewBox="${e(g.signature.viewBox)}" role="img" aria-label="${e(g.name)}’s signature"><path d="${e(g.signature.d)}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : '') +
        `<span class="bublr-guestbook__name">${e(g.name)}</span>` +
        (g.message ? `<p class="bublr-guestbook__message">${e(g.message)}</p>` : '') +
        (g.date ? `<time class="bublr-guestbook__date">${e(g.date)}</time>` : '') +
        '</li>'
      )
    )
  )
}

export function friendNamesFrom(value) {
  return String(value || '')
    .split(/[\s,]+/)
    .map(s => s.trim().replace(/^@/, '').toLowerCase())
    .filter(s => /^[a-z0-9_.-]{1,40}$/.test(s))
}

/** Usernames mentioned by <bublr-friends users="…"> anywhere in the page. */
export function extractFriendNames(html) {
  const names = []
  for (const c of findComponents(html)) {
    if (c.name !== 'friends') continue
    for (const n of friendNamesFrom(c.attrs.users)) if (!names.includes(n)) names.push(n)
  }
  return names.slice(0, MAX_FRIENDS)
}

function renderFriends(component, data, state) {
  const names = friendNamesFrom(component.attrs.users).slice(0, MAX_FRIENDS)
  const friends = names.map(n => data.friends[n]).filter(Boolean)
  const title = component.attrs.title
  if (!friends.length) return component.attrs.empty ? `<p class="bublr-empty">${e(component.attrs.empty)}</p>` : ''
  const body = itemTemplate(component, friends, data, state, () =>
    ul(
      'bublr-friends',
      friends.map(f =>
        `<li class="bublr-friend"><a href="${e(f.url)}">` +
        (f.photo ? `<img class="bublr-friend__photo" src="${e(f.photo)}" alt="" loading="lazy">` : '<span class="bublr-friend__photo"></span>') +
        `<span class="bublr-friend__name">${e(f.displayName)}</span></a></li>`
      )
    )
  )
  return title ? `<section class="bublr-friends-box"><h2 class="bublr-friends__title">${e(title)}</h2>${body}</section>` : body
}

function renderMusic(component) {
  const a = component.attrs
  const src = safeUrl(a.src)
  if (!/^https?:\/\//i.test(src)) return ''
  const title = a.title ? `<figcaption class="bublr-music__title">${e(a.title)}</figcaption>` : ''
  const loop = a.loop !== undefined && a.loop !== 'false' ? ' loop' : ''
  return `<figure class="bublr-music">${title}<audio class="bublr-music__player" controls preload="none"${loop} src="${e(src)}"></audio></figure>`
}

function renderExperience(component, data, state, key) {
  const list = data[key]
  if (!list.length) return ''
  return itemTemplate(component, list, data, state, () =>
    ul(
      `bublr-timeline bublr-${key}`,
      list.map(x =>
        '<li class="bublr-timeline__item">' +
        `<span class="bublr-timeline__title">${e(x.title || x.organization)}</span>` +
        (x.title && x.organization
          ? ` <span class="bublr-timeline__org">${x.url ? `<a href="${e(x.url)}">${e(x.organization)}</a>` : e(x.organization)}</span>`
          : '') +
        (x.dates || x.location ? `<span class="bublr-timeline__meta">${e([x.dates, x.location].filter(Boolean).join(' · '))}</span>` : '') +
        (x.description ? `<p class="bublr-timeline__description">${e(x.description)}</p>` : '') +
        '</li>'
      )
    )
  )
}

export function renderComponent(component, data, state = newState()) {
  const a = component.attrs
  switch (component.name) {
    case 'avatar': {
      if (!data.photo) return ''
      const size = intAttr(a.size, 72, 16, 512)
      const shape = ['circle', 'square', 'rounded'].includes(a.shape) ? a.shape : 'circle'
      return `<img class="bublr-avatar bublr-avatar--${shape}" src="${e(data.photo)}" alt="${e(data.displayName)}" width="${size}" height="${size}">`
    }
    case 'name':
      return `<span class="bublr-name">${e(data.displayName)}</span>`
    case 'username':
      return `<span class="bublr-username">@${e(data.name)}</span>`
    case 'bio':
      return data.about ? `<p class="bublr-bio">${e(data.about).replace(/\n/g, '<br>')}</p>` : ''
    case 'banner':
      return data.banner ? `<img class="bublr-banner" src="${e(data.banner)}" alt="">` : ''
    case 'year':
      return String(data.year)
    case 'posts':
      return renderPosts(component, data, state)
    case 'latest-post': {
      const p = data.latestPost
      if (!p) return `<p class="bublr-empty">${e(a.empty || 'No posts yet.')}</p>`
      return itemTemplate(component, [p], data, state, () =>
        `<article class="bublr-latest"><span class="bublr-latest__label">${e(a.label || 'Latest post')}</span>` +
        `<a class="bublr-latest__title" href="${e(p.url)}">${e(p.title)}</a>` +
        (p.excerpt ? `<p class="bublr-latest__excerpt">${e(p.excerpt)}</p>` : '') +
        '</article>'
      )
    }
    case 'skills':
      if (!data.skills.length) return ''
      return itemTemplate(component, data.skills, data, state, () =>
        ul('bublr-skills', data.skills.map((s, i) => `<li class="bublr-skill" style="--dot:${DOT_COLORS[i % DOT_COLORS.length]}">${e(s)}</li>`))
      )
    case 'socials':
      if (!data.socials.length) return ''
      return itemTemplate(component, data.socials, data, state, () =>
        ul(
          'bublr-socials',
          data.socials.map(s => {
            const external = s.network !== 'email'
            return `<li><a class="bublr-social bublr-social--${e(s.network)}" href="${e(s.url)}"${external ? ' target="_blank" rel="noopener noreferrer me"' : ''}>${e(s.label)}</a></li>`
          })
        )
      )
    case 'stats': {
      const stats = [
        ['posts', 'Posts', data.postCount],
        ['reads', 'Reads', data.totalReads],
        ['followers', 'Followers', data.followerCount],
        ['following', 'Following', data.followingCount],
      ]
      const only = a.show ? String(a.show).split(/[\s,]+/) : null
      return `<dl class="bublr-stats">${stats
        .filter(([key]) => !only || only.includes(key))
        .map(([key, label, n]) => `<div class="bublr-stat bublr-stat--${key}"><dt>${label}</dt><dd>${n}</dd></div>`)
        .join('')}</dl>`
    }
    case 'counter': {
      const digits = intAttr(a.digits, 6, 1, 12)
      const value = String(data.totalReads).padStart(digits, '0')
      const label = a.label === undefined ? 'reads' : a.label
      return `<span class="bublr-counter" aria-label="${e(`${data.totalReads} ${label}`)}">${value
        .split('')
        .map(d => `<span class="bublr-counter__digit">${d}</span>`)
        .join('')}${label ? `<span class="bublr-counter__label">${e(label)}</span>` : ''}</span>`
    }
    case 'guestbook':
      return renderGuestbook(component, data, state)
    case 'friends':
      return renderFriends(component, data, state)
    case 'music':
      return renderMusic(component)
    case 'work':
      return renderExperience(component, data, state, 'work')
    case 'education':
      return renderExperience(component, data, state, 'education')
    default:
      return `<!-- unknown widget: bublr-${e(component.name)} -->`
  }
}

/**
 * The writer's HTML with widgets expanded and template tags filled in.
 * Widgets are swapped for placeholders first, so a post title that happens
 * to contain "{{" is never read as a tag.
 */
/** Setup a widget still needs (shown to the writer in the editor, never to visitors). */
export function componentProblem(c) {
  if (!COMPONENT_NAMES.includes(c.name)) return `<bublr-${c.name}> isn’t a Bublr widget`
  if (c.name === 'music' && !/^https?:\/\//i.test(safeUrl(c.attrs.src))) {
    return '<bublr-music> needs src="https://…" pointing at an .mp3'
  }
  if (c.name === 'friends' && !friendNamesFrom(c.attrs.users).length) {
    return '<bublr-friends> needs users="name1, name2" (Bublr usernames)'
  }
  return ''
}

// Swap each complete <script>…</script> for a placeholder, scanning forward
// only (a lazy regex would rescan to the end for every unclosed <script>).
function keepScripts(src, keep) {
  const OPEN = /<script(?![a-z0-9-])/gi
  const CLOSE = /<\/script/gi
  let out = ''
  let cursor = 0
  for (;;) {
    OPEN.lastIndex = cursor
    const open = OPEN.exec(src)
    if (!open) break
    CLOSE.lastIndex = open.index + 7
    const close = CLOSE.exec(src)
    if (!close) break
    const gt = src.indexOf('>', close.index)
    const end = gt === -1 ? src.length : gt + 1
    out += `${src.slice(cursor, open.index)}\u0000k${keep.length}\u0000`
    keep.push(src.slice(open.index, end))
    cursor = end
  }
  return out + src.slice(cursor)
}

export const NO_TAGS_FLAG = /<!--\s*bublr:no-tags\s*-->/i

export function renderProfileHtml(html, data) {
  const src = normalizeCode(html)
  const components = findComponents(src)
  const state = newState()
  const warnings = []
  const outputs = []
  const keep = []

  let withPlaceholders = ''
  let cursor = 0
  components.forEach((c, i) => {
    withPlaceholders += src.slice(cursor, c.start) + `\u0000${i}\u0000`
    cursor = c.end
  })
  withPlaceholders += src.slice(cursor)

  // Inline <script> blocks are code, not template: {{ }} in them (Vue,
  // petite-vue, a regex) is left alone.
  withPlaceholders = keepScripts(withPlaceholders, keep)

  let output = withPlaceholders
  if (!NO_TAGS_FLAG.test(src)) {
    const rendered = renderTemplate(withPlaceholders, data, { state })
    warnings.push(...rendered.warnings)
    output = rendered.output
  }

  components.forEach((c, i) => {
    const problem = componentProblem(c)
    if (problem) warnings.push(problem)
    outputs[i] = renderComponent(c, data, state)
  })
  if (state.exhausted) warnings.push('This page asks for too much repetition; the rest was cut off')

  output = output
    .replace(/\u0000k(\d+)\u0000/g, (_, i) => keep[Number(i)] ?? '')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => outputs[Number(i)] ?? '')
  return { output, warnings: [...new Set(warnings)] }
}

// ---------------------------------------------------------------------------
// The document

// Runs inside the sandboxed frame. Follows the visitor's theme, reports the
// page height (so a block on the classic profile can size itself) and
// exposes window.bublr.
const RUNTIME = `(function(){
var d=document.documentElement,P=window.parent;
function post(m){try{if(P&&P!==window)P.postMessage(m,'*')}catch(e){}}
function apply(t){if(t!=='dark'&&t!=='light')return;d.setAttribute('data-theme',t);d.style.colorScheme=t;if(window.bublr)window.bublr.theme=t;try{window.dispatchEvent(new CustomEvent('bublr:theme',{detail:t}))}catch(e){}}
try{apply(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){apply('light')}
var last=-1;
function height(){var b=document.body,h=d.getBoundingClientRect().height;if(b){var r=b.getBoundingClientRect(),s=getComputedStyle(b);h=Math.max(h,r.bottom+parseFloat(s.marginBottom||0)+(window.scrollY||0))}return Math.ceil(h)}
function report(force){var h=height();if(force||Math.abs(h-last)>1){last=h;post({type:'bublr:height',height:h})}}
window.addEventListener('message',function(e){if(e.source!==P)return;var m=e.data||{};if(m.type==='bublr:theme')apply(m.theme);else if(m.type==='bublr:hello'){report(true);post({type:'bublr:ready'})}});
function start(){report(true);post({type:'bublr:ready'});if(window.ResizeObserver){var ro=new ResizeObserver(function(){report()});ro.observe(d);if(document.body)ro.observe(document.body)}var n=0,t=setInterval(function(){report();if(++n>20)clearInterval(t)},500);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){report()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.addEventListener('load',function(){report()});
})();`

// Starting styles for the page and the widgets. :where() keeps their
// specificity at zero, so any rule the writer adds wins.
const BASE_CSS = `
:where(html){--bublr-bg:#fcfcfc;--bublr-surface:#ffffff;--bublr-text:rgb(33,37,41);--bublr-muted:rgba(33,37,41,.6);--bublr-border:rgb(222,223,223);--bublr-accent:#4D96FF;color:var(--bublr-text);font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.5;-webkit-text-size-adjust:100%}
:where(html[data-theme=dark]){--bublr-bg:#171717;--bublr-surface:#1f1f1f;--bublr-text:rgb(229,231,235);--bublr-muted:rgba(229,231,235,.6);--bublr-border:rgba(255,255,255,.15)}
:where(html.bublr-page) :where(body){background:var(--bublr-bg)}
:where(html.bublr-block),:where(html.bublr-block) :where(body){margin:0;background:transparent}
:where(a){color:inherit}
:where(img,video){max-width:100%}
:where(.bublr-empty){color:var(--bublr-muted)}
:where(.bublr-avatar){display:inline-block;object-fit:cover;border-radius:50%}
:where(.bublr-avatar--square){border-radius:0}
:where(.bublr-avatar--rounded){border-radius:14px}
:where(.bublr-banner){display:block;width:100%;max-height:260px;object-fit:cover;border-radius:12px}
:where(.bublr-name){font-weight:600}
:where(.bublr-username){color:var(--bublr-muted)}
:where(.bublr-bio){color:var(--bublr-muted)}
:where(.bublr-posts,.bublr-skills,.bublr-socials,.bublr-guestbook,.bublr-friends,.bublr-timeline){list-style:none;margin:0;padding:0}
:where(.bublr-posts){display:flex;flex-direction:column;gap:14px}
:where(.bublr-post__title){font-weight:500;text-decoration:none}
:where(.bublr-post__title)::before{content:'';display:inline-block;width:.55em;height:.55em;margin-right:.5em;border-radius:50%;background:var(--dot,var(--bublr-accent));vertical-align:.08em}
:where(.bublr-post__title:hover){text-decoration:underline}
:where(.bublr-post__date){color:var(--bublr-muted);font-size:.85em;margin-left:.35em}
:where(.bublr-post__excerpt){margin:.25em 0 0;color:var(--bublr-muted)}
:where(.bublr-posts--cards,.bublr-posts--grid){display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
:where(.bublr-posts--cards .bublr-post,.bublr-posts--grid .bublr-post){padding:14px;border:1px solid var(--bublr-border);border-radius:10px;background:var(--bublr-surface)}
:where(.bublr-posts--compact){gap:6px}
:where(.bublr-latest){display:block;padding:16px;border:1px solid var(--bublr-border);border-radius:10px;background:var(--bublr-surface)}
:where(.bublr-latest__label){display:block;font-size:.75em;text-transform:uppercase;letter-spacing:.08em;color:var(--bublr-muted)}
:where(.bublr-latest__title){display:block;margin-top:4px;font-size:1.15em;font-weight:600;text-decoration:none}
:where(.bublr-latest__excerpt){margin:.4em 0 0;color:var(--bublr-muted)}
:where(.bublr-skills){display:flex;flex-wrap:wrap;gap:6px 14px}
:where(.bublr-skill)::before{content:'';display:inline-block;width:.55em;height:.55em;margin-right:.4em;border-radius:50%;background:var(--dot,var(--bublr-accent))}
:where(.bublr-socials){display:flex;flex-wrap:wrap;gap:6px 14px}
:where(.bublr-social){color:var(--bublr-muted);text-decoration:none}
:where(.bublr-social:hover){color:var(--bublr-text);text-decoration:underline}
:where(.bublr-stats){display:flex;flex-wrap:wrap;gap:18px;margin:0}
:where(.bublr-stat){display:flex;flex-direction:column-reverse}
:where(.bublr-stat dt){color:var(--bublr-muted);font-size:.8em}
:where(.bublr-stat dd){margin:0;font-weight:600;font-size:1.2em}
:where(.bublr-counter){display:inline-flex;align-items:center;gap:2px;font-family:'Courier New',monospace}
:where(.bublr-counter__digit){display:inline-block;min-width:1.1em;padding:2px 3px;text-align:center;background:#111;color:#4ade80;border-radius:2px;font-weight:700;box-shadow:inset 0 -1px 0 rgba(255,255,255,.12)}
:where(.bublr-counter__label){margin-left:6px;color:var(--bublr-muted);font-family:inherit}
:where(.bublr-guestbook){display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
:where(.bublr-guestbook__entry){padding:12px;border:1px solid var(--bublr-border);border-radius:10px;background:var(--bublr-surface)}
:where(.bublr-guestbook__signature){display:block;width:100%;height:56px;color:var(--bublr-text)}
:where(.bublr-guestbook__name){display:block;font-weight:500}
:where(.bublr-guestbook__message){margin:.25em 0 0;color:var(--bublr-muted)}
:where(.bublr-guestbook__date){display:block;margin-top:4px;font-size:.8em;color:var(--bublr-muted)}
:where(.bublr-friends){display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
:where(.bublr-friend a){display:flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none;text-align:center}
:where(.bublr-friend__photo){display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;background:var(--bublr-border)}
:where(.bublr-friend__name){font-size:.85em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
:where(.bublr-friends__title){font-size:1em;margin:0 0 10px}
:where(.bublr-music){margin:0;padding:12px;border:1px solid var(--bublr-border);border-radius:10px;background:var(--bublr-surface)}
:where(.bublr-music__title){margin-bottom:8px;font-weight:500}
:where(.bublr-music__title)::before{content:'♪ ';color:var(--bublr-accent)}
:where(.bublr-music__player){display:block;width:100%}
:where(.bublr-timeline){display:flex;flex-direction:column;gap:14px}
:where(.bublr-timeline__title){font-weight:500}
:where(.bublr-timeline__org){color:var(--bublr-muted)}
:where(.bublr-timeline__meta){display:block;color:var(--bublr-muted);font-size:.85em}
:where(.bublr-timeline__description){margin:.3em 0 0;color:var(--bublr-muted)}
`
  .trim()
  .replace(/\n/g, '')

const FONT_LINKS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">'

// Keep the writer's CSS/JS inside its own element.
const inStyle = css => css.replace(/<\/(style)/gi, '<\\/$1')
const inScript = js => js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--')

/** Is this a whole HTML document (pasted from elsewhere) rather than a fragment? */
export function isFullDocument(html) {
  const s = String(html || '')
  let i = 0
  for (;;) {
    while (i < s.length && /\s/.test(s[i])) i++
    if (!s.startsWith('<!--', i)) break
    const end = s.indexOf('-->', i + 4)
    if (end === -1) return false
    i = end + 3
  }
  return /^(?:<!doctype\s|<html[\s>])/i.test(s.slice(i, i + 10))
}

/** The window.bublr object: the template data plus the theme. */
export function scriptData(data) {
  return { ...data, theme: 'light' }
}

/**
 * The complete document for the frame.
 *   code:  { html, css, js }
 *   data:  buildTemplateData(...)
 *   embed: 'page' (the whole profile) or 'block' (a section of the classic profile)
 */
export function buildProfileDocument({ code, data, embed = 'page' }) {
  const c = code || {}
  const html = renderProfileHtml(c.html, data)
  const css = renderTemplate(normalizeCode(c.css), data, { escape: escapeCss })
  const js = normalizeCode(c.js)
  const warnings = [...new Set([...html.warnings, ...css.warnings.map(w => `CSS: ${w}`)])]

  const embedClass = embed === 'block' ? 'bublr-block' : 'bublr-page'
  const title = `<title>${escapeHtml(data.displayName)} (@${escapeHtml(data.name)})</title>`
  const head =
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<base target="_top">' +
    FONT_LINKS +
    `<script>window.bublr=${safeJsonLd(scriptData(data))};</script>` +
    `<script>${RUNTIME}</script>` +
    `<style id="bublr-base">${BASE_CSS}</style>`
  const userStyle = css.output.trim() ? `<style id="bublr-css">${inStyle(css.output)}</style>` : ''
  const userScript = js.trim() ? `<script id="bublr-js">${inScript(js)}</script>` : ''

  let doc
  if (isFullDocument(html.output)) {
    doc = html.output
    // Our setup goes first in <head>, so the writer's own tags can override it
    const hasTitle = /<title[\s>]/i.test(doc)
    const headInsert = head + (hasTitle ? '' : title)
    const HEAD = /<head(?:\s[^>]*)?>/i
    const HTML = /<html(?:\s[^>]*)?>/i
    if (HEAD.test(doc)) doc = doc.replace(HEAD, m => m + headInsert)
    else if (HTML.test(doc)) doc = doc.replace(HTML, m => `${m}<head>${headInsert}</head>`)
    else doc = headInsert + doc
    doc = doc.replace(/<html((?:\s[^>]*)?)>/i, (m, attrs) => {
      if (/\bclass\s*=\s*"/i.test(attrs)) return m.replace(/\bclass\s*=\s*"/i, `class="${embedClass} `)
      return `<html class="${embedClass}"${attrs}>`
    })
    doc = /<\/head>/i.test(doc) ? doc.replace(/<\/head>/i, m => userStyle + m) : doc + userStyle
    let lastBody = -1
    const BODY_END = /<\/body>/gi
    for (let b = BODY_END.exec(doc); b; b = BODY_END.exec(doc)) lastBody = b.index
    doc = lastBody === -1 ? doc + userScript : doc.slice(0, lastBody) + userScript + doc.slice(lastBody)
  } else {
    doc =
      `<!doctype html><html lang="en" class="${embedClass}"><head>${head}${title}${userStyle}</head>` +
      `<body>${html.output}${userScript}</body></html>`
  }

  return { html: doc, warnings }
}

// ---------------------------------------------------------------------------
// The frame's response headers. Shared by the live frame and the preview
// shell, so the preview behaves exactly like the real page.

export const FRAME_SANDBOX =
  'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation'

export const FRAME_CSP = [
  `sandbox ${FRAME_SANDBOX}`,
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' https: blob:",
  "style-src 'unsafe-inline' https:",
  'img-src https: http: data: blob:',
  'font-src https: data:',
  'media-src https: http: data: blob:',
  'connect-src https:',
  'frame-src https:',
  'worker-src blob:',
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join('; ')

export function setFrameHeaders(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Content-Security-Policy', FRAME_CSP)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('X-Robots-Tag', 'noindex')
}

/** The frame URL a profile page embeds. `v` changes on every save, so caches never serve old code. */
export function frameUrl(username, { embed = 'page', version = 0 } = {}) {
  const e = embed === 'block' ? 'block' : 'page'
  return `/api/profile-frame/${encodeURIComponent(username)}?embed=${e}&v=${encodeURIComponent(version)}`
}

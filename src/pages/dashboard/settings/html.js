/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useTheme } from 'next-themes'

import { auth } from '../../../lib/firebase'
import { authedFetch } from '../../../lib/authed-fetch'
import {
  buildProfileDocument,
  byteLength,
  extractFriendNames,
  formatKb,
  normalizeFriends,
  PROFILE_CODE_LIMITS,
} from '../../../lib/profile-code'
import { PROFILE_CODE_TEMPLATES } from '../../../lib/profile-code-templates'

import DashboardLayout, { useSidebar } from '../../../components/dashboard/dashboard-layout'
import PageHeader from '../../../components/dashboard/page-header'
import DsButton from '../../../components/dashboard/ds-button'
import Spinner from '../../../components/spinner'
import LivePreview from '../../../components/profile-code/LivePreview'
import TagReference from '../../../components/profile-code/TagReference'
import TemplateGallery from '../../../components/profile-code/TemplateGallery'

const CodeEditor = dynamic(() => import('../../../components/profile-code/CodeEditor'), {
  ssr: false,
  loading: () => <div css={css`padding: 1rem; color: var(--grey-3); font-size: 0.8rem;`}>Loading editor…</div>,
})

const EMPTY = { html: '', css: '', js: '', mode: 'off', placement: 'bottom' }
const CODE_TABS = [
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'js', label: 'JavaScript' },
]
const TOOLS = [
  { id: 'insert', label: 'Insert', icon: '+', title: 'Tags and widgets for your name, posts, guest book and more' },
  { id: 'ai', label: 'AI', icon: '✦', title: 'Describe a change and the AI writes it' },
  { id: 'history', label: 'History', icon: '↺', title: 'Your last 20 saves' },
]
const MODES = [
  { id: 'off', label: 'Not shown', help: 'Your profile stays as it is. Only you can see this page, here.' },
  { id: 'block', label: 'Section', help: 'Shows as a box inside your normal profile.' },
  { id: 'page', label: 'Whole page', help: 'Replaces your profile. A small bar still links visitors to your normal one.' },
]
const AI_IDEAS = [
  'A 2006-style page with blue boxes, my Top 8 and a profile song',
  'A dark terminal that lists my posts like files',
  'Soft pastel zine with my posts as polaroids',
  'Make it work beautifully on phones',
]

const draftKey = uid => `bublr:profile-html-draft:${uid}`

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

const sameCode = (a, b) =>
  !!a && !!b && a.html === b.html && a.css === b.css && a.js === b.js && a.mode === b.mode && a.placement === b.placement

const codeOf = c => ({ html: c.html, css: c.css, js: c.js, mode: c.mode, placement: c.placement })

const hasAnyCode = c => !!c && !!((c.html || '').trim() || (c.css || '').trim() || (c.js || '').trim())

function timeAgo(iso) {
  if (!iso) return ''
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

async function readJson(res) {
  try {
    return await res.json()
  } catch (_) {
    return {}
  }
}

const errorText = (body, fallback) =>
  (body && body.error && (body.error.message || (typeof body.error === 'string' ? body.error : ''))) || fallback

// ---------------------------------------------------------------------------
// Styles

const shellStyle = css`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  height: calc(100vh - var(--page-header-height));
  height: calc(100dvh - var(--page-header-height));
  min-height: 560px;
  padding: 0.9rem 1.25rem 1.25rem;
  max-width: 1600px;
  margin: 0 auto;

  @media (max-width: 1000px) {
    height: auto;
    min-height: 0;
  }

  @media (max-width: 720px) {
    padding: 0.75rem 0.75rem 6rem;
  }
`

const startStyle = css`
  height: calc(100vh - var(--page-header-height));
  height: calc(100dvh - var(--page-header-height));
  overflow-y: auto;
  padding: 1.75rem 1.5rem 4rem;
  font-family: 'Inter', sans-serif;

  @media (max-width: 720px) {
    height: auto;
    padding: 1.25rem 1rem 6rem;
  }
`

const startInnerStyle = css`
  max-width: 1100px;
  margin: 0 auto;
`

const startHeadStyle = css`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;

  h2 {
    margin: 0 0 0.4rem;
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--grey-5);
  }

  p {
    margin: 0;
    max-width: 62ch;
    font-size: 0.85rem;
    line-height: 1.55;
    color: var(--grey-3);
  }
`

const aiRowStyle = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.25rem;
  padding: 0.6rem;
  border: 1px dashed var(--accent-border);
  border-radius: 10px;
  background: var(--accent-soft);

  label {
    padding: 0 0.35rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--accent-foreground);
    white-space: nowrap;
  }

  input {
    flex: 1;
    min-width: 12rem;
    font: inherit;
    font-size: 0.85rem;
    color: var(--grey-4);
    background: var(--grey-1);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 0.5rem 0.7rem;
    outline: none;

    &:focus {
      border-color: var(--accent-border);
      box-shadow: 0 0 0 3px var(--accent-soft-strong);
    }
  }
`

const modeRowStyle = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
  font-family: 'Inter', sans-serif;
  flex: none;
`

const modeLabelStyle = css`
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--grey-4);
`

const segmentedStyle = css`
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  background: var(--accent-bg-strong);
  border: 1px solid var(--border);
  border-radius: 8px;
`

const segmentStyle = css`
  padding: 0.3rem 0.7rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--grey-3);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 150ms ease, color 150ms ease;

  &:hover {
    color: var(--grey-4);
  }

  &[aria-pressed='true'] {
    background: var(--grey-1);
    color: var(--grey-5);
    border-color: var(--border);
    box-shadow: var(--chord-shadow-sm);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-soft-strong);
  }
`

const modeHelpStyle = css`
  flex-basis: 100%;
  font-size: 0.78rem;
  color: var(--grey-3);
  line-height: 1.4;
`

const workspaceStyle = css`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem;

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
  }
`

const paneStyle = css`
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--grey-1);
  overflow: hidden;

  @media (max-width: 1000px) {
    height: 72vh;
    min-height: 420px;
  }
`

const paneBarStyle = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 0.5rem;
  padding: 0.35rem;
  border-bottom: 1px dashed var(--border-dashed);
  font-family: 'Inter', sans-serif;
  flex: none;
`

const groupStyle = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
`

const tabStyle = css`
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.65rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--grey-3);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    color: var(--grey-4);
    background: var(--accent-bg-strong);
  }

  &[aria-selected='true'],
  &[aria-pressed='true'] {
    color: var(--accent-foreground);
    background: var(--accent-soft);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-soft-strong);
  }
`

const toolStyle = css`
  ${tabStyle};
  border: 1px solid var(--border);
  background: var(--grey-1);
  color: var(--grey-4);

  span[aria-hidden] {
    color: var(--accent-foreground);
  }
`

const nowrapStyle = css`
  display: inline-flex;
  align-items: center;
  gap: 2px;
`

const dividerStyle = css`
  flex: none;
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: var(--border);
`

const paneBodyStyle = css`
  position: relative;
  flex: 1;
  min-height: 0;
`

const panelStyle = css`
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: auto;
  padding: 1rem;
  background: var(--grey-1);
  font-family: 'Inter', sans-serif;
`

const panelHeadStyle = css`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;

  h3 {
    margin: 0 0 0.25rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--grey-4);
  }

  p {
    margin: 0;
    font-size: 0.78rem;
    line-height: 1.5;
    color: var(--grey-3);
  }
`

const footerStyle = css`
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 1rem;
  padding: 0.45rem 0.75rem;
  border-top: 1px dashed var(--border-dashed);
  font-family: 'Inter', sans-serif;
  font-size: 0.72rem;
  color: var(--grey-3);
`

const warningStyle = css`
  color: #b45309;

  [data-theme='dark'] & {
    color: #fbbf24;
  }
`

const toastStyle = css`
  position: fixed;
  left: 50%;
  bottom: 1.25rem;
  z-index: 50;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  width: max-content;
  max-width: min(640px, calc(100vw - 2rem));
  padding: 0.55rem 0.6rem 0.55rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--grey-1);
  box-shadow: var(--chord-shadow-md);
  font-family: 'Inter', sans-serif;
  font-size: 0.82rem;
  color: var(--grey-4);
`

const toastErrorStyle = css`
  border-color: rgba(229, 72, 77, 0.5);
  background-image: linear-gradient(rgba(229, 72, 77, 0.08), rgba(229, 72, 77, 0.08));
`

const toastSuccessStyle = css`
  border-color: rgba(34, 197, 94, 0.45);
`

const statusStyle = css`
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--grey-3);
  white-space: nowrap;

  @media (max-width: 640px) {
    display: none;
  }
`

const hideOnPhoneStyle = css`
  @media (max-width: 640px) {
    display: none;
  }
`

const smallSelectStyle = css`
  font: inherit;
  font-size: 0.78rem;
  color: var(--grey-4);
  background: var(--grey-1);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
`

const textareaStyle = css`
  display: block;
  width: 100%;
  min-height: 6.5rem;
  resize: vertical;
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--grey-4);
  background: var(--grey-1);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
  outline: none;

  &:focus {
    border-color: var(--accent-border);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
`

const chipStyle = css`
  padding: 0.3rem 0.6rem;
  border: 1px dashed var(--border-dashed);
  border-radius: 999px;
  background: transparent;
  color: var(--grey-3);
  font: inherit;
  font-size: 0.74rem;
  cursor: pointer;
  text-align: left;

  &:hover {
    color: var(--accent-foreground);
    border-color: var(--accent-border);
    background: var(--accent-soft);
  }
`

const historyRowStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-bottom: 1px dashed var(--border-dashed);
  font-size: 0.8rem;
  color: var(--grey-4);

  small {
    display: block;
    margin-top: 2px;
    font-size: 0.72rem;
    color: var(--grey-3);
  }
`

const emptyPreviewStyle = css`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  text-align: center;
  font-family: 'Inter', sans-serif;
  font-size: 0.82rem;
  color: var(--grey-3);
  background: var(--accent-bg);
`

const pillStyle = css`
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 500;
  color: var(--grey-3);
  border: 1px solid var(--border);
  white-space: nowrap;
`

const visuallyHidden = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`

// ---------------------------------------------------------------------------

function ProfileHtmlEditor() {
  const { toggle } = useSidebar()
  const [user] = useAuthState(auth)
  const { resolvedTheme } = useTheme()
  const uid = user?.uid

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saved, setSaved] = useState(null)
  const [draft, setDraft] = useState(EMPTY)
  const [data, setData] = useState(null)
  const [revisions, setRevisions] = useState([])

  const [view, setView] = useState('edit') // 'start' (templates) or 'edit'
  const [tab, setTab] = useState('html')
  const [panel, setPanel] = useState(null) // null, 'insert', 'ai' or 'history'
  const [device, setDevice] = useState('desktop')
  const [previewTheme, setPreviewTheme] = useState(null)
  const [runJs, setRunJs] = useState(true)
  const [reloadCount, setReloadCount] = useState(0)

  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null) // { text, tone, undo?, overwrite?, discardRestored?, view? }
  const [undoDraft, setUndoDraft] = useState(null)
  const [templateId, setTemplateId] = useState(null)

  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiSeconds, setAiSeconds] = useState(0)

  const views = useRef({})
  const focused = useRef({})
  const requestedFriends = useRef(new Set())
  const sourceRef = useRef('editor')
  const draftRef = useRef(draft)
  draftRef.current = draft

  const theme = previewTheme || (resolvedTheme === 'dark' ? 'dark' : 'light')
  const editorDark = resolvedTheme === 'dark'
  // Code changed outside this editor isn't shown until it's saved here again
  const needsResave = !!saved && saved.trusted === false && saved.mode !== 'off'
  const changed = !!saved && !sameCode(draft, saved)
  const dirty = changed || needsResave
  const hasCode = hasAnyCode(draft)

  // ---- load
  // Returns true once the saved code is in the editor
  const load = useCallback(async () => {
    if (!uid) return false
    setLoading(true)
    setLoadError('')
    try {
      const res = await authedFetch('/api/profile/code')
      const body = await readJson(res)
      if (!res.ok) throw new Error(errorText(body, 'Couldn’t load your Profile HTML'))
      const code = { ...EMPTY, ...body.code }
      setSaved(code)
      setData(body.data)
      setRevisions(body.revisions || [])
      setUndoDraft(null)
      sourceRef.current = 'editor'
      requestedFriends.current = new Set(Object.keys(body.data?.friends || {}))

      // Unsaved work kept in this browser: picked up where it left off, or
      // (if it was saved somewhere else since) offered back, never dropped
      let restored = null
      let stale = null
      try {
        const local = JSON.parse(window.localStorage.getItem(draftKey(uid)) || 'null')
        if (local && local.draft && !sameCode({ ...EMPTY, ...local.draft }, code)) {
          if (local.baseVersion === code.version) restored = local
          else stale = local
        }
      } catch (_) {
        // no saved draft
      }
      const untrusted = code.trusted === false && code.mode !== 'off'
      const untrustedText = 'Your saved code was changed outside this editor, so it isn’t on your profile. Check it, then save to show it again.'
      const before = untrusted ? `${untrustedText} ` : ''
      if (restored) {
        const next = { ...EMPTY, ...codeOf({ ...EMPTY, ...restored.draft }) }
        setDraft(next)
        setView(hasAnyCode(next) ? 'edit' : 'start')
        setNotice({
          text: `${before}You have unsaved changes from ${timeAgo(restored.at)}.`,
          tone: untrusted ? 'error' : 'info',
          discardRestored: true,
        })
      } else {
        setDraft(codeOf(code))
        setView(hasAnyCode(code) ? 'edit' : 'start')
        if (stale) {
          setNotice({
            text: `${before}You have unsaved changes from ${timeAgo(stale.at)}, older than your latest save (made somewhere else).`,
            tone: untrusted ? 'error' : 'info',
            restoreStale: { ...EMPTY, ...codeOf({ ...EMPTY, ...stale.draft }) },
          })
        } else {
          setNotice(untrusted ? { text: untrustedText, tone: 'error' } : null)
        }
      }
      return true
    } catch (error) {
      setLoadError(error.message)
      return false
    } finally {
      setLoading(false)
    }
  }, [uid])

  useEffect(() => {
    load()
  }, [load])

  // ---- keep unsaved work in this browser
  useEffect(() => {
    if (!uid || !saved) return
    const t = setTimeout(() => {
      try {
        if (sameCode(draft, saved)) window.localStorage.removeItem(draftKey(uid))
        else window.localStorage.setItem(draftKey(uid), JSON.stringify({ draft, baseVersion: saved.version, at: new Date().toISOString() }))
      } catch (_) {
        // storage full or blocked
      }
    }, 500)
    return () => clearTimeout(t)
  }, [draft, saved, uid])

  // Each screen starts at the top (on phones the whole page scrolls)
  useEffect(() => {
    try {
      window.scrollTo(0, 0)
    } catch (_) {
      // not in a browser
    }
  }, [view])

  // The toast lives on <body>: the dashboard's page transition wraps pages in
  // a transformed element, which would pin "fixed" to the page, not the screen
  const [portalReady, setPortalReady] = useState(false)
  useEffect(() => setPortalReady(true), [])

  // Success messages tidy themselves away
  useEffect(() => {
    if (!notice || notice.tone !== 'success') return
    const t = setTimeout(() => setNotice(n => (n === notice ? null : n)), 7000)
    return () => clearTimeout(t)
  }, [notice])

  // ---- friends for <bublr-friends> in the preview
  const friendNames = useMemo(() => extractFriendNames(draft.html).join(','), [draft.html])
  const debouncedFriends = useDebounced(friendNames, 700)
  useEffect(() => {
    if (!uid || !debouncedFriends) return
    const missing = debouncedFriends.split(',').filter(n => n && !requestedFriends.current.has(n))
    if (!missing.length) return
    missing.forEach(n => requestedFriends.current.add(n))
    authedFetch(`/api/profile/code?friends=${encodeURIComponent(missing.join(','))}`)
      .then(async res => {
        const body = await readJson(res)
        if (!res.ok) throw new Error('lookup failed')
        if (body && body.friends) {
          const found = normalizeFriends(body.friends)
          setData(prev => (prev ? { ...prev, friends: { ...prev.friends, ...found } } : prev))
        }
      })
      .catch(() => {
        // try these names again on the next change
        missing.forEach(n => requestedFriends.current.delete(n))
      })
  }, [debouncedFriends, uid])

  // ---- preview document
  const debouncedHtml = useDebounced(draft.html, 300)
  const debouncedCss = useDebounced(draft.css, 300)
  const debouncedJs = useDebounced(draft.js, 1000)
  const embed = draft.mode === 'block' ? 'block' : 'page'
  const built = useMemo(() => {
    if (!data) return null
    return buildProfileDocument({
      code: { html: debouncedHtml, css: debouncedCss, js: debouncedJs },
      data,
      embed,
      preview: true,
      scripts: runJs,
    })
  }, [data, debouncedHtml, debouncedCss, debouncedJs, runJs, embed])
  const previewDoc = built ? (reloadCount ? `${built.html}<!-- ${reloadCount} -->` : built.html) : null

  // Heights in vh follow the frame, and a section's frame follows its content
  const warnings = useMemo(() => {
    const list = [...(built?.warnings || [])]
    if (draft.mode === 'block' && /\d\s*[dsl]?vh\b/i.test(`${debouncedHtml}\n${debouncedCss}`)) {
      list.unshift('In a section, heights in vh (like 100vh) make it grow; use px')
    }
    return list
  }, [built, draft.mode, debouncedHtml, debouncedCss])

  const totalBytes = byteLength(draft.html) + byteLength(draft.css) + byteLength(draft.js)
  const overLimit = totalBytes > PROFILE_CODE_LIMITS.total

  // ---- editing
  const setField = useCallback((field, value) => setDraft(prev => ({ ...prev, [field]: value })), [])
  const onHtml = useCallback(v => setField('html', v), [setField])
  const onCss = useCallback(v => setField('css', v), [setField])
  const onJs = useCallback(v => setField('js', v), [setField])

  const replaceCode = (next, message, source) => {
    setUndoDraft(draftRef.current)
    sourceRef.current = source
    setDraft(prev => ({ ...prev, ...next }))
    setNotice({ text: message, tone: 'info', undo: true })
  }

  const undo = () => {
    if (!undoDraft) return
    setDraft(undoDraft)
    setUndoDraft(null)
    sourceRef.current = 'editor'
    setTemplateId(null)
    setView(hasAnyCode(undoDraft) ? 'edit' : 'start')
    setNotice({ text: 'Undone. Your code is back.', tone: 'success' })
  }

  const discardChanges = () => {
    if (!saved) return
    setUndoDraft(draftRef.current)
    setDraft(codeOf(saved))
    sourceRef.current = 'editor'
    setNotice({ text: 'Changes discarded. This is your saved version.', tone: 'info', undo: true })
    if (!hasAnyCode(saved)) setView('start')
  }

  const openTab = id => {
    setTab(id)
    setPanel(null)
  }

  const insertSnippet = snippet => {
    setPanel(null)
    setTab('html')
    const view = views.current.html
    if (view) {
      const doc = view.state.doc
      let from = view.state.selection.main.from
      let to = view.state.selection.main.to
      let insert = snippet
      // Never typed in yet: add to the end rather than the very top
      if (!focused.current.html) {
        from = to = doc.length
        const text = doc.toString()
        insert = `${text && !text.endsWith('\n') ? '\n' : ''}${snippet}\n`
      }
      const anchor = from + insert.length
      view.dispatch({ changes: { from, to, insert }, selection: { anchor } })
      // Scroll once the editor is showing again (the panel hid it)
      setTimeout(() => {
        view.focus()
        view.dispatch({ selection: { anchor }, scrollIntoView: true })
      }, 0)
    } else {
      setDraft(prev => ({ ...prev, html: `${prev.html}${prev.html.endsWith('\n') || !prev.html ? '' : '\n'}${snippet}\n` }))
    }
    setNotice({ text: 'Added to your HTML.', tone: 'success' })
  }

  // ---- save
  const save = useCallback(
    async ({ force = false } = {}) => {
      if (!saved || saving) return
      const current = draftRef.current
      if (!force && sameCode(current, saved) && !(saved.trusted === false && saved.mode !== 'off')) return
      setSaving(true)
      try {
        const res = await authedFetch('/api/profile/code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...codeOf(current), baseVersion: saved.version, force, source: sourceRef.current }),
        })
        const body = await readJson(res)
        if (res.status === 409) {
          setNotice({
            text: 'This was saved from another tab or device since you opened it.',
            tone: 'error',
            overwrite: true,
          })
          return
        }
        if (!res.ok) {
          setNotice({ text: errorText(body, 'Couldn’t save. Try again.'), tone: 'error' })
          return
        }
        setSaved({ ...codeOf(current), version: body.version, updatedAt: body.updatedAt, trusted: true })
        if (body.revisions) setRevisions(body.revisions)
        setUndoDraft(null)
        sourceRef.current = 'editor'
        setNotice({
          text:
            current.mode === 'off'
              ? 'Saved. It isn’t on your profile yet: choose Section or Whole page, then save again.'
              : current.mode === 'page'
                ? 'Saved. This page is now your profile.'
                : 'Saved. The section is live on your profile.',
          tone: 'success',
          view: current.mode !== 'off',
        })
      } catch (_) {
        setNotice({ text: 'Couldn’t reach Bublr. Your changes are kept in this browser.', tone: 'error' })
      } finally {
        setSaving(false)
      }
    },
    [saved, saving]
  )

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  // ---- templates, history, AI
  const applyTemplate = t => {
    replaceCode(
      { html: t.html, css: t.css, js: t.js, mode: t.mode },
      `“${t.name}” is in the editor. Change anything, then save to put it on your profile.`,
      'template'
    )
    setTemplateId(t.id)
    setPanel(null)
    setTab('html')
    setView('edit')
  }

  const loadRevision = async revision => {
    try {
      const res = await authedFetch(`/api/profile/code?revision=${encodeURIComponent(revision.id)}`)
      const body = await readJson(res)
      if (!res.ok) throw new Error(errorText(body, 'Couldn’t load that version'))
      const r = body.revision
      replaceCode(
        { html: r.html, css: r.css, js: r.js },
        `The version from ${timeAgo(r.savedAt)} is in the editor. Save to put it back on your profile.`,
        'restore'
      )
      setPanel(null)
      setTab('html')
    } catch (error) {
      setNotice({ text: error.message, tone: 'error' })
    }
  }

  useEffect(() => {
    if (!aiBusy) return undefined
    setAiSeconds(0)
    const t = setInterval(() => setAiSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [aiBusy])

  const askAi = async () => {
    const prompt = aiPrompt.trim()
    if (prompt.length < 3 || aiBusy) return
    setAiBusy(true)
    try {
      const current = draftRef.current
      const res = await authedFetch('/api/profile/code-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, html: current.html, css: current.css, js: current.js }),
      })
      const body = await readJson(res)
      if (!res.ok) throw new Error(errorText(body, 'The AI helper didn’t answer. Try again.'))
      const latest = draftRef.current
      const nextMode = latest.mode === 'off' ? 'page' : latest.mode
      replaceCode(
        { html: body.html, css: body.css, js: body.js, mode: nextMode },
        `${body.summary || 'Done.'} Check the preview, then save to keep it.`,
        'ai'
      )
      setTemplateId(null)
      setPanel(null)
      setTab('html')
      setView('edit')
    } catch (error) {
      setNotice({ text: error.message, tone: 'error' })
    } finally {
      setAiBusy(false)
    }
  }

  // After a save conflict: load the newer version, keeping yours one Undo away
  const loadTheirs = async () => {
    const mine = draftRef.current
    // If loading fails, your copy in this browser stays put
    if (!(await load())) return
    try {
      window.localStorage.removeItem(draftKey(uid))
    } catch (_) {
      // nothing stored
    }
    setUndoDraft(mine)
    setNotice({ text: 'Loaded the newer version. Undo brings yours back.', tone: 'info', undo: true })
  }

  const modeInfo = MODES.find(m => m.id === draft.mode) || MODES[0]

  // ---- render
  const actions = (
    <>
      <span css={statusStyle} aria-live="polite">
        {loading
          ? ''
          : saving
            ? 'Saving…'
            : changed
              ? 'Unsaved changes'
              : needsResave
                ? 'Not on your profile until you save'
                : saved?.updatedAt
                  ? `Saved ${timeAgo(saved.updatedAt)}`
                  : ''}
      </span>
      {changed && !saving && (
        <DsButton variant="ghost" size="sm" onClick={discardChanges} title="Go back to your saved version">
          Discard
        </DsButton>
      )}
      {data?.profileUrl && (
        <span css={hideOnPhoneStyle}>
          <DsButton variant="ghost" size="sm" href={data.profileUrl} target="_blank" rel="noreferrer">
            View profile ↗
          </DsButton>
        </span>
      )}
      <DsButton
        variant="accent"
        size="sm"
        onClick={() => save()}
        disabled={loading || saving || !dirty || overLimit}
        title={overLimit ? 'Your code is over the size limit' : 'Save (⌘S)'}
      >
        {saving ? 'Saving…' : 'Save'}
      </DsButton>
    </>
  )

  const toastBox = notice && (
    <div
      css={[toastStyle, notice.tone === 'error' && toastErrorStyle, notice.tone === 'success' && toastSuccessStyle]}
      role={notice.tone === 'error' ? 'alert' : 'status'}
    >
      <span css={css`flex: 1; min-width: 10rem;`}>{notice.text}</span>
      {notice.undo && undoDraft && (
        <DsButton size="sm" variant="outline" onClick={undo}>
          Undo
        </DsButton>
      )}
      {notice.overwrite && (
        <DsButton size="sm" variant="outline" onClick={loadTheirs}>
          Load theirs
        </DsButton>
      )}
      {notice.overwrite && (
        <DsButton size="sm" variant="destructive" onClick={() => save({ force: true })}>
          Keep mine
        </DsButton>
      )}
      {notice.discardRestored && (
        <DsButton
          size="sm"
          variant="outline"
          onClick={() => {
            setDraft(codeOf(saved))
            setNotice(null)
            if (!hasAnyCode(saved)) setView('start')
          }}
        >
          Throw them away
        </DsButton>
      )}
      {notice.restoreStale && (
        <DsButton
          size="sm"
          variant="outline"
          onClick={() => {
            replaceCode(notice.restoreStale, 'Your older unsaved changes are back. Saving puts them in place of your latest save.', 'editor')
            setView('edit')
          }}
        >
          Restore them
        </DsButton>
      )}
      {notice.view && data?.profileUrl && (
        <DsButton size="sm" variant="outline" href={data.profileUrl} target="_blank" rel="noreferrer">
          Open profile ↗
        </DsButton>
      )}
      <DsButton size="sm" variant="ghost" onClick={() => setNotice(null)} aria-label="Dismiss">
        ✕
      </DsButton>
    </div>
  )
  const toast = toastBox && portalReady ? createPortal(toastBox, document.body) : null

  if (loadError) {
    return (
      <>
        <PageHeader title="Profile HTML" onToggleSidebar={toggle} />
        <div css={startStyle} data-lenis-prevent>
          <div css={startInnerStyle}>
            <p css={css`font-family: 'Inter', sans-serif; font-size: 0.85rem; color: var(--grey-4);`}>{loadError}</p>
            <DsButton size="sm" variant="outline" onClick={load}>
              Try again
            </DsButton>
          </div>
        </div>
      </>
    )
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Profile HTML" onToggleSidebar={toggle} />
        <div css={css`display: flex; justify-content: center; padding: 5rem 0;`}>
          <Spinner />
        </div>
      </>
    )
  }

  if (view === 'start') {
    return (
      <>
        <PageHeader title="Profile HTML" onToggleSidebar={toggle} actions={actions} />
        <div css={startStyle} data-lenis-prevent>
          <div css={startInnerStyle}>
            <div css={startHeadStyle}>
              <div>
                <h2>{hasCode ? 'Start again from a template' : 'Make your profile your own'}</h2>
                <p>
                  Pick a look. It fills in with your own name, posts and guest book, and you can change every part of it in HTML,
                  CSS and JavaScript. Nothing changes on your profile until you save.
                </p>
              </div>
              {hasCode && (
                <DsButton variant="outline" size="sm" onClick={() => setView('edit')}>
                  ← Back to my code
                </DsButton>
              )}
            </div>

            <form
              css={aiRowStyle}
              onSubmit={e => {
                e.preventDefault()
                askAi()
              }}
            >
              <label htmlFor="ai-start">✦ Or describe it</label>
              <input
                id="ai-start"
                value={aiPrompt}
                maxLength={2000}
                placeholder="A cozy page that feels like a 90s bedroom wall"
                onChange={e => setAiPrompt(e.target.value)}
                disabled={aiBusy}
              />
              <DsButton type="submit" variant="accent" size="sm" disabled={aiBusy || aiPrompt.trim().length < 3}>
                {aiBusy ? `Writing… ${aiSeconds}s` : 'Write it for me'}
              </DsButton>
            </form>

            <TemplateGallery templates={PROFILE_CODE_TEMPLATES} data={data} theme={theme} onPick={applyTemplate} currentId={templateId} />
          </div>
        </div>
        {toast}
      </>
    )
  }

  const panelInfo =
    panel === 'insert'
      ? {
          title: 'Insert tags and widgets',
          hint: 'They fill in with your own details on your page. Insert adds one at your cursor in the HTML (or at the end).',
        }
      : panel === 'ai'
        ? {
            title: 'Describe a change',
            hint: 'Ask for a whole new page or a change to this one. The result goes into the editor; nothing goes live until you save, and Undo brings your code back.',
          }
        : panel === 'history'
          ? {
              title: 'History',
              hint: `Your last ${revisions.length || 20} saves. Load one into the editor, then save to put it back on your profile.`,
            }
          : null

  return (
    <>
      <PageHeader title="Profile HTML" onToggleSidebar={toggle} actions={actions} />
      <div css={shellStyle} data-lenis-prevent>
        <div css={modeRowStyle}>
          <span css={modeLabelStyle} id="mode-label">
            On your profile
          </span>
          <div css={segmentedStyle} role="group" aria-labelledby="mode-label" aria-describedby="mode-help">
            {MODES.map(m => (
              <button
                key={m.id}
                type="button"
                css={segmentStyle}
                aria-pressed={draft.mode === m.id}
                onClick={() => setField('mode', m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          {draft.mode === 'block' && (
            <label css={css`display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: var(--grey-3);`}>
              Where
              <select css={smallSelectStyle} value={draft.placement} onChange={e => setField('placement', e.target.value)}>
                <option value="top">Above your other sections</option>
                <option value="bottom">Below your other sections</option>
              </select>
            </label>
          )}
          <span css={modeHelpStyle} id="mode-help">
            {modeInfo.help}
            {saved && draft.mode !== saved.mode ? ' Takes effect when you save.' : ''}
          </span>
        </div>

        <div css={workspaceStyle}>
          {/* Code */}
          <section css={paneStyle} aria-label="Code">
            <div css={paneBarStyle}>
              <div css={groupStyle} role="tablist" aria-label="Code">
                {CODE_TABS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    css={tabStyle}
                    aria-selected={tab === t.id && !panel}
                    onClick={() => openTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div css={groupStyle}>
                <button type="button" css={toolStyle} onClick={() => setView('start')} title="Start from a template">
                  <span aria-hidden="true">▦</span> Templates
                </button>
                {TOOLS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    css={toolStyle}
                    aria-pressed={panel === t.id}
                    title={t.title}
                    onClick={() => setPanel(p => (p === t.id ? null : t.id))}
                  >
                    <span aria-hidden="true">{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div css={paneBodyStyle}>
              {CODE_TABS.map(t => (
                <div
                  key={t.id}
                  role="tabpanel"
                  aria-label={`${t.label} code`}
                  hidden={tab !== t.id || !!panel}
                  css={css`position: absolute; inset: 0; overflow: hidden;`}
                >
                  <CodeEditor
                    language={t.id}
                    label={`${t.label} code`}
                    value={draft[t.id]}
                    onChange={t.id === 'html' ? onHtml : t.id === 'css' ? onCss : onJs}
                    dark={editorDark}
                    placeholder={
                      t.id === 'html'
                        ? '<h1>{{displayName}}</h1>\n<bublr-posts></bublr-posts>'
                        : t.id === 'css'
                          ? 'body { background: hotpink; }'
                          : '// window.bublr has your posts, guest book and more'
                    }
                    onCreateEditor={editorView => {
                      views.current[t.id] = editorView
                      focused.current[t.id] = false
                      editorView.contentDOM.addEventListener('focus', () => {
                        focused.current[t.id] = true
                      })
                    }}
                  />
                </div>
              ))}

              {panelInfo && (
                <div css={panelStyle} role="region" aria-label={panelInfo.title}>
                  <div css={panelHeadStyle}>
                    <div>
                      <h3>{panelInfo.title}</h3>
                      <p>{panelInfo.hint}</p>
                    </div>
                    <DsButton size="sm" variant="outline" onClick={() => setPanel(null)}>
                      Back to code
                    </DsButton>
                  </div>

                  {panel === 'insert' && <TagReference onInsert={insertSnippet} data={data} />}

                  {panel === 'ai' && (
                    <div>
                      <label htmlFor="ai-prompt" css={visuallyHidden}>
                        What should change?
                      </label>
                      <textarea
                        id="ai-prompt"
                        css={textareaStyle}
                        value={aiPrompt}
                        maxLength={2000}
                        disabled={aiBusy}
                        placeholder={hasCode ? 'e.g. Make the background a starry night and add my Top 8' : 'e.g. A cozy page that feels like a 90s bedroom wall'}
                        onChange={e => setAiPrompt(e.target.value)}
                        onKeyDown={e => {
                          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') askAi()
                        }}
                      />
                      <div css={css`display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.6rem 0 0.9rem;`}>
                        {AI_IDEAS.map(idea => (
                          <button key={idea} type="button" css={chipStyle} onClick={() => setAiPrompt(idea)}>
                            {idea}
                          </button>
                        ))}
                      </div>
                      <DsButton variant="accent" onClick={askAi} disabled={aiBusy || aiPrompt.trim().length < 3}>
                        {aiBusy ? `Writing… ${aiSeconds}s` : hasCode ? 'Change my page' : 'Write my page'}
                      </DsButton>
                    </div>
                  )}

                  {panel === 'history' && (
                    <div>
                      {revisions.length === 0 && (
                        <p css={css`font-size: 0.8rem; color: var(--grey-3);`}>Nothing saved yet. Every save shows up here.</p>
                      )}
                      {revisions.map((r, i) => (
                        <div key={r.id} css={historyRowStyle}>
                          <span>
                            {timeAgo(r.savedAt)}
                            {i === 0 ? ' · latest save' : ''}
                            <small>
                              Version {r.version ?? '—'} · {formatKb(r.size || 0)}
                              {r.source && r.source !== 'editor'
                                ? ` · from ${r.source === 'ai' ? 'the AI' : r.source === 'restore' ? 'history' : 'a template'}`
                                : ''}
                            </small>
                          </span>
                          <DsButton size="sm" variant="outline" onClick={() => loadRevision(r)}>
                            Load
                          </DsButton>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div css={footerStyle}>
              <span
                css={overLimit ? warningStyle : undefined}
                title="Limit per part: HTML 120 KB, CSS 60 KB, JavaScript 60 KB"
              >
                {formatKb(totalBytes)} of {formatKb(PROFILE_CODE_LIMITS.total)}
                {overLimit ? ' · too big to save' : ''}
              </span>
              {warnings.length > 0 && (
                <span css={warningStyle} title={warnings.join('\n')}>
                  ⚠ {warnings[0]}
                  {warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''}
                </span>
              )}
              <span css={[css`margin-left: auto;`, hideOnPhoneStyle]}>⌘S saves</span>
            </div>
          </section>

          {/* Preview */}
          <section css={paneStyle} aria-label="Preview">
            <div css={paneBarStyle}>
              <span css={css`font-size: 0.78rem; font-weight: 500; color: var(--grey-4); padding: 0 0.4rem;`}>
                Preview
                {draft.mode === 'off' ? <span css={pillStyle}>not on your profile</span> : null}
                {draft.mode === 'block' ? <span css={pillStyle}>as a section</span> : null}
              </span>
              <span css={groupStyle}>
                <span css={nowrapStyle} role="group" aria-label="Screen size">
                  <button type="button" css={tabStyle} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>
                    Desktop
                  </button>
                  <button type="button" css={tabStyle} aria-pressed={device === 'phone'} onClick={() => setDevice('phone')}>
                    Phone
                  </button>
                </span>
                <span css={dividerStyle} aria-hidden="true" />
                <span css={nowrapStyle} role="group" aria-label="Theme">
                  <button type="button" css={tabStyle} aria-pressed={theme === 'light'} onClick={() => setPreviewTheme('light')}>
                    Light
                  </button>
                  <button type="button" css={tabStyle} aria-pressed={theme === 'dark'} onClick={() => setPreviewTheme('dark')}>
                    Dark
                  </button>
                </span>
                <span css={dividerStyle} aria-hidden="true" />
                <span css={nowrapStyle}>
                  <button
                    type="button"
                    css={tabStyle}
                    aria-pressed={runJs}
                    onClick={() => setRunJs(v => !v)}
                    title={runJs ? 'Pause JavaScript in the preview' : 'Run JavaScript in the preview'}
                  >
                    JS {runJs ? 'on' : 'off'}
                  </button>
                  <button
                    type="button"
                    css={tabStyle}
                    onClick={() => setReloadCount(n => n + 1)}
                    title="Reload the preview"
                    aria-label="Reload the preview"
                  >
                    ↻
                  </button>
                </span>
              </span>
            </div>
            <div css={paneBodyStyle}>
              {previewDoc && (
                <div css={css`position: absolute; inset: 0;`}>
                  <LivePreview
                    doc={previewDoc}
                    theme={theme}
                    embed={embed}
                    device={device}
                    label="Preview of your page"
                    onSave={() => save()}
                  />
                </div>
              )}
              {!hasCode && (
                <div css={emptyPreviewStyle}>
                  <span>Nothing to show yet. Write some HTML, or start from a template.</span>
                  <DsButton size="sm" variant="outline" onClick={() => setView('start')}>
                    Browse templates
                  </DsButton>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {toast}
    </>
  )
}

export default function SettingsProfileHtml() {
  return <ProfileHtmlEditor />
}

SettingsProfileHtml.getLayout = function SettingsProfileHtmlLayout(page) {
  return <DashboardLayout pageTitle="Profile HTML">{page}</DashboardLayout>
}

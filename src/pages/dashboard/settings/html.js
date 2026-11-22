/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useTheme } from 'next-themes'

import { auth } from '../../../lib/firebase'
import { authedFetch } from '../../../lib/authed-fetch'
import {
  buildProfileDocument,
  byteLength,
  extractFriendNames,
  formatKb,
  PROFILE_CODE_LIMITS,
} from '../../../lib/profile-code'
import { PROFILE_CODE_TEMPLATES } from '../../../lib/profile-code-templates'

import DashboardLayout, { useSidebar } from '../../../components/dashboard/dashboard-layout'
import PageHeader from '../../../components/dashboard/page-header'
import DsButton from '../../../components/dashboard/ds-button'
import Spinner from '../../../components/spinner'
import LivePreview from '../../../components/profile-code/LivePreview'
import TagReference from '../../../components/profile-code/TagReference'

const CodeEditor = dynamic(() => import('../../../components/profile-code/CodeEditor'), {
  ssr: false,
  loading: () => <div css={css`padding: 1rem; color: var(--grey-3); font-size: 0.8rem;`}>Loading editor…</div>,
})

const EMPTY = { html: '', css: '', js: '', mode: 'off', placement: 'bottom' }
const CODE_TABS = [
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'js', label: 'JS' },
]
const TOOL_TABS = [
  { id: 'templates', label: 'Templates' },
  { id: 'tags', label: 'Tags & widgets' },
  { id: 'ai', label: '✦ AI' },
  { id: 'history', label: 'History' },
]
const MODES = [
  { id: 'off', label: 'Off', hint: 'Saved, not shown' },
  { id: 'block', label: 'Section', hint: 'Inside your profile' },
  { id: 'page', label: 'Full page', hint: 'Replaces your profile' },
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
  padding: 1rem 1.25rem 1.5rem;
  max-width: 1500px;
  margin: 0 auto;

  @media (max-width: 720px) {
    padding: 0.75rem 0.75rem 2rem;
  }
`

const introStyle = css`
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  color: var(--grey-3);
  margin: 0 0 0.9rem;
  line-height: 1.5;
  max-width: 70ch;
`

const toolbarStyle = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
  margin-bottom: 0.9rem;
  font-family: 'Inter', sans-serif;
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
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 0.35rem 0.7rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--grey-3);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 150ms ease, color 150ms ease;

  small {
    font-size: 0.68rem;
    font-weight: 400;
    color: var(--grey-3);
  }

  &:hover {
    color: var(--grey-4);
  }

  &[aria-pressed='true'] {
    background: var(--grey-1);
    color: var(--grey-4);
    border-color: var(--border);
    box-shadow: var(--chord-shadow-sm);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-soft-strong);
  }
`

const labelStyle = css`
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--grey-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-right: 0.5rem;
`

const workspaceStyle = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem;
  height: calc(100vh - var(--page-header-height) - 12rem);
  min-height: 520px;

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
    height: auto;
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
    height: 70vh;
    min-height: 420px;
  }
`

const tabBarStyle = css`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0.35rem;
  border-bottom: 1px dashed var(--border-dashed);
  overflow-x: auto;
  font-family: 'Inter', sans-serif;
  flex: none;
`

const tabStyle = css`
  flex: none;
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

const tabDividerStyle = css`
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

const panelScrollStyle = css`
  position: absolute;
  inset: 0;
  overflow: auto;
  padding: 1rem;
  font-family: 'Inter', sans-serif;
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

const noticeStyle = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.9rem;
  margin-bottom: 0.9rem;
  padding: 0.6rem 0.85rem;
  border: 1px dashed var(--border-dashed);
  border-radius: 8px;
  background: var(--accent-bg);
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  color: var(--grey-4);
`

const errorNoticeStyle = css`
  border-color: rgba(229, 72, 77, 0.45);
  background: rgba(229, 72, 77, 0.06);
`

const statusStyle = css`
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--grey-3);
  white-space: nowrap;

  @media (max-width: 560px) {
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

const cardGridStyle = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 0.75rem;
`

const cardStyle = css`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.85rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--accent-bg);

  h3 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--grey-4);
  }

  p {
    margin: 0;
    flex: 1;
    font-size: 0.76rem;
    line-height: 1.45;
    color: var(--grey-3);
  }
`

const pillStyle = css`
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 500;
  color: var(--grey-3);
  border: 1px solid var(--border);
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

const panelTitleStyle = css`
  margin: 0 0 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--grey-4);
`

const panelHintStyle = css`
  margin: 0 0 1rem;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--grey-3);
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

  const [tab, setTab] = useState('html')
  const [device, setDevice] = useState('desktop')
  const [previewTheme, setPreviewTheme] = useState(null)
  const [runJs, setRunJs] = useState(true)

  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null) // { text, tone, undo?, action? }
  const [undoDraft, setUndoDraft] = useState(null)
  const [confirmTemplate, setConfirmTemplate] = useState(null)

  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiSeconds, setAiSeconds] = useState(0)

  const views = useRef({})
  const requestedFriends = useRef(new Set())
  const draftRef = useRef(draft)
  draftRef.current = draft

  const theme = previewTheme || (resolvedTheme === 'dark' ? 'dark' : 'light')
  const editorDark = resolvedTheme === 'dark'
  const dirty = !!saved && !sameCode(draft, saved)

  // ---- load
  const load = useCallback(async () => {
    if (!uid) return
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
      requestedFriends.current = new Set(Object.keys(body.data?.friends || {}))

      let restored = null
      try {
        const local = JSON.parse(window.localStorage.getItem(draftKey(uid)) || 'null')
        if (local && local.baseVersion === code.version && local.draft && !sameCode(local.draft, code)) restored = local
      } catch (_) {
        // no saved draft
      }
      if (restored) {
        setDraft({ ...EMPTY, ...restored.draft })
        setNotice({ text: `Restored unsaved changes from ${timeAgo(restored.at)}.`, tone: 'info', discard: true })
      } else {
        setDraft(code)
        if (!code.html.trim()) setTab('templates')
        if (code.trusted === false && code.mode !== 'off') {
          setNotice({
            text: 'This code was changed outside this editor, so it isn’t on your profile. Check it, then save to show it again.',
            tone: 'error',
          })
        }
      }
    } catch (error) {
      setLoadError(error.message)
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

  // ---- friends for <bublr-friends> in the preview
  const friendNames = useMemo(() => extractFriendNames(draft.html).join(','), [draft.html])
  const debouncedFriends = useDebounced(friendNames, 700)
  useEffect(() => {
    if (!uid || !debouncedFriends) return
    const missing = debouncedFriends.split(',').filter(n => n && !requestedFriends.current.has(n))
    if (!missing.length) return
    missing.forEach(n => requestedFriends.current.add(n))
    authedFetch(`/api/profile/code?friends=${encodeURIComponent(missing.join(','))}`)
      .then(readJson)
      .then(body => {
        if (body && body.friends) setData(prev => (prev ? { ...prev, friends: { ...prev.friends, ...body.friends } } : prev))
      })
      .catch(() => {})
  }, [debouncedFriends, uid])

  // ---- preview document
  const debouncedHtml = useDebounced(draft.html, 300)
  const debouncedCss = useDebounced(draft.css, 300)
  const debouncedJs = useDebounced(draft.js, 1000)
  const embed = draft.mode === 'block' ? 'block' : 'page'
  const built = useMemo(() => {
    if (!data) return null
    return buildProfileDocument({
      code: { html: debouncedHtml, css: debouncedCss, js: runJs ? debouncedJs : '' },
      data,
      embed,
    })
  }, [data, debouncedHtml, debouncedCss, debouncedJs, runJs, embed])

  const totalBytes = byteLength(draft.html) + byteLength(draft.css) + byteLength(draft.js)

  // ---- editing
  const setField = useCallback((field, value) => setDraft(prev => ({ ...prev, [field]: value })), [])
  const onHtml = useCallback(v => setField('html', v), [setField])
  const onCss = useCallback(v => setField('css', v), [setField])
  const onJs = useCallback(v => setField('js', v), [setField])

  const replaceCode = (next, message, source) => {
    setUndoDraft(draftRef.current)
    setDraft(prev => ({ ...prev, ...next }))
    setNotice({ text: message, tone: 'info', undo: true, source })
  }

  const undo = () => {
    if (!undoDraft) return
    setDraft(undoDraft)
    setUndoDraft(null)
    setNotice({ text: 'Undone.', tone: 'info' })
  }

  const insertSnippet = snippet => {
    setTab('html')
    const view = views.current.html
    if (view) {
      view.dispatch(view.state.replaceSelection(snippet))
      setTimeout(() => view.focus(), 0)
    } else {
      setDraft(prev => ({ ...prev, html: `${prev.html}${prev.html.endsWith('\n') || !prev.html ? '' : '\n'}${snippet}` }))
    }
  }

  // ---- save
  const save = useCallback(
    async ({ force = false } = {}) => {
      if (!saved || saving) return
      const current = draftRef.current
      setSaving(true)
      try {
        const res = await authedFetch('/api/profile/code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...current, baseVersion: saved.version, force, source: notice?.source }),
        })
        const body = await readJson(res)
        if (res.status === 409) {
          setNotice({ text: errorText(body, 'Saved somewhere else since you opened it.'), tone: 'error', overwrite: true })
          return
        }
        if (!res.ok) {
          setNotice({ text: errorText(body, 'Couldn’t save. Try again.'), tone: 'error' })
          return
        }
        setSaved({ ...current, version: body.version, updatedAt: body.updatedAt })
        if (body.revisions) setRevisions(body.revisions)
        setUndoDraft(null)
        setNotice({
          text:
            current.mode === 'off'
              ? 'Saved. It isn’t on your profile until you pick Section or Full page.'
              : current.mode === 'page'
                ? 'Saved and live: your page is now your profile.'
                : 'Saved and live on your profile.',
          tone: 'success',
          view: current.mode !== 'off',
        })
      } catch (_) {
        setNotice({ text: 'Couldn’t reach Bublr. Your changes are kept in this browser.', tone: 'error' })
      } finally {
        setSaving(false)
      }
    },
    [saved, saving, notice]
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
  const hasCode = !!(draft.html.trim() || draft.css.trim() || draft.js.trim())

  const applyTemplate = t => {
    if (hasCode && confirmTemplate !== t.id) {
      setConfirmTemplate(t.id)
      return
    }
    setConfirmTemplate(null)
    replaceCode(
      { html: t.html, css: t.css, js: t.js, mode: t.mode },
      `Loaded “${t.name}”. It’s only in the preview until you save.`,
      'template'
    )
    setTab('html')
  }

  const loadRevision = async revision => {
    try {
      const res = await authedFetch(`/api/profile/code?revision=${encodeURIComponent(revision.id)}`)
      const body = await readJson(res)
      if (!res.ok) throw new Error(errorText(body, 'Couldn’t load that version'))
      const r = body.revision
      replaceCode(
        { html: r.html, css: r.css, js: r.js },
        `Loaded the version from ${timeAgo(r.savedAt)}. Save to put it back on your profile.`,
        'restore'
      )
      setTab('html')
    } catch (error) {
      setNotice({ text: error.message, tone: 'error' })
    }
  }

  useEffect(() => {
    if (!aiBusy) return
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
      const nextMode = current.mode === 'off' ? 'page' : current.mode
      replaceCode(
        { html: body.html, css: body.css, js: body.js, mode: nextMode },
        `${body.summary || 'Done.'} Check the preview, then save to keep it.`,
        'ai'
      )
    } catch (error) {
      setNotice({ text: error.message, tone: 'error' })
    } finally {
      setAiBusy(false)
    }
  }

  // ---- render
  const actions = (
    <>
      <span css={statusStyle} aria-live="polite">
        {loading ? '' : saving ? 'Saving…' : dirty ? 'Unsaved changes' : saved?.updatedAt ? `Saved ${timeAgo(saved.updatedAt)}` : ''}
      </span>
      {data?.profileUrl && (
        <DsButton variant="ghost" size="sm" href={data.profileUrl} target="_blank" rel="noreferrer">
          View profile ↗
        </DsButton>
      )}
      <DsButton variant="accent" size="sm" onClick={() => save()} disabled={loading || saving || !dirty} title="Save (⌘S)">
        {saving ? 'Saving…' : 'Save'}
      </DsButton>
    </>
  )

  if (loadError) {
    return (
      <>
        <PageHeader title="Profile HTML" onToggleSidebar={toggle} />
        <div css={shellStyle}>
          <div css={[noticeStyle, errorNoticeStyle]}>
            {loadError}
            <DsButton size="sm" variant="outline" onClick={load}>
              Try again
            </DsButton>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Profile HTML" onToggleSidebar={toggle} actions={actions} />
      <div css={shellStyle}>
        <p css={introStyle}>
          Make your profile yours, MySpace-style: write HTML, CSS and JavaScript, use{' '}
          <code>{'{{tags}}'}</code> and <code>{'<bublr-*>'}</code> widgets that fill in your posts, guest book and Top 8, or let
          the AI draft it. Your code runs in a sealed-off frame, so it can never touch your visitors’ accounts.
        </p>

        <div css={toolbarStyle}>
          <div>
            <span css={labelStyle} id="mode-label">
              Show on profile
            </span>
            <div css={segmentedStyle} role="group" aria-labelledby="mode-label">
              {MODES.map(m => (
                <button
                  key={m.id}
                  type="button"
                  css={segmentStyle}
                  aria-pressed={draft.mode === m.id}
                  onClick={() => setField('mode', m.id)}
                >
                  {m.label}
                  <small>{m.hint}</small>
                </button>
              ))}
            </div>
          </div>
          {draft.mode === 'block' && (
            <label css={css`font-size: 0.8rem; color: var(--grey-4);`}>
              <span css={labelStyle}>Where</span>
              <select css={smallSelectStyle} value={draft.placement} onChange={e => setField('placement', e.target.value)}>
                <option value="top">Above your sections</option>
                <option value="bottom">Below your sections</option>
              </select>
            </label>
          )}
        </div>

        {notice && (
          <div css={[noticeStyle, notice.tone === 'error' && errorNoticeStyle]} role={notice.tone === 'error' ? 'alert' : 'status'}>
            <span css={css`flex: 1; min-width: 12rem;`}>{notice.text}</span>
            {notice.undo && undoDraft && (
              <DsButton size="sm" variant="outline" onClick={undo}>
                Undo
              </DsButton>
            )}
            {notice.overwrite && (
              <DsButton size="sm" variant="destructive" onClick={() => save({ force: true })}>
                Overwrite with mine
              </DsButton>
            )}
            {notice.overwrite && (
              <DsButton size="sm" variant="outline" onClick={load}>
                Load the newer one
              </DsButton>
            )}
            {notice.discard && (
              <DsButton
                size="sm"
                variant="outline"
                onClick={() => {
                  setDraft(saved)
                  setNotice(null)
                }}
              >
                Discard them
              </DsButton>
            )}
            {notice.view && data?.profileUrl && (
              <DsButton size="sm" variant="outline" href={data.profileUrl} target="_blank" rel="noreferrer">
                Open it ↗
              </DsButton>
            )}
            <DsButton size="sm" variant="ghost" onClick={() => setNotice(null)} aria-label="Dismiss">
              ✕
            </DsButton>
          </div>
        )}

        {loading ? (
          <div css={css`display: flex; justify-content: center; padding: 4rem 0;`}>
            <Spinner />
          </div>
        ) : (
          <div css={workspaceStyle}>
            {/* Editor */}
            <section css={paneStyle} aria-label="Code">
              <div css={tabBarStyle} role="tablist" aria-label="Editor">
                {CODE_TABS.map(t => (
                  <button key={t.id} type="button" role="tab" css={tabStyle} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                    {t.label}
                  </button>
                ))}
                <span css={tabDividerStyle} aria-hidden="true" />
                {TOOL_TABS.map(t => (
                  <button key={t.id} type="button" role="tab" css={tabStyle} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div css={paneBodyStyle}>
                {CODE_TABS.map(t => (
                  <div
                    key={t.id}
                    role="tabpanel"
                    hidden={tab !== t.id}
                    css={css`position: absolute; inset: 0; overflow: hidden;`}
                  >
                    <CodeEditor
                      language={t.id}
                      label={`${t.label} editor`}
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
                      onCreateEditor={view => {
                        views.current[t.id] = view
                      }}
                    />
                  </div>
                ))}

                {tab === 'templates' && (
                  <div css={panelScrollStyle} role="tabpanel">
                    <h3 css={panelTitleStyle}>Start from a template</h3>
                    <p css={panelHintStyle}>Each one fills in with your own name, posts and guest book. Change anything afterwards.</p>
                    <div css={cardGridStyle}>
                      {PROFILE_CODE_TEMPLATES.map(t => (
                        <div key={t.id} css={cardStyle}>
                          <h3>{t.name}</h3>
                          <p>{t.description}</p>
                          <div css={css`display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;`}>
                            <span css={pillStyle}>{t.mode === 'block' ? 'Section' : 'Full page'}</span>
                            <span css={css`display: flex; gap: 0.35rem;`}>
                              {confirmTemplate === t.id && (
                                <DsButton size="sm" variant="ghost" onClick={() => setConfirmTemplate(null)}>
                                  Cancel
                                </DsButton>
                              )}
                              <DsButton
                                size="sm"
                                variant={confirmTemplate === t.id ? 'destructive' : 'outline'}
                                onClick={() => applyTemplate(t)}
                              >
                                {confirmTemplate === t.id ? 'Replace my code' : 'Use'}
                              </DsButton>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tab === 'tags' && (
                  <div css={panelScrollStyle} role="tabpanel">
                    <TagReference onInsert={insertSnippet} data={data} />
                  </div>
                )}

                {tab === 'ai' && (
                  <div css={panelScrollStyle} role="tabpanel">
                    <h3 css={panelTitleStyle}>Describe it, and Bublr writes it</h3>
                    <p css={panelHintStyle}>
                      Ask for a whole page or a change to the one you have. The result lands in the preview; nothing goes live until you
                      save, and Undo brings your old code back.
                    </p>
                    <label htmlFor="ai-prompt" css={css`position: absolute; left: -9999px;`}>
                      What should your page look like?
                    </label>
                    <textarea
                      id="ai-prompt"
                      css={textareaStyle}
                      value={aiPrompt}
                      maxLength={2000}
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
                      {aiBusy ? `Writing your page… ${aiSeconds}s` : hasCode ? 'Change my page' : 'Write my page'}
                    </DsButton>
                  </div>
                )}

                {tab === 'history' && (
                  <div css={panelScrollStyle} role="tabpanel">
                    <h3 css={panelTitleStyle}>History</h3>
                    <p css={panelHintStyle}>Your last {revisions.length ? revisions.length : 20} saves. Load one to see it in the preview, then save to bring it back.</p>
                    {revisions.length === 0 && <p css={panelHintStyle}>Nothing saved yet.</p>}
                    {revisions.map((r, i) => (
                      <div key={r.id} css={historyRowStyle}>
                        <span>
                          Version {r.version ?? '—'}
                          {i === 0 && ' · current'}
                          <small>
                            {timeAgo(r.savedAt)} · {formatKb(r.size || 0)}
                            {r.source && r.source !== 'editor' ? ` · from ${r.source === 'ai' ? 'AI' : r.source}` : ''}
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

              <div css={footerStyle}>
                <span title="Limit per field: HTML 120 KB, CSS 60 KB, JS 60 KB">
                  {formatKb(totalBytes)} of {formatKb(PROFILE_CODE_LIMITS.total)}
                </span>
                {built?.warnings?.length > 0 && (
                  <span css={warningStyle} role="status">
                    ⚠ {built.warnings.slice(0, 2).join(' · ')}
                    {built.warnings.length > 2 ? ` (+${built.warnings.length - 2} more)` : ''}
                  </span>
                )}
                <span css={css`margin-left: auto;`}>⌘S to save</span>
              </div>
            </section>

            {/* Preview */}
            <section css={paneStyle} aria-label="Preview">
              <div css={tabBarStyle}>
                <span css={css`font-size: 0.78rem; font-weight: 500; color: var(--grey-4); padding: 0 0.4rem;`}>
                  Preview{draft.mode === 'off' ? ' · not on your profile' : ''}
                </span>
                <span css={css`margin-left: auto; display: flex; gap: 2px; align-items: center;`}>
                  <button type="button" css={tabStyle} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>
                    Desktop
                  </button>
                  <button type="button" css={tabStyle} aria-pressed={device === 'phone'} onClick={() => setDevice('phone')}>
                    Phone
                  </button>
                  <span css={tabDividerStyle} aria-hidden="true" />
                  <button
                    type="button"
                    css={tabStyle}
                    onClick={() => setPreviewTheme(theme === 'dark' ? 'light' : 'dark')}
                    title="Preview the other theme"
                  >
                    {theme === 'dark' ? 'Dark' : 'Light'}
                  </button>
                  <button
                    type="button"
                    css={tabStyle}
                    aria-pressed={runJs}
                    onClick={() => setRunJs(v => !v)}
                    title="Pause JavaScript in the preview"
                  >
                    JS {runJs ? 'on' : 'off'}
                  </button>
                </span>
              </div>
              <div css={paneBodyStyle}>
                {built && (
                  <div css={css`position: absolute; inset: 0;`}>
                    <LivePreview doc={built.html} theme={theme} embed={embed} device={device} label="Preview of your Profile HTML" />
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  )
}

export default function SettingsProfileHtml() {
  return <ProfileHtmlEditor />
}

SettingsProfileHtml.getLayout = function SettingsProfileHtmlLayout(page) {
  return <DashboardLayout pageTitle="Profile HTML">{page}</DashboardLayout>
}

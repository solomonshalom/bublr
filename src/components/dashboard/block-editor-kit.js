/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useDocumentData } from 'react-firebase-hooks/firestore'

import { auth, firestore } from '../../lib/firebase'
import { uploadToCloudinary } from '../../lib/utils'
import { LoadingContainer } from '../loading-container'
import DashboardLayout, { DashboardBody, useSidebar } from './dashboard-layout'
import PageHeader from './page-header'

/**
 * Shared pieces of the Gallery, Music and Shop settings pages.
 */

export function useCurrentUserDoc() {
  const [authUser, authLoading] = useAuthState(auth)
  const [userDoc, docLoading] = useDocumentData(authUser ? firestore.collection('users').doc(authUser.uid) : null, {
    idField: 'id',
  })
  return { authUser, user: userDoc || null, loading: authLoading || (authUser && docLoading && !userDoc) }
}

/**
 * Save `value` a moment after it stops changing. The first value (what was
 * loaded) is not saved back. Returns the status for <SaveIndicator>.
 */
export function useAutosave(value, save, { delay = 700, ready = true } = {}) {
  const [status, setStatus] = useState('saved')
  const first = useRef(true)
  const timer = useRef(null)
  const latest = useRef(value)
  latest.current = value
  const serialized = JSON.stringify(value)

  useEffect(() => {
    if (!ready) return undefined
    if (first.current) {
      first.current = false
      return undefined
    }
    setStatus('unsaved')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setStatus('saving')
      try {
        await save(latest.current)
        setStatus('saved')
      } catch (error) {
        console.error('Save failed:', error)
        setStatus('error')
      }
    }, delay)
    return () => clearTimeout(timer.current)
  }, [serialized, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  return status
}

export function SaveIndicator({ status }) {
  const label = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved changes', error: 'Couldn’t save. Retrying on your next change.' }[status] || ''
  return (
    <span
      aria-live="polite"
      css={css`
        font-size: 0.75rem;
        color: ${status === 'error' ? '#dc2626' : 'var(--grey-3)'};
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        &::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${status === 'saved' ? 'var(--green)' : status === 'error' ? '#dc2626' : 'var(--grey-2)'};
          transition: background 150ms ease;
        }
      `}
    >
      {label}
    </span>
  )
}

export function Segmented({ value, options, onChange, label }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      css={css`
        display: inline-flex;
        padding: 3px;
        gap: 2px;
        border-radius: 8px;
        background: var(--accent-bg-strong);
        border: 1px solid var(--border);
      `}
    >
      {options.map(option => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            css={css`
              border: 0;
              font: inherit;
              font-size: 0.8rem;
              padding: 0.35rem 0.75rem;
              border-radius: 6px;
              color: ${selected ? 'var(--grey-5)' : 'var(--grey-3)'};
              background: ${selected ? 'var(--grey-1)' : 'transparent'};
              box-shadow: ${selected ? 'var(--chord-shadow-sm)' : 'none'};
              font-weight: ${selected ? 500 : 400};
              transition: background 150ms ease, color 150ms ease, box-shadow 150ms ease;
              &:hover {
                color: var(--grey-5);
              }
            `}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function UploadButton({ accept = 'image/*', multiple = true, onUploaded, children, disabled, maxBytes = 25 * 1024 * 1024 }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const onChange = useCallback(
    async event => {
      const files = Array.from(event.target.files || [])
      event.target.value = ''
      if (!files.length) return
      setBusy(true)
      setError(null)
      const urls = []
      for (const file of files) {
        if (file.size > maxBytes) {
          setError(`${file.name} is larger than ${Math.round(maxBytes / 1024 / 1024)} MB`)
          continue
        }
        const url = await uploadToCloudinary(file)
        if (url) urls.push({ url, type: file.type.startsWith('video/') ? 'video' : 'image', name: file.name })
        else setError(`Couldn’t upload ${file.name}`)
      }
      setBusy(false)
      if (urls.length) onUploaded(urls)
    },
    [onUploaded, maxBytes]
  )

  return (
    <span css={css`display: inline-flex; flex-direction: column; gap: 0.35rem;`}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        css={css`
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          font: inherit;
          font-size: 0.8rem;
          padding: 0.45rem 0.8rem;
          border-radius: 6px;
          border: 1px dashed var(--border-dashed);
          background: var(--accent-bg);
          color: var(--grey-4);
          transition: border-color 150ms ease, background 150ms ease;
          &:hover:not(:disabled) {
            border-color: var(--accent-border);
            background: var(--accent-soft);
            color: var(--accent-foreground);
          }
          &:disabled {
            opacity: 0.6;
          }
        `}
      >
        {busy ? 'Uploading…' : children}
      </button>
      <input ref={input} type="file" accept={accept} multiple={multiple} onChange={onChange} hidden />
      {error ? <span css={css`font-size: 0.72rem; color: #dc2626;`}>{error}</span> : null}
    </span>
  )
}

export const iconButton = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--grey-1);
  color: var(--grey-3);
  font-size: 0.8rem;
  line-height: 1;
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
  &:hover:not(:disabled) {
    color: var(--grey-5);
    border-color: var(--grey-3);
  }
  &:disabled {
    opacity: 0.4;
  }
`

export const helpText = css`
  font-size: 0.78rem;
  color: var(--grey-3);
  line-height: 1.55;
  a {
    color: var(--accent-foreground);
  }
  code {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.72rem;
    background: var(--accent-bg-strong);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.05rem 0.3rem;
    word-break: break-all;
  }
`

export function CopyField({ value }) {
  const [copied, setCopied] = useState(false)
  return (
    <div css={css`display: flex; gap: 0.4rem; align-items: stretch;`}>
      <code
        css={css`
          flex: 1;
          min-width: 0;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 0.75rem;
          padding: 0.5rem 0.65rem;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--accent-bg);
          color: var(--grey-4);
          overflow-x: auto;
          white-space: nowrap;
        `}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } catch (_) {
            setCopied(false)
          }
        }}
        css={[iconButton, css`width: auto; height: auto; padding: 0 0.7rem; font-size: 0.75rem;`]}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

/** Page shell shared by the three settings pages. */
export function BlockSettingsPage({ title, children }) {
  const { toggle } = useSidebar()
  return (
    <>
      <PageHeader title={title} onToggleSidebar={toggle} />
      <DashboardBody>{children}</DashboardBody>
    </>
  )
}

export function withBlockLayout(Page, title) {
  Page.getLayout = function BlockLayout(page) {
    return <DashboardLayout pageTitle={title}>{page}</DashboardLayout>
  }
  return Page
}

export { LoadingContainer }

export const previewFrame = css`
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.5rem;
  background: var(--grey-1);
  font-family: Inter, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  p {
    margin: 0;
  }
`

export function moveItem(list, from, to) {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function shortId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

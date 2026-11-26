/** @jsxImportSource @emotion/react */
import { useState } from 'react'
import { css } from '@emotion/react'
import { DownloadIcon } from '@radix-ui/react-icons'

import { getUserByID } from '../../lib/db'
import { authedFetch } from '../../lib/authed-fetch'
import { htmlToMarkdown } from '../../lib/html-to-markdown'
import { buildExportFiles } from '../../lib/export-posts'
import { createZip } from '../../lib/zip'
import DsButton from './ds-button'

function htmlToPlainText(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html')
  return doc.body.textContent || ''
}

function download(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * "Download export" button: every post (drafts included) as Markdown plus a
 * JSON copy with the original HTML, zipped in the browser.
 */
export default function ExportWritingButton({ uid }) {
  const [status, setStatus] = useState('idle') // idle | working | done | error

  const handleExport = async () => {
    if (!uid || status === 'working') return
    setStatus('working')
    try {
      const user = await getUserByID(uid)
      // Paid posts: the document holds only the free preview; export all of it.
      const posts = await Promise.all(
        (user.posts || []).map(async post => {
          if (!post || post.access !== 'paid') return post
          const response = await authedFetch(`/api/posts/content?postId=${encodeURIComponent(post.id)}`)
          const data = await response.json().catch(() => ({}))
          if (!response.ok || typeof data.content !== 'string') throw new Error(data.error || 'A paid post could not be exported')
          return { ...post, content: data.content }
        })
      )
      const { folder, files } = buildExportFiles({
        user,
        posts,
        toMarkdown: htmlToMarkdown,
        toText: htmlToPlainText,
      })
      download(createZip(files), `${folder}.zip`)
      setStatus('done')
    } catch (err) {
      console.error('Export failed:', err)
      setStatus('error')
    }
  }

  const label = {
    idle: 'Download export',
    working: 'Preparing…',
    done: 'Downloaded',
    error: 'Try again',
  }[status]

  return (
    <div css={css`display: flex; flex-direction: column; align-items: flex-end; gap: 0.35rem;`}>
      <DsButton
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={!uid || status === 'working'}
        aria-live="polite"
      >
        <DownloadIcon width={13} height={13} />
        {label}
      </DsButton>
      {status === 'error' && (
        <span css={css`font-family: 'Inter', sans-serif; font-size: 0.72rem; color: var(--grey-3);`}>
          Couldn&apos;t build the export.
        </span>
      )}
    </div>
  )
}

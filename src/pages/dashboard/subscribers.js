/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useDocumentData } from 'react-firebase-hooks/firestore'

import { firestore, auth } from '../../lib/firebase'
import { LoadingContainer } from '../../components/loading-container'

import DashboardLayout, {
  DashboardBody,
  useSidebar,
} from '../../components/dashboard/dashboard-layout'
import PageHeader from '../../components/dashboard/page-header'

const summaryStyle = css`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0.25rem 0 1.5rem 0;
  color: var(--grey-3);
  font-size: 0.85rem;
`

const countStyle = css`
  color: var(--grey-4);
  font-size: 0.95rem;
`

const exportButtonStyle = css`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  color: var(--grey-4);
  background: var(--grey-1);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.4rem 0.65rem;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;

  &:hover {
    background: var(--accent-bg);
    border-color: var(--grey-3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const emptyStateStyle = css`
  border: 1px dashed var(--border-dashed);
  border-radius: 6px;
  padding: 2.5rem 1.5rem;
  text-align: center;
  color: var(--grey-3);
  font-size: 0.9rem;
  background: var(--accent-bg);
`

const tableStyle = css`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
`

const thStyle = css`
  text-align: left;
  font-weight: 500;
  font-size: 0.75rem;
  color: var(--grey-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.6rem 0;
  border-bottom: 1px dashed var(--border-dashed);
`

const tdStyle = css`
  padding: 0.8rem 0;
  border-bottom: 1px dashed var(--border-dashed);
  color: var(--grey-4);
  vertical-align: top;
`

const tdMutedStyle = css`
  ${tdStyle};
  color: var(--grey-3);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
`

const DownloadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const toDateString = ts => {
  if (!ts) return ''
  try {
    if (typeof ts.toDate === 'function') return ts.toDate().toISOString()
    if (typeof ts === 'string') return new Date(ts).toISOString()
    if (typeof ts === 'number') return new Date(ts).toISOString()
  } catch (e) {
    return ''
  }
  return ''
}

const formatDate = ts => {
  const iso = toDateString(ts)
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function downloadCSV(subscribers) {
  const header = 'email,subscribedAt\n'
  const rows = subscribers
    .map(s => {
      const email = (s.email || '').replace(/"/g, '""')
      const date = toDateString(s.subscribedAt)
      return `"${email}","${date}"`
    })
    .join('\n')
  const csv = header + rows
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `bublr-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function SubscribersContent() {
  const { toggle } = useSidebar()
  const [user] = useAuthState(auth)
  const [userDoc, userLoading] = useDocumentData(
    user ? firestore.collection('users').doc(user.uid) : null
  )

  const subscribers = userDoc?.subscribers || []
  const count = subscribers.length

  const handleExport = () => {
    if (count === 0) return
    downloadCSV(subscribers)
  }

  return (
    <>
      <PageHeader
        title="Subscribers"
        onToggleSidebar={toggle}
        actions={
          <button
            type="button"
            css={exportButtonStyle}
            onClick={handleExport}
            disabled={count === 0}
            aria-label="Export subscribers as CSV"
          >
            <DownloadIcon />
            Export CSV
          </button>
        }
      />
      <DashboardBody>
        <LoadingContainer isLoading={!user || userLoading}>
          <div css={summaryStyle}>
            <span css={countStyle}>
              {count} {count === 1 ? 'subscriber' : 'subscribers'}
            </span>
            <span>People receiving your newsletter.</span>
          </div>

          {count === 0 ? (
            <div css={emptyStateStyle}>
              No subscribers yet. Share your profile to start growing your list.
            </div>
          ) : (
            <table css={tableStyle}>
              <thead>
                <tr>
                  <th css={thStyle}>Email</th>
                  <th css={thStyle}>Subscribed</th>
                </tr>
              </thead>
              <tbody>
                {subscribers
                  .slice()
                  .sort((a, b) => {
                    const ad = toDateString(a.subscribedAt)
                    const bd = toDateString(b.subscribedAt)
                    return bd.localeCompare(ad)
                  })
                  .map((sub, idx) => (
                    <tr key={`${sub.email || idx}-${idx}`}>
                      <td css={tdStyle}>{sub.email || '—'}</td>
                      <td css={tdMutedStyle}>{formatDate(sub.subscribedAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </LoadingContainer>
      </DashboardBody>
    </>
  )
}

export default function Subscribers() {
  return <SubscribersContent />
}

Subscribers.getLayout = function SubscribersPageLayout(page) {
  return <DashboardLayout pageTitle="Subscribers">{page}</DashboardLayout>
}

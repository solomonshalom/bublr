/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useDocumentData } from 'react-firebase-hooks/firestore'

import { firestore } from '../../lib/firebase'

const wrapStyle = css`
  font-size: 0.825rem;
  color: var(--grey-3);
  line-height: 1.55;
  padding: 0.5rem 0.6rem 0.85rem 0.6rem;
`

const nameStyle = css`
  color: var(--grey-4);
  margin-bottom: 0.25rem;
  font-weight: 500;
  font-size: 0.875rem;
`

const proBadgeStyle = css`
  display: inline-block;
  margin-left: 0.3rem;
  font-size: 0.7rem;
  color: var(--accent-foreground);
`

const linkStyle = css`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.2rem;
  color: var(--accent-foreground);
  text-decoration: none;
  font-size: 0.8rem;

  &:hover {
    text-decoration: underline;
  }
`

export default function WelcomeUser({ uid, email }) {
  const [user] = useDocumentData(
    uid ? firestore.collection('users').doc(uid) : null
  )

  if (!uid) return null

  const fullName = user?.displayName || 'there'
  const firstName = fullName.trim().split(/\s+/)[0]
  const username = user?.name || ''
  const isPro = !!user?.hasCustomDomainAccess

  return (
    <div css={wrapStyle}>
      <p css={nameStyle}>
        Welcome back, {firstName}
        {isPro && <span css={proBadgeStyle} aria-label="Pro">*</span>}
      </p>
      {email && <p>email: {email}</p>}
      {username && (
        <a
          href={`/${username}`}
          css={linkStyle}
          target="_blank"
          rel="noopener noreferrer"
        >
          View your portfolio
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M3.5 3a.5.5 0 0 0 0 1h6.793L3.146 11.146a.5.5 0 1 0 .708.708L11 4.707V11.5a.5.5 0 0 0 1 0v-8a.5.5 0 0 0-.5-.5h-8z" fill="currentColor"/>
          </svg>
        </a>
      )}
    </div>
  )
}

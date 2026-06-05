/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import { css } from '@emotion/react'
import { useDocumentData } from 'react-firebase-hooks/firestore'

import { firestore } from '../../lib/firebase'
import { hasActiveAccess } from '../../lib/subscription'

const cardStyle = css`
  background: var(--grey-1);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.65rem 0.75rem;
  font-size: 0.75rem;
  color: var(--grey-3);
  line-height: 1.4;
`

const titleStyle = css`
  font-weight: 500;
  color: var(--grey-4);
  margin-bottom: 0.25rem;
`

const descStyle = css`
  margin-bottom: 0.5rem;
`

const featureListStyle = css`
  list-style: none;
  margin: 0 0 0.65rem 0;
  padding: 0;

  li {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0.2rem 0;
  }

  svg {
    flex-shrink: 0;
    color: var(--grey-3);
  }
`

const buttonStyle = css`
  display: block;
  width: 100%;
  text-align: center;
  padding: 0.4rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--grey-1);
  background: var(--grey-5);
  border: 1px solid var(--grey-5);
  border-radius: 4px;
  text-decoration: none;
  transition: background 150ms ease;

  &:hover {
    background: var(--grey-4);
    border-color: var(--grey-4);
  }
`

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export default function UpgradeCard({ uid }) {
  const [user] = useDocumentData(
    uid ? firestore.collection('users').doc(uid) : null
  )

  if (!uid || !user) return null
  if (hasActiveAccess(user)) return null

  return (
    <div css={cardStyle}>
      <p css={titleStyle}>Upgrade to Custom Domain</p>
      <p css={descStyle}>
        Bring your own domain and personalize your footer.
      </p>
      <ul css={featureListStyle}>
        <li><CheckIcon /> Custom Domain</li>
        <li><CheckIcon /> Personalized Footer</li>
        <li><CheckIcon /> Priority Support</li>
      </ul>
      <Link href="/dashboard/settings#custom-domain">
        <a css={buttonStyle}>Upgrade — $2/mo</a>
      </Link>
    </div>
  )
}

/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import { useRouter } from 'next/router'
import { css } from '@emotion/react'
import { useDocumentData } from 'react-firebase-hooks/firestore'

import { firestore } from '../../lib/firebase'
import { describeSubscription } from '../../lib/subscription'
import { PRO_PLAN } from '../../lib/pricing'
import { proSurface, proButton, DomainAddress, SparkleIcon } from '../pro/pro-look'

const DOMAIN_PAGE = '/dashboard/settings/domain'

const cardStyle = css`
  border-radius: 10px;
  padding: 0.85rem 0.85rem 0.9rem;
  font-family: 'Inter', sans-serif;
  box-shadow: 0 10px 24px -14px rgba(140, 45, 0, 0.75);
`

const eyebrowStyle = css`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.9;
  margin-bottom: 0.4rem;
`

const titleStyle = css`
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.25;
  margin: 0 0 0.55rem 0;
  color: #fff;
`

const priceRowStyle = css`
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  margin: 0.65rem 0 0.7rem;
  font-size: 0.72rem;
  opacity: 0.92;

  strong {
    font-size: 1.05rem;
    font-weight: 700;
    opacity: 1;
  }
`

const warningStyle = css`
  border-radius: 10px;
  padding: 0.75rem 0.8rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  line-height: 1.45;
  color: #9a3412;
  background: #fff7ed;
  border: 1px solid #fdba74;

  [data-theme='dark'] & {
    color: #fdba74;
    background: rgba(234, 88, 12, 0.12);
    border-color: rgba(253, 186, 116, 0.35);
  }

  a {
    display: inline-block;
    margin-top: 0.35rem;
    font-weight: 600;
    color: inherit;
  }
`

export default function UpgradeCard({ uid }) {
  const router = useRouter()
  const [user] = useDocumentData(uid ? firestore.collection('users').doc(uid) : null)

  if (!uid || !user) return null
  // The domain page has the full pitch; don't repeat it in the sidebar there
  if (router.pathname === DOMAIN_PAGE) return null
  return <UpgradeCardView user={user} />
}

export function UpgradeCardView({ user }) {
  const { hasAccess, state } = describeSubscription(user)

  if (state === 'past_due') {
    return (
      <div css={warningStyle} role="status">
        <strong>Payment didn’t go through.</strong> Update your card to keep your domain online.
        <br />
        <Link href={DOMAIN_PAGE} passHref>
          <a>Fix billing →</a>
        </Link>
      </div>
    )
  }

  if (hasAccess) return null

  return (
    <div css={[proSurface, cardStyle]}>
      <p css={eyebrowStyle}>
        <SparkleIcon size={10} /> {PRO_PLAN.name}
      </p>
      <p css={titleStyle}>Your writing, on your own domain</p>
      <DomainAddress username={user.name} compact />
      <p css={priceRowStyle}>
        <strong>{PRO_PLAN.price}</strong>/month · cancel anytime
      </p>
      <Link href={DOMAIN_PAGE} passHref>
        <a css={[proButton, css`width: 100%; padding: 0.5rem 0.75rem; font-size: 0.8rem;`]}>
          Get your domain →
        </a>
      </Link>
    </div>
  )
}

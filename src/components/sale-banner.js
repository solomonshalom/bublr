/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import { css } from '@emotion/react'
import { useEffect, useState } from 'react'

// Hosts that belong to us. Writer-owned custom domains never show the banner —
// the sale is Bublr's news, not theirs. Pages rendered with getServerSideProps
// are filtered in _app.js; statically generated post pages can't know the host
// at build time, so they fall back to this check after hydration.
const MAIN_HOSTS = ['bublr.life', 'www.bublr.life', 'localhost']

const bannerStyle = css`
  position: sticky;
  top: 0;
  z-index: 50;
  background: #15803d;
  transition: background 200ms ease;

  &:hover {
    background: #166534;
  }

  a {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 0.6rem 1rem;
    font-family: 'Inter', sans-serif;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.4;
    color: #ffffff;
    text-align: center;
    text-decoration: none;
  }

  @media (max-width: 420px) {
    a {
      gap: 0.4rem;
      padding: 0.55rem 0.75rem;
      font-size: 0.8125rem;
    }
  }
`

const detailStyle = css`
  opacity: 0.85;
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;
`

export default function SaleBanner() {
  const [onCustomDomain, setOnCustomDomain] = useState(false)

  useEffect(() => {
    const host = window.location.hostname
    const isOurs = MAIN_HOSTS.includes(host) || host.endsWith('.vercel.app')
    setOnCustomDomain(!isOurs)
  }, [])

  if (onCustomDomain) return null

  return (
    <div css={bannerStyle}>
      <Link href="/for-sale">
        <a aria-label="We're up for sale — read the details">
          <span>We&apos;re up for sale 👀</span>
          <span css={detailStyle}>Read the details</span>
        </a>
      </Link>
    </div>
  )
}

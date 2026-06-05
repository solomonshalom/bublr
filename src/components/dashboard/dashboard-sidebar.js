/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import { css } from '@emotion/react'

import { auth } from '../../lib/firebase'

import WelcomeUser from './welcome-user'
import SidebarNav from './sidebar-nav'
import UpgradeCard from './upgrade-card'
import Kbd from './kbd'

const sidebarStyle = css`
  display: flex;
  flex-direction: column;
  width: var(--sidebar-width);
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  background: var(--sidebar-bg);
  border-right: 1px dashed var(--border-dashed);
  font-family: 'Inter', sans-serif;
  transition: transform 200ms ease;
  z-index: 30;

  @media (max-width: 720px) {
    transform: translateX(-100%);

    &[data-mobile-open='true'] {
      transform: translateX(0);
      box-shadow: 0 0 30px rgba(0, 0, 0, 0.1);
    }
  }
`

const closedStyle = css`
  transform: translateX(-100%);
`

const headerStyle = css`
  display: flex;
  align-items: center;
  height: var(--page-header-height);
  padding: 0 0.85rem;
  border-bottom: 1px dashed var(--border-dashed);
  background: var(--muted);
`

const logoStyle = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  text-decoration: none;
  border-radius: 6px;
  transition: transform 150ms ease, box-shadow 150ms ease;

  &:hover {
    transform: scale(1.05);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
`

const contentStyle = css`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1rem 0.6rem;
  overflow-y: auto;
  min-height: 0;
`

const topGroupStyle = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const bottomGroupStyle = css`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`

const hintRowStyle = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.6rem;
  align-items: center;
  padding: 0 0.6rem;
  font-size: 0.75rem;
  color: var(--grey-3);
`

const hintItemStyle = css`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
`

const footerStyle = css`
  padding: 0.65rem 0.6rem;
  border-top: 1px dashed var(--border-dashed);
  background: var(--muted);
`

const signOutButtonStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6rem 0.85rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
  color: var(--grey-4);
  background: var(--grey-1);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;

  &:hover {
    background: var(--accent-soft);
    color: var(--accent-foreground);
    border-color: var(--accent-border);
  }
`

const backdropStyle = css`
  display: none;

  @media (max-width: 720px) {
    &[data-mobile-open='true'] {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 25;
    }
  }
`

const SignOutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const BentoLogo = () => (
  <img src="/images/logo-bento-emoji.png" alt="Bublr" />
)

export default function DashboardSidebar({ open, mobileOpen, onCloseMobile, uid, email }) {
  return (
    <>
      <div
        css={backdropStyle}
        data-mobile-open={mobileOpen ? 'true' : 'false'}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside
        css={[sidebarStyle, !open && closedStyle]}
        data-mobile-open={mobileOpen ? 'true' : 'false'}
        aria-label="Dashboard navigation"
      >
        <div css={headerStyle}>
          <Link href="/dashboard">
            <a css={logoStyle} aria-label="Bublr">
              <BentoLogo />
            </a>
          </Link>
        </div>

        <div css={contentStyle}>
          <div css={topGroupStyle}>
            <WelcomeUser uid={uid} email={email} />
            <SidebarNav />
          </div>

          <div css={bottomGroupStyle}>
            <UpgradeCard uid={uid} />
            <div css={hintRowStyle}>
              <span css={hintItemStyle}><Kbd>⌘B</Kbd> sidebar</span>
              <span css={hintItemStyle}><Kbd>C</Kbd> new post</span>
            </div>
          </div>
        </div>

        <div css={footerStyle}>
          <button
            type="button"
            css={signOutButtonStyle}
            onClick={() => auth.signOut()}
            aria-label="Sign out"
          >
            <SignOutIcon />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}

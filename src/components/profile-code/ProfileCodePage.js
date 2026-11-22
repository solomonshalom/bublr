/** @jsxImportSource @emotion/react */
import { css, Global } from '@emotion/react'
import { useEffect, useState } from 'react'
import ProfileCodeFrame from './ProfileCodeFrame'
import { frameUrl } from '../../lib/profile-code'

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

const frameStyle = css`
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  z-index: 1;
`

const barStyle = css`
  position: fixed;
  right: 14px;
  bottom: 14px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 2px;
  max-width: calc(100vw - 28px);
  padding: 4px;
  font-family: 'Inter', sans-serif;
  font-size: 12.5px;
  line-height: 1;
  color: var(--grey-4);
  background: var(--grey-1);
  border: 1px solid var(--border);
  border-radius: 999px;
  box-shadow: var(--chord-shadow-md);

  a,
  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
    transition: background 150ms ease;

    &:hover {
      background: var(--accent-bg-strong);
    }

    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--accent-soft-strong);
    }
  }

  img {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    object-fit: cover;
  }
`

const dividerStyle = css`
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 2px;
`

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)

const CollapseIcon = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {open ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
  </svg>
)

const BAR_KEY = 'bublr:profile-bar-collapsed'

/**
 * A profile whose writer chose "Full page" Profile HTML: their page fills the
 * window, with a small Bublr bar so visitors always know whose page it is and
 * can reach the classic profile (posts, follow, newsletter, guest book).
 */
export default function ProfileCodePage({ user, theme, onToggleTheme, mounted }) {
  const [collapsed, setCollapsed] = useState(false)
  const version = user.profileCode?.version || 0

  useEffect(() => {
    try {
      setCollapsed(window.sessionStorage.getItem(BAR_KEY) === '1')
    } catch (_) {
      // storage blocked: keep the bar open
    }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed(value => {
      try {
        window.sessionStorage.setItem(BAR_KEY, value ? '0' : '1')
      } catch (_) {
        // fine without it
      }
      return !value
    })
  }

  return (
    <>
      <Global
        styles={css`
          html,
          body {
            overflow: hidden;
            overscroll-behavior: none;
          }
        `}
      />
      {/* For screen readers and search engines: the page itself is in the frame */}
      <h1 css={visuallyHidden}>{user.displayName} (@{user.name})</h1>
      {user.about && <p css={visuallyHidden}>{user.about}</p>}

      <ProfileCodeFrame
        src={frameUrl(user.name, { embed: 'page', version })}
        embed="page"
        theme={theme}
        title={`${user.displayName}’s page`}
        css={frameStyle}
      />

      <nav css={barStyle} aria-label="Bublr">
        {!collapsed && (
          <>
            <a href="?classic=1" title={`${user.displayName} on Bublr`}>
              {user.photo && <img src={user.photo} alt="" />}
              <span>@{user.name}</span>
            </a>
            <span css={dividerStyle} aria-hidden="true" />
            <a href="?classic=1">Classic view</a>
            {mounted && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Show the Bublr bar' : 'Hide the Bublr bar'}
          aria-expanded={!collapsed}
          title={collapsed ? `@${user.name} on Bublr` : 'Hide'}
        >
          {collapsed && user.photo ? <img src={user.photo} alt="" /> : <CollapseIcon open={!collapsed} />}
        </button>
      </nav>
    </>
  )
}

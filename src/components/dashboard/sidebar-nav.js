/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import { useRouter } from 'next/router'
import { css } from '@emotion/react'

const navWrapStyle = css`
  display: flex;
  flex-direction: column;
  margin: 0 -0.6rem;
`

const linkStyle = css`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.95rem;
  font-size: 0.9rem;
  color: var(--grey-3);
  text-decoration: none;
  border-top: 1px dashed var(--border-dashed);
  border-bottom: 1px dashed var(--border-dashed);
  margin-top: -1px;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  cursor: pointer;

  &:hover {
    background: var(--accent-soft);
    color: var(--accent-foreground);
    border-top-style: solid;
    border-bottom-style: solid;
    border-color: var(--accent-border);
  }

  svg {
    flex-shrink: 0;
    color: currentColor;
  }
`

const activeLinkStyle = css`
  background: var(--accent-soft);
  color: var(--accent-foreground);
  border-top-style: solid;
  border-bottom-style: solid;
  border-color: var(--accent-border);
  cursor: default;
  font-weight: 500;

  &:hover {
    background: var(--accent-soft);
    color: var(--accent-foreground);
    border-color: var(--accent-border);
  }
`

const backLinkStyle = css`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.65rem 0.6rem;
  font-size: 0.78rem;
  color: var(--grey-3);
  text-decoration: none;
  cursor: pointer;
  transition: color 120ms ease;

  &:hover {
    color: var(--accent-foreground);
  }

  svg {
    flex-shrink: 0;
  }
`

const PostsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </svg>
)

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const PersonalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const CustomizationIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="13.5" cy="6.5" r="2.5" />
    <path d="M19 11.5 12 5l-9 9 6.5 6.5L19 11.5z" />
    <path d="M2 22h20" />
  </svg>
)

const AdvancedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 3-1.91 5.86a2 2 0 0 1-1.27 1.27L3 12l5.82 1.87a2 2 0 0 1 1.27 1.27L12 21l1.87-5.82a2 2 0 0 1 1.27-1.27L21 12l-5.82-1.87a2 2 0 0 1-1.27-1.27L12 3z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
)

const DeveloperIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

const ChevronLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

const mainLinks = [
  { href: '/dashboard', label: 'Posts', icon: <PostsIcon />, matchExact: true },
  { href: '/dashboard/list', label: 'Reading List', icon: <ListIcon /> },
  { href: '/dashboard/subscribers', label: 'Subscribers', icon: <UsersIcon /> },
  { href: '/dashboard/settings', label: 'Settings', icon: <SettingsIcon /> },
]

const settingsLinks = [
  { href: '/dashboard/settings/personal', label: 'Personal', icon: <PersonalIcon /> },
  { href: '/dashboard/settings/customization', label: 'Customization', icon: <CustomizationIcon /> },
  { href: '/dashboard/settings/advanced', label: 'Advanced', icon: <AdvancedIcon /> },
  { href: '/dashboard/settings/developer', label: 'Developer', icon: <DeveloperIcon /> },
]

export default function SidebarNav() {
  const router = useRouter()
  const inSettings = router.pathname.startsWith('/dashboard/settings')

  if (inSettings) {
    return (
      <nav css={css`display: flex; flex-direction: column;`} aria-label="Settings">
        <Link href="/dashboard">
          <a css={backLinkStyle}>
            <ChevronLeftIcon />
            Back to Dashboard
          </a>
        </Link>
        <div css={navWrapStyle}>
          {settingsLinks.map(link => {
            const isActive = router.pathname === link.href
            return (
              <Link key={link.href} href={link.href}>
                <a css={[linkStyle, isActive && activeLinkStyle]}>
                  {link.icon}
                  {link.label}
                </a>
              </Link>
            )
          })}
        </div>
      </nav>
    )
  }

  return (
    <nav css={navWrapStyle} aria-label="Dashboard">
      {mainLinks.map(link => {
        const isActive = link.matchExact
          ? router.pathname === link.href
          : router.pathname.startsWith(link.href)

        return (
          <Link key={link.href} href={link.href}>
            <a css={[linkStyle, isActive && activeLinkStyle]}>
              {link.icon}
              {link.label}
            </a>
          </Link>
        )
      })}
    </nav>
  )
}

/** @jsxImportSource @emotion/react */
import { Fragment } from 'react'
import Link from 'next/link'
import { css } from '@emotion/react'

// One footer for Bublr's own pages (About, Terms, Privacy, Docs, Comeback).
// Each page used to hand-write its own copy, so the links drifted: Terms and
// Privacy had no About link, Docs had no Explore link, and so on.
const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/explore', label: 'Explore' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/docs', label: 'API Docs' },
  { href: '/docs/custom-domains', label: 'Custom domains' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
]

export default function SiteFooter({ current }) {
  const currentYear = new Date().getFullYear()
  const links = LINKS.filter(link => link.href !== current)

  return (
    <div css={css`font-size: 12px; margin-top: 64px;`}>
      <p css={css`color: var(--grey-3); a { color: inherit; }`}>
        Copyright &copy; {currentYear} Bublr<br />
        {links.map((link, index) => (
          <Fragment key={link.href}>
            {index > 0 && <>&nbsp;&middot;&nbsp;</>}
            <Link href={link.href}><a>{link.label}</a></Link>
          </Fragment>
        ))}
      </p>
    </div>
  )
}

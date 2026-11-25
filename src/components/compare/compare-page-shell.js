/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import { css, Global } from '@emotion/react'

import SiteFooter from '../site-footer'
import { blockTokens, panelIn, EASE } from '../blocks/tokens'

/**
 * The frame of the comparison pages: the same 550px column, 🍱 and footer as
 * About and Privacy, so they read as part of Bublr's own site.
 */
const globalStyles = css`
  @import url('https://fonts.bunny.net/css?family=inter:400,500');
`

export const sectionTitle = css`
  font-weight: 500;
  margin-bottom: 8px;
`

export const bodyText = css`
  color: var(--grey-3);
  margin-top: 16px;
  line-height: 1.7;
`

export const divider = css`
  opacity: 0.15;
  margin-top: 32px;
  margin-bottom: 32px;
  border-color: var(--grey-4);
`

export const linkStyle = css`
  text-decoration: underline;
  text-underline-offset: 2px;
  &:hover {
    opacity: 0.8;
  }
`

export default function ComparePageShell({ children, current, wide = false }) {
  return (
    <>
      <Global styles={globalStyles} />
      <div
        css={[
          blockTokens,
          css`
            margin: 0;
            font-family: Inter, sans-serif;
            font-size: 14px;
            font-weight: 400;
            line-height: 1.5;
            color: var(--grey-4);
            text-align: left;
            background-color: var(--grey-1);
            min-height: 100vh;
            -webkit-text-size-adjust: 100%;
            -webkit-tap-highlight-color: transparent;
            *,
            ::after,
            ::before {
              box-sizing: border-box;
            }
            a {
              color: inherit;
              cursor: pointer;
            }
            p {
              margin-top: 0;
              margin-bottom: 0;
            }
          `,
        ]}
      >
        <section
          css={css`
            padding-top: 1.5rem;
            padding-bottom: 1.5rem;
            @media (min-width: 992px) {
              padding: 3rem;
            }
          `}
        >
          <div
            css={css`
              max-width: ${wide ? 640 : 550}px;
              width: 100%;
              padding-right: 0.75rem;
              padding-left: 0.75rem;
              margin-right: auto;
              margin-left: auto;
            `}
          >
            <div
              css={css`
                padding: 1.5rem;
                animation: ${panelIn} 0.5s ${EASE} both;
                @media (min-width: 992px) {
                  padding: 3rem;
                }
                @media (prefers-reduced-motion: reduce) {
                  animation: none;
                }
              `}
            >
              <Link href="/">
                <a aria-label="Bublr home" css={css`text-decoration: none; font-size: 2rem;`}>
                  🍱
                </a>
              </Link>
              {children}
              <SiteFooter current={current} />
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

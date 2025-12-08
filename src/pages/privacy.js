/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import Head from 'next/head'
import { css, Global } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'

import meta from '../components/meta'

// Global styles - only applies Inter font import
const globalStyles = css`
  @import url('https://fonts.bunny.net/css?family=inter:400,500');
`

export default function Privacy() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : false

  // Theme-aware colors (matching app's --grey-1)
  const colors = {
    bg: isDark ? '#171717' : '#ffffff',
    text: isDark ? 'rgb(229, 231, 235)' : 'rgb(33, 37, 41)',
    muted: isDark ? 'rgba(229, 231, 235, 0.6)' : 'rgba(33, 37, 41, 0.6)',
    border: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgb(222, 223, 223)',
  }

  return (
    <>
      <Global styles={globalStyles} />
      <Head>
        {meta({
          title: 'Privacy Policy | Bublr',
          description: 'Learn how Bublr collects, uses, and protects your personal information.',
          url: '/privacy',
        })}
        <link rel="canonical" href="https://bublr.life/privacy" />
      </Head>

      <div
        css={css`
          margin: 0;
          font-family: Inter, sans-serif;
          font-size: 14px;
          font-weight: 400;
          line-height: 1.5;
          color: ${colors.text};
          text-align: left;
          background-color: ${colors.bg};
          min-height: 100vh;
          -webkit-text-size-adjust: 100%;
          -webkit-tap-highlight-color: transparent;
          transition: background-color 0.3s ease, color 0.3s ease;

          *, ::after, ::before {
            box-sizing: border-box;
          }

          a {
            color: inherit;
            cursor: pointer;
          }

          p {
            display: block;
            margin-top: 0px;
            margin-bottom: 0px;
            text-align: left;
          }
        `}
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
              max-width: 550px;
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

                @media (min-width: 992px) {
                  padding: 3rem;
                }
              `}
            >
              <Link href="/">
                <a css={css`text-decoration: none; font-size: 2rem;`}>
                  🍱
                </a>
              </Link>

              <h1
                css={css`
                  font-size: 1.25rem;
                  font-weight: 500;
                  margin-top: 32px;
                  margin-bottom: 8px;
                  line-height: 1.2;
                `}
              >
                Privacy Policy
              </h1>

              <p css={css`color: ${colors.muted}; margin-bottom: 32px;`}>
                Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Information We Collect
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                When you sign up for Bublr, we collect minimal information through Google Authentication:
              </p>
              <ul css={css`color: ${colors.muted}; margin-top: 12px; margin-left: 1.25rem; line-height: 1.7;`}>
                <li>Your display name</li>
                <li>Your email address (for authentication purposes only)</li>
                <li>A unique user identifier</li>
              </ul>
              <p css={css`color: ${colors.muted}; margin-top: 12px; line-height: 1.7;`}>
                We also store content you create on our platform, including posts, profile information, and any customizations you make.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                How We Use Your Information
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                We use your information to:
              </p>
              <ul css={css`color: ${colors.muted}; margin-top: 12px; margin-left: 1.25rem; line-height: 1.7;`}>
                <li>Provide and maintain your Bublr account</li>
                <li>Display your public profile and published posts</li>
                <li>Enable features like reading lists and post discovery</li>
                <li>Moderate content to maintain community standards</li>
              </ul>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Data Storage & Security
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                Your data is stored securely using Firebase/Firestore. We do not sell, trade, or otherwise transfer your personal information to outside parties. We implement appropriate security measures to protect against unauthorized access, alteration, disclosure, or destruction of your data.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Your Rights
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                You have the right to:
              </p>
              <ul css={css`color: ${colors.muted}; margin-top: 12px; margin-left: 1.25rem; line-height: 1.7;`}>
                <li>Access your personal data</li>
                <li>Edit or update your information</li>
                <li>Delete your posts and content</li>
                <li>Request account deletion</li>
              </ul>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Cookies
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                We use essential cookies for authentication and theme preferences. We do not use tracking cookies or third-party analytics that would compromise your privacy.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Open Source
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                Bublr is open-source. You can review our code and data handling practices on{' '}
                <a
                  href="https://github.com/solomonshalom/bublr"
                  target="_blank"
                  rel="noopener noreferrer"
                  css={css`
                    text-decoration: underline;
                    text-underline-offset: 2px;
                    &:hover {
                      opacity: 0.8;
                    }
                  `}
                >
                  GitHub
                </a>
                . Transparency is at the core of how we operate.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Changes to This Policy
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                We may update this privacy policy from time to time. We will notify users of any material changes by posting the new policy on this page.
              </p>

              {/* Footer */}
              <div css={css`font-size: 12px; margin-top: 64px;`}>
                <p css={css`color: ${colors.muted}; a { color: inherit; }`}>
                  Copyright &copy; {currentYear} Bublr<br />
                  <Link href="/"><a>Home</a></Link>
                  &nbsp;&middot;&nbsp;
                  <Link href="/terms"><a>Terms</a></Link>
                  &nbsp;&middot;&nbsp;
                  <Link href="/explore"><a>Explore</a></Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

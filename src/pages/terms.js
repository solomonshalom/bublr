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

export default function Terms() {
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
          title: 'Terms of Service | Bublr',
          description: 'Read the terms and conditions for using Bublr, the open-source writing platform.',
          url: '/terms',
        })}
        <link rel="canonical" href="https://bublr.life/terms" />
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
                Terms of Service
              </h1>

              <p css={css`color: ${colors.muted}; margin-bottom: 32px;`}>
                Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Acceptance of Terms
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                By accessing and using Bublr, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Your Account
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                You are responsible for maintaining the security of your account. Bublr uses Google Authentication for sign-in. You are responsible for all activities that occur under your account.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Content Guidelines
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                You retain ownership of the content you create on Bublr. However, you agree not to post content that:
              </p>
              <ul css={css`color: ${colors.muted}; margin-top: 12px; margin-left: 1.25rem; line-height: 1.7;`}>
                <li>Is illegal, harmful, or violates any applicable laws</li>
                <li>Infringes on intellectual property rights of others</li>
                <li>Contains spam, malware, or deceptive content</li>
                <li>Harasses, threatens, or promotes violence against others</li>
                <li>Contains explicit adult content without appropriate warnings</li>
                <li>Impersonates another person or entity</li>
              </ul>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Content Moderation
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                We use automated moderation tools to help maintain community standards. Content that violates our guidelines may be automatically flagged or removed. We reserve the right to remove any content and terminate accounts that violate these terms.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Intellectual Property
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                You own the content you create. By posting content on Bublr, you grant us a non-exclusive license to display, distribute, and promote your content on our platform. This license ends when you delete your content.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Service Availability
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                Bublr is provided &quot;as is&quot; without warranties of any kind. We do not guarantee that the service will be available at all times. We may modify or discontinue features at any time.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Limitation of Liability
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                Bublr and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Open Source
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                Bublr is open-source software. The source code is available on{' '}
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
                . Contributions are welcome under the project&apos;s license terms.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Changes to Terms
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                We reserve the right to modify these terms at any time. Continued use of Bublr after changes constitutes acceptance of the new terms.
              </p>

              {/* Footer */}
              <div css={css`font-size: 12px; margin-top: 64px;`}>
                <p css={css`color: ${colors.muted}; a { color: inherit; }`}>
                  Copyright &copy; {currentYear} Bublr<br />
                  <Link href="/"><a>Home</a></Link>
                  &nbsp;&middot;&nbsp;
                  <Link href="/privacy"><a>Privacy</a></Link>
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

/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import Head from 'next/head'
import { css, Global } from '@emotion/react'

import SiteFooter from '../components/site-footer'
import meta from '../components/meta'

// Global styles - only applies Inter font import
const globalStyles = css`
  @import url('https://fonts.bunny.net/css?family=inter:400,500');
`

export default function About() {

  return (
    <>
      <Global styles={globalStyles} />
      <Head>
        {meta({
          title: 'About | Bublr',
          description: 'Learn about Bublr - a fresh take on blogging for the modern web.',
          url: '/about',
        })}
        <link rel="canonical" href="https://bublr.life/about" />
      </Head>

      <div
        css={css`
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
                About Bublr
              </h1>

              <p css={css`color: var(--grey-3); margin-bottom: 32px;`}>
                A fresh take on blogging
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Our Story
              </p>
              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                Blogging has felt the same since 2010. The same templates, the same cluttered interfaces, the same overwhelming dashboards. We wanted something different.
              </p>
              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                Bublr was born from a simple idea: what if writing online could feel as natural as jotting down thoughts in a notebook? No distractions, no complexity — just you and your words.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Why We Built This
              </p>
              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                We believe everyone has something worth sharing. But most platforms make it harder than it needs to be. Complex editors, confusing settings, paywalls everywhere.
              </p>
              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                Bublr strips away the noise. Write, publish, share. That&apos;s it.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                How to Use Bublr
              </p>
              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                Getting started is simple:
              </p>
              <ul css={css`color: var(--grey-3); margin-top: 12px; margin-left: 1.25rem; line-height: 1.7;`}>
                <li><strong>Sign up</strong> — Use your Google account or an email and password</li>
                <li><strong>Create a post</strong> — Click Create Post in your dashboard (or press C)</li>
                <li><strong>Write</strong> — Use our clean editor. Press / for blocks, or format with keyboard shortcuts</li>
                <li><strong>Publish</strong> — Open post settings with the ⋮ button at the top, then switch on Published when you&apos;re ready</li>
                <li><strong>Share</strong> — Your post is live at bublr.life/yourname/post-slug</li>
              </ul>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Features
              </p>
              <ul css={css`color: var(--grey-3); margin-top: 12px; margin-left: 1.25rem; line-height: 1.7;`}>
                <li><strong>Clean Editor</strong> — Distraction-free writing with rich text support</li>
                <li><strong>Your Profile</strong> — Customize your page with bio, social links, and custom sections</li>
                <li><strong>Explore</strong> — Discover writing from everyone on Bublr, no account needed</li>
                <li><strong>Reading List</strong> — Save posts from other writers to read later</li>
                <li><strong>Newsletters &amp; RSS</strong> — Readers can subscribe by email or follow your feed at bublr.life/yourname/feed.xml</li>
                <li><strong>Import Articles</strong> — Bring your posts from Medium, Substack, WordPress, Ghost and more</li>
                <li><strong>Export</strong> — Download everything you&apos;ve written as Markdown, any time</li>
                <li><strong>Dark Mode</strong> — Easy on the eyes, day or night</li>
                <li><strong>Custom Domains</strong> — Use your own domain for your Bublr page (Bublr Pro, $4.99/month, optional)</li>
              </ul>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Keyboard Shortcuts
              </p>
              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                Speed up your writing:
              </p>
              <ul css={css`color: var(--grey-3); margin-top: 12px; margin-left: 1.25rem; line-height: 1.7;`}>
                <li><code css={css`background: var(--border); padding: 2px 6px; border-radius: 4px;`}>Cmd/Ctrl + B</code> — Bold</li>
                <li><code css={css`background: var(--border); padding: 2px 6px; border-radius: 4px;`}>Cmd/Ctrl + I</code> — Italic</li>
                <li><code css={css`background: var(--border); padding: 2px 6px; border-radius: 4px;`}>Cmd/Ctrl + U</code> — Underline</li>
                <li><code css={css`background: var(--border); padding: 2px 6px; border-radius: 4px;`}>Cmd/Ctrl + K</code> — Add link</li>
              </ul>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Open Source
              </p>
              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                Bublr is open source. We believe in transparency and community.{' '}
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
                  Check out the code
                </a>
                , contribute, or fork it to build your own.
              </p>

              {/* Footer */}
              <SiteFooter current="/about" />
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

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

const ruleStyle = css`
  opacity: 0.15;
  margin-top: 32px;
  margin-bottom: 32px;
  border-color: var(--grey-4);
`

const headingStyle = css`
  font-weight: 500;
  margin-bottom: 8px;
`

const bodyStyle = css`
  color: var(--grey-3);
  margin-top: 16px;
  line-height: 1.7;
`

const listStyle = css`
  color: var(--grey-3);
  margin-top: 12px;
  margin-left: 1.25rem;
  line-height: 1.7;
`

const linkStyle = css`
  text-decoration: underline;
  text-underline-offset: 2px;

  &:hover {
    opacity: 0.8;
  }
`

// Hand-drawn green underline for the headline. A single Q sets the first
// half-wave and each following T reflects it, so the crests alternate on
// their own.
function Squiggle() {
  return (
    <svg
      viewBox="0 0 200 12"
      width="200"
      height="12"
      fill="none"
      aria-hidden="true"
      focusable="false"
      css={css`
        display: block;
        max-width: 100%;
        margin-top: 6px;
        margin-bottom: 10px;
        overflow: visible;
        /* The banner green reads too dim against the dark page background */
        color: #15803d;

        [data-theme='dark'] & {
          color: #22c55e;
        }
      `}
    >
      <path
        d="M3 8 Q12.5 1.5 22 8 T41 8 T60 8 T79 8 T98 8 T117 8 T136 8 T155 8 T174 8 T193 8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Comeback() {

  return (
    <>
      <Global styles={globalStyles} />
      <Head>
        {meta({
          title: "We're making a comeback | Bublr",
          description:
            "Bublr isn't going anywhere. We're making a lot of changes and relaunching by December 10th.",
          url: '/comeback',
        })}
        <link rel="canonical" href="https://bublr.life/comeback" />
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
                We&apos;re making a comeback ✨
              </h1>

              <Squiggle />

              <p css={css`color: var(--grey-3); margin-bottom: 32px;`}>
                Relaunching by December 10th
              </p>

              <hr css={ruleStyle} />

              <p css={headingStyle}>
                Bublr isn&apos;t going anywhere
              </p>
              <p css={bodyStyle}>
                Things have been quiet around here. That&apos;s because we&apos;ve
                been busy.
              </p>
              <p css={bodyStyle}>
                Bublr is staying. Your posts, your profile and your page are right
                where you left them. Keep writing.
              </p>

              <hr css={ruleStyle} />

              <p css={headingStyle}>
                What&apos;s happening
              </p>
              <p css={bodyStyle}>
                We&apos;re making changes. A lot of them. New things, better
                things, things we&apos;ve wanted to build for a long time. Some
                you&apos;ll notice straight away, some you&apos;ll just feel.
              </p>
              <p css={bodyStyle}>
                It&apos;s still Bublr. Same quiet place to write. Just better.
              </p>

              <hr css={ruleStyle} />

              <p css={headingStyle}>
                What stays the same
              </p>
              <ul css={listStyle}>
                <li><strong>Your words</strong> — every post you&apos;ve written comes with you</li>
                <li><strong>No ads</strong> — not now, not ever</li>
                <li><strong>No paywalls</strong> — writing and reading stay free</li>
                <li><strong>No clutter</strong> — just you and your words</li>
              </ul>

              <hr css={ruleStyle} />

              <p css={headingStyle}>
                December 10th
              </p>
              <p css={bodyStyle}>
                Mark the date. That&apos;s when it all goes live.
              </p>
              <p css={bodyStyle}>
                Until then, Bublr works just like it always has. Write, publish,
                share. That&apos;s it.
              </p>

              <hr css={ruleStyle} />

              <p css={headingStyle}>
                Say hi
              </p>
              <p css={bodyStyle}>
                Got an idea, a request, or just want to say hello? Email{' '}
                <a href="mailto:solomon@bublr.life" css={linkStyle}>
                  solomon@bublr.life
                </a>
                .
              </p>

              {/* Footer */}
              <SiteFooter current="/comeback" />
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

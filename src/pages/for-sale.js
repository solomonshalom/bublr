/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import Head from 'next/head'
import { css, Global } from '@emotion/react'

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

export default function ForSale() {
  const currentYear = new Date().getFullYear()

  return (
    <>
      <Global styles={globalStyles} />
      <Head>
        {meta({
          title: "We're up for sale | Bublr",
          description:
            "Bublr is for sale. For the right person and the right price, we'd hand over the company — keeping only a small minority stake.",
          url: '/for-sale',
        })}
        <link rel="canonical" href="https://bublr.life/for-sale" />
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
                We&apos;re up for sale 👀
              </h1>

              <Squiggle />

              <p css={css`color: var(--grey-3); margin-bottom: 32px;`}>
                For the right person, at the right price
              </p>

              <hr css={ruleStyle} />

              <p css={headingStyle}>
                Yes, really
              </p>
              <p css={bodyStyle}>
                This isn&apos;t a stunt or a hiring funnel. Bublr — the product, the
                brand, the domain, the codebase and the community that writes on
                it — is genuinely for sale.
              </p>
              <p css={bodyStyle}>
                We&apos;re not in a rush and we&apos;re not desperate. Bublr is
                running, it&apos;s loved by the people who use it, and it will keep
                running whether or not it changes hands. But if the right person
                turns up with the right number, we&apos;d hand over the keys.
              </p>

              <hr css={ruleStyle} />

              <p css={headingStyle}>
                The shape of the deal
              </p>
              <p css={bodyStyle}>
                We&apos;d sell the company outright, keeping only a small minority
                stake — enough to stay along for the ride and help where we can,
                small enough that you&apos;re unambiguously the one steering.
              </p>
              <ul css={listStyle}>
                <li><strong>You get control</strong> — the majority of the company, and the final say on where it goes</li>
                <li><strong>We keep a sliver</strong> — a small minority stake, because we still believe in the thing we built</li>
                <li><strong>Handover included</strong> — we&apos;ll walk you through the codebase, the infrastructure and the community</li>
                <li><strong>Everything transfers</strong> — domain, brand, Firebase project, subscriptions and all the moving parts</li>
              </ul>

              <hr css={ruleStyle} />

              <p css={headingStyle}>
                What you&apos;d be buying
              </p>
              <ul css={listStyle}>
                <li><strong>A live product</strong> — writers publishing on it today, not a side project in a drawer</li>
                <li><strong>An open-source codebase</strong> — Next.js and Firebase, readable before you ever talk to us</li>
                <li><strong>bublr.life</strong> — the domain and the brand that goes with it</li>
                <li><strong>Revenue in place</strong> — paid custom domains, with plenty of room to build on</li>
                <li><strong>A clear point of view</strong> — no ads, no paywalls, no clutter. Please keep it that way</li>
              </ul>

              <hr css={ruleStyle} />

              <p css={headingStyle}>
                The right person
              </p>
              <p css={bodyStyle}>
                Price matters, but it isn&apos;t the only thing. Bublr was built on
                the idea that writing online should be quiet and uncomplicated, and
                a few thousand people took us up on that. We&apos;d rather sell to
                someone who wants to grow that than to someone who wants to stuff
                it full of ads.
              </p>
              <p css={bodyStyle}>
                If that sounds like you, the number is negotiable. If it
                doesn&apos;t, it probably isn&apos;t.
              </p>

              <hr css={ruleStyle} />

              <p css={headingStyle}>
                Get in touch
              </p>
              <p css={bodyStyle}>
                Tell us who you are, what you&apos;d do with Bublr, and roughly what
                you have in mind. Serious enquiries get a real reply.
              </p>
              <p css={bodyStyle}>
                Email{' '}
                <a href="mailto:solomon@bublr.life" css={linkStyle}>
                  solomon@bublr.life
                </a>
                .
              </p>

              {/* Footer */}
              <div css={css`font-size: 12px; margin-top: 64px;`}>
                <p css={css`color: var(--grey-3); a { color: inherit; }`}>
                  Copyright &copy; {currentYear} Bublr<br />
                  <Link href="/"><a>Home</a></Link>
                  &nbsp;&middot;&nbsp;
                  <Link href="/about"><a>About</a></Link>
                  &nbsp;&middot;&nbsp;
                  <Link href="/terms"><a>Terms</a></Link>
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

/** @jsxImportSource @emotion/react */
import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import Head from 'next/head'
import { css, Global } from '@emotion/react'

import SiteFooter from '../components/site-footer'
import meta from '../components/meta'
import { parseChangelog, parseInline } from '../lib/changelog'

const globalStyles = css`
  @import url('https://fonts.bunny.net/css?family=inter:400,500');
`

const ruleStyle = css`
  opacity: 0.15;
  margin-top: 32px;
  margin-bottom: 32px;
  border-color: var(--grey-4);
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

  li + li {
    margin-top: 6px;
  }
`
const linkStyle = css`
  text-decoration: underline;
  text-underline-offset: 2px;
`

function Inline({ text }) {
  return parseInline(text).map((t, i) => {
    if (t.type === 'strong') return <strong key={i}>{t.text}</strong>
    if (t.type === 'em') return <em key={i}>{t.text}</em>
    if (t.type === 'code') return <code key={i}>{t.text}</code>
    if (t.type === 'link') {
      return t.href.startsWith('/') ? (
        <Link key={i} href={t.href} css={linkStyle}>{t.text}</Link>
      ) : (
        <a key={i} href={t.href} css={linkStyle} rel="noopener noreferrer">{t.text}</a>
      )
    }
    return <span key={i}>{t.text}</span>
  });
}

export async function getStaticProps() {
  let entries = []
  try {
    const file = path.join(process.cwd(), 'changelog.md')
    entries = parseChangelog(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    console.error('Could not read changelog.md', err)
  }
  return { props: { entries } }
}

export default function Changelog({ entries }) {
  return (
    <>
      <Global styles={globalStyles} />
      <Head>
        {meta({
          title: 'Changelog | Bublr',
          description: 'Everything that has changed in Bublr, newest first.',
          url: '/changelog',
        })}
        <link rel="canonical" href="https://bublr.life/changelog" />
      </Head>

      <div
        css={css`
          margin: 0;
          font-family: Inter, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: var(--grey-4);
          background-color: var(--grey-1);
          min-height: 100vh;
          *, ::after, ::before { box-sizing: border-box; }
          a { color: inherit; cursor: pointer; }
          p { margin: 0; }
          code {
            font-size: 0.9em;
            padding: 1px 4px;
            border-radius: 4px;
            background: var(--grey-2);
          }
        `}
      >
        <section css={css`padding: 1.5rem 0; @media (min-width: 992px) { padding: 3rem; }`}>
          <div
            css={css`
              max-width: 550px;
              width: 100%;
              padding: 0 0.75rem;
              margin: 0 auto;
            `}
          >
            <div css={css`padding: 1.5rem; @media (min-width: 992px) { padding: 3rem; }`}>
              <Link href="/" css={css`text-decoration: none; font-size: 2rem;`}>
                🍱
              </Link>
              <h1 css={css`font-size: 1.25rem; font-weight: 500; margin: 32px 0 8px; line-height: 1.2;`}>
                Changelog
              </h1>
              <p css={css`color: var(--grey-3);`}>What&apos;s changed in Bublr, newest first.</p>

              {entries.map((entry, i) => (
                <article key={`${entry.title}-${i}`}>
                  <hr css={ruleStyle} />
                  <h2 css={css`font-size: 1rem; font-weight: 500; margin: 0;`}>{entry.title}</h2>
                  {entry.date && (
                    <p css={css`color: var(--grey-3); font-size: 12px; margin-top: 2px;`}>{entry.date}</p>
                  )}
                  {entry.blocks.map((b, j) => {
                    if (b.type === 'h') {
                      return (
                        <h3 key={j} css={css`font-size: 14px; font-weight: 500; margin: 24px 0 0;`}>
                          {b.text}
                        </h3>
                      )
                    }
                    if (b.type === 'ul') {
                      return (
                        <ul key={j} css={listStyle}>
                          {b.items.map((it, k) => <li key={k}><Inline text={it} /></li>)}
                        </ul>
                      )
                    }
                    return <p key={j} css={bodyStyle}><Inline text={b.text} /></p>
                  })}
                </article>
              ))}

              <SiteFooter current="/changelog" />
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

/** @jsxImportSource @emotion/react */
import Head from 'next/head'
import Link from 'next/link'
import { css } from '@emotion/react'
import { useMemo, useState } from 'react'

import meta from '../../components/meta'
import ComparePageShell, { bodyText, divider, sectionTitle } from '../../components/compare/compare-page-shell'
import HoverSlideList from '../../components/blocks/hover-slide-list'
import { EASE } from '../../components/blocks/tokens'
import { BUBLR_POINTS, COMPARE_UPDATED, KINDS, PLATFORMS, faviconFor, formatUpdated } from '../../lib/comparisons'
import { safeJsonLd } from '../../lib/escape'

const SITE = 'https://bublr.life'

export default function CompareIndex({ platforms }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => (q ? platforms.filter(p => `${p.name} ${p.kind} ${p.oneLiner}`.toLowerCase().includes(q)) : platforms),
    [platforms, q]
  )

  const description =
    'Compare Bublr with Substack, Medium, Ghost, beehiiv, WordPress, Squarespace, Linktree and more: price, your own domain, newsletters, selling, ads and who owns your readers.'

  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Compare Bublr',
      description,
      url: `${SITE}/compare`,
      dateModified: COMPARE_UPDATED,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: platforms.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `Bublr vs ${p.name}`,
          url: `${SITE}/compare/${p.slug}`,
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Bublr', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Compare', item: `${SITE}/compare` },
      ],
    },
  ]

  return (
    <>
      <Head>
        {meta({
          title: 'Compare Bublr with Substack, Medium, Ghost and more | Bublr',
          description,
          url: '/compare',
          keywords: 'substack alternative, medium alternative, ghost alternative, beehiiv alternative, blog platform comparison, newsletter platform comparison, link in bio alternative',
        })}
        <link rel="canonical" href={`${SITE}/compare`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
      </Head>
      <ComparePageShell current="/compare">
        <h1 css={css`font-size: 1.25rem; font-weight: 500; margin-top: 32px; margin-bottom: 8px; line-height: 1.2;`}>Compare Bublr</h1>
        <p css={css`color: var(--grey-3);`}>
          Bublr is your very own home on the internet: write, send a newsletter, show your photos and music, and sell anything,
          all on one page. Pick the platform you use, or the one you’re thinking about, and see how they compare.
        </p>

        <hr css={divider} />

        <label htmlFor="compare-search" css={sectionTitle} style={{ display: 'block' }}>
          Compare Bublr with…
        </label>
        <input
          id="compare-search"
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search Substack, Medium, Linktree…"
          autoComplete="off"
          css={css`
            margin-top: 12px;
            width: 100%;
            padding: 10px 12px;
            font: inherit;
            font-size: 14px;
            color: var(--grey-4);
            background: transparent;
            border: 1px solid var(--border);
            border-radius: 8px;
            outline: none;
            transition: border-color 0.18s ${EASE};
            &:focus {
              border-color: var(--grey-3);
            }
          `}
        />

        {KINDS.map(kind => {
          const items = filtered.filter(p => p.kind === kind)
          if (!items.length) return null
          return (
            <div key={kind} css={css`margin-top: 24px;`}>
              <p css={css`font-size: 12px; color: var(--grey-3); text-transform: uppercase; letter-spacing: 0.06em;`}>{kind}</p>
              <HoverSlideList css={css`margin: 8px -12px 0; display: grid; grid-template-columns: minmax(0, 1fr);`}>
                {items.map(p => (
                  <Link key={p.slug} href={`/compare/${p.slug}`}>
                    <a
                      className="hover-slide-item"
                      css={css`
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 10px 12px;
                        border-radius: 10px;
                        text-decoration: none;
                      `}
                    >
                      <img src={faviconFor(p.website)} alt="" width={20} height={20} loading="lazy" css={css`width: 20px; height: 20px; border-radius: 5px; flex-shrink: 0;`} />
                      <span css={css`display: flex; flex-direction: column; min-width: 0;`}>
                        <span className="hover-slide-title" css={css`font-weight: 500;`}>Bublr vs {p.name}</span>
                        <span className="hover-slide-muted" css={css`color: var(--grey-3); font-size: 13px; line-height: 1.45;`}>
                          {p.oneLiner}
                        </span>
                      </span>
                    </a>
                  </Link>
                ))}
              </HoverSlideList>
            </div>
          )
        })}
        {filtered.length === 0 ? (
          <p css={[bodyText, css`margin-top: 20px;`]}>No platform by that name yet. Most of them work like one of the ones above.</p>
        ) : null}

        <hr css={divider} />

        <p css={sectionTitle}>What every comparison comes back to</p>
        <ul css={css`color: var(--grey-3); margin-top: 12px; margin-left: 1.25rem; line-height: 1.7;`}>
          {BUBLR_POINTS.map(point => (
            <li key={point.title}>
              <strong css={css`color: var(--grey-4); font-weight: 500;`}>{point.title}</strong> {point.text}
            </li>
          ))}
        </ul>
        <p css={[bodyText, css`font-size: 12px;`]}>Checked against each platform’s own pricing and help pages on {formatUpdated()}.</p>

        <div css={css`margin-top: 28px;`}>
          <Link href="/signup">
            <a
              css={css`
                display: inline-flex;
                align-items: center;
                padding: 10px 16px;
                border-radius: 8px;
                background: var(--grey-5);
                color: var(--grey-1) !important;
                text-decoration: none;
                font-weight: 500;
                transition: opacity 0.18s ${EASE};
                &:hover {
                  opacity: 0.88;
                }
              `}
            >
              Make your home on Bublr. It’s free
            </a>
          </Link>
        </div>
      </ComparePageShell>
    </>
  )
}

export async function getStaticProps() {
  return {
    props: {
      platforms: PLATFORMS.map(({ slug, name, website, kind, oneLiner }) => ({ slug, name, website, kind, oneLiner })),
    },
  }
}

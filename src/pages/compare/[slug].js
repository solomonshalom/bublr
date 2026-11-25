/** @jsxImportSource @emotion/react */
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { css } from '@emotion/react'

import meta from '../../components/meta'
import ComparePageShell, { bodyText, divider, linkStyle, sectionTitle } from '../../components/compare/compare-page-shell'
import { EASE, fadeIn } from '../../components/blocks/tokens'
import { BUBLR, COMPARE_UPDATED, PLATFORMS, ROWS, faqsFor, faviconFor, formatUpdated, getPlatform } from '../../lib/comparisons'
import { safeJsonLd } from '../../lib/escape'

const SITE = 'https://bublr.life'

const MARK = {
  yes: { symbol: '✓', label: 'Yes', color: 'var(--green)' },
  partial: { symbol: '~', label: 'Partly', color: '#d97706' },
  no: { symbol: '✕', label: 'No', color: 'var(--grey-3)' },
}

function Cell({ value, label }) {
  const mark = MARK[value?.verdict] || null
  return (
    <td
      data-label={label}
      css={css`
        padding: 12px 10px;
        vertical-align: top;
        color: var(--grey-3);
        font-size: 13px;
        line-height: 1.5;
      `}
    >
      {mark ? (
        <span aria-label={mark.label} css={css`display: inline-block; width: 14px; font-weight: 600; color: ${mark.color};`}>
          {mark.symbol}
        </span>
      ) : null}{' '}
      {value?.text || 'Unconfirmed'}
    </td>
  )
}

export default function ComparePlatform({ platform, others }) {
  const router = useRouter()
  const faqs = faqsFor(platform)
  const url = `${SITE}/compare/${platform.slug}`
  const title = `Bublr vs ${platform.name} (${new Date(COMPARE_UPDATED).getFullYear()}): ${platform.titleHook}`

  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `Bublr vs ${platform.name}`,
      headline: title,
      description: platform.metaDescription,
      url,
      dateModified: COMPARE_UPDATED,
      inLanguage: 'en',
      isPartOf: { '@type': 'WebSite', name: 'Bublr', url: SITE },
      about: [
        { '@type': 'SoftwareApplication', name: 'Bublr', url: SITE, applicationCategory: 'WebApplication', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
        { '@type': 'Thing', name: platform.name, url: platform.website },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Bublr', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Compare', item: `${SITE}/compare` },
        { '@type': 'ListItem', position: 3, name: `Bublr vs ${platform.name}`, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]

  return (
    <>
      <Head>
        {meta({
          title,
          description: platform.metaDescription,
          url: `/compare/${platform.slug}`,
          keywords: `bublr vs ${platform.name.toLowerCase()}, ${platform.name.toLowerCase()} alternative, ${platform.name.toLowerCase()} vs bublr, best ${platform.name.toLowerCase()} alternative, ${platform.keywords || ''}`,
        })}
        <link rel="canonical" href={url} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
      </Head>
      <ComparePageShell current={null} wide>
        <nav aria-label="Breadcrumb" css={css`margin-top: 28px; font-size: 12px; color: var(--grey-3);`}>
          <Link href="/compare"><a css={linkStyle}>Compare</a></Link> / {platform.name}
        </nav>

        <h1 css={css`font-size: 1.25rem; font-weight: 500; margin-top: 10px; margin-bottom: 8px; line-height: 1.25; display: flex; align-items: center; gap: 10px;`}>
          <img src={faviconFor(platform.website)} alt="" width={22} height={22} css={css`width: 22px; height: 22px; border-radius: 6px;`} />
          Bublr vs {platform.name}
        </h1>
        <p css={css`color: var(--grey-3); line-height: 1.7;`}>{platform.summary}</p>

        <div css={css`margin-top: 20px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`}>
          <label htmlFor="compare-with" css={css`font-size: 13px; color: var(--grey-3);`}>Compare Bublr with</label>
          <select
            id="compare-with"
            value={platform.slug}
            onChange={event => router.push(`/compare/${event.target.value}`)}
            css={css`
              font: inherit;
              font-size: 13px;
              padding: 6px 10px;
              border-radius: 8px;
              border: 1px solid var(--border);
              background: var(--grey-1);
              color: var(--grey-4);
              outline: none;
              transition: border-color 0.18s ${EASE};
              &:focus {
                border-color: var(--grey-3);
              }
            `}
          >
            {[platform, ...others].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </select>
        </div>

        <hr css={divider} />

        <h2 css={[sectionTitle, css`font-size: 14px;`]}>At a glance</h2>
        <div css={css`margin: 12px -10px 0; overflow-x: auto;`} data-lenis-prevent>
          <table
            css={css`
              width: 100%;
              border-collapse: collapse;
              th {
                text-align: left;
                font-size: 12px;
                font-weight: 500;
                color: var(--grey-4);
                padding: 8px 10px;
                border-bottom: 1px solid var(--border);
              }
              tbody tr {
                border-bottom: 1px solid var(--border);
                opacity: 0;
                animation: ${fadeIn} 0.45s ease-out forwards;
              }
              tbody th {
                font-weight: 400;
                color: var(--grey-4);
                font-size: 13px;
                padding: 12px 10px;
                vertical-align: top;
                width: 30%;
                border-bottom: none;
              }
              @media (prefers-reduced-motion: reduce) {
                tbody tr {
                  animation: none;
                  opacity: 1;
                }
              }
              /* Phones: each row stacks, with Bublr and the other platform labelled. */
              @media (max-width: 560px) {
                thead {
                  position: absolute;
                  left: -9999px;
                }
                tbody tr {
                  display: block;
                  padding: 10px 0;
                }
                tbody th,
                tbody td {
                  display: block;
                  width: auto;
                  padding: 4px 10px;
                }
                tbody th {
                  font-weight: 500;
                }
                tbody td::before {
                  content: attr(data-label) ': ';
                  color: var(--grey-4);
                  font-weight: 500;
                }
              }
            `}
          >
            <thead>
              <tr>
                <th scope="col"><span css={css`position: absolute; left: -9999px;`}>Feature</span></th>
                <th scope="col">Bublr</th>
                <th scope="col">{platform.name}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, index) => (
                <tr key={row.key} style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}>
                  <th scope="row">{row.label}</th>
                  <Cell value={BUBLR[row.key]} label="Bublr" />
                  <Cell value={platform.values[row.key]} label={platform.name} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <hr css={divider} />

        <h2 css={[sectionTitle, css`font-size: 14px;`]}>Why people pick Bublr over {platform.name}</h2>
        <ul css={css`color: var(--grey-3); margin-top: 12px; margin-left: 1.25rem; line-height: 1.7;`}>
          {platform.whyBublr.map(item => (
            <li key={item} css={css`margin-bottom: 6px;`}>{item}</li>
          ))}
        </ul>

        <h2 css={[sectionTitle, css`font-size: 14px; margin-top: 28px;`]}>When {platform.name} is the better fit</h2>
        <p css={bodyText}>{platform.whenThem}</p>

        <hr css={divider} />

        <h2 css={[sectionTitle, css`font-size: 14px;`]}>Moving from {platform.name}</h2>
        <p css={bodyText}>{platform.moving}</p>

        <hr css={divider} />

        <h2 css={[sectionTitle, css`font-size: 14px;`]}>Questions</h2>
        <div css={css`margin-top: 8px;`}>
          {faqs.map(f => (
            <details
              key={f.q}
              css={css`
                border-bottom: 1px solid var(--border);
                padding: 12px 0;
                summary {
                  cursor: pointer;
                  list-style: none;
                  color: var(--grey-4);
                  display: flex;
                  justify-content: space-between;
                  gap: 12px;
                }
                summary::-webkit-details-marker {
                  display: none;
                }
                summary::after {
                  content: '+';
                  color: var(--grey-3);
                  transition: transform 0.24s ${EASE};
                }
                &[open] summary::after {
                  transform: rotate(45deg);
                }
                p {
                  color: var(--grey-3);
                  margin-top: 8px !important;
                  line-height: 1.7;
                  animation: ${fadeIn} 0.3s ease-out;
                }
              `}
            >
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>

        <div css={css`margin-top: 28px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;`}>
          <Link href="/signup">
            <a
              css={css`
                display: inline-flex;
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
          <Link href="/compare"><a css={[linkStyle, css`font-size: 13px; color: var(--grey-3);`]}>Compare another platform</a></Link>
        </div>

        <hr css={divider} />

        <p css={css`font-size: 12px; color: var(--grey-3); line-height: 1.7;`}>
          Facts about {platform.name} were checked on its own pricing and help pages on {formatUpdated()}. Prices and plans change; if something here is out of date,{' '}
          <a href="https://github.com/solomonshalom/bublr/issues" target="_blank" rel="noopener noreferrer" css={linkStyle}>tell us</a> and we’ll fix it.
          {platform.sources?.length ? (
            <>
              {' '}Sources:{' '}
              {platform.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 ? ', ' : ''}
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" css={linkStyle}>{s.label}</a>
                </span>
              ))}
              .
            </>
          ) : null}
        </p>

        <p css={[sectionTitle, css`margin-top: 28px;`]}>Other comparisons</p>
        <p css={css`color: var(--grey-3); line-height: 1.9; font-size: 13px;`}>
          {others.slice(0, 12).map((p, i) => (
            <span key={p.slug}>
              {i > 0 ? ' · ' : ''}
              <Link href={`/compare/${p.slug}`}><a css={linkStyle}>Bublr vs {p.name}</a></Link>
            </span>
          ))}
        </p>
      </ComparePageShell>
    </>
  )
}

export async function getStaticPaths() {
  return { paths: PLATFORMS.map(p => ({ params: { slug: p.slug } })), fallback: false }
}

export async function getStaticProps({ params }) {
  const platform = getPlatform(params.slug)
  if (!platform) return { notFound: true }
  // Related first: the same kind of platform, then the rest.
  const others = PLATFORMS.filter(p => p.slug !== platform.slug)
    .sort((a, b) => (a.kind === platform.kind ? 0 : 1) - (b.kind === platform.kind ? 0 : 1))
    .map(({ slug, name, kind }) => ({ slug, name, kind }))
  return { props: { platform, others } }
}

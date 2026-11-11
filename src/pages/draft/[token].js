/** @jsxImportSource @emotion/react */
import Head from 'next/head'
import Link from 'next/link'
import { css } from '@emotion/react'
import { EyeNoneIcon } from '@radix-ui/react-icons'

import { getSharedDraft } from '../../lib/draft-share'
import { sanitizePostHtml } from '../../lib/sanitize-post'
import { calculateReadingTime, cleanTitle } from '../../lib/seo-utils'

import Container from '../../components/container'
import PostContainer from '../../components/post-container'
import ThemeToggle from '../../components/theme-toggle'

/**
 * /draft/[token] — a draft its writer shared by private link.
 *
 * Looks like the published post (same width, title, byline and body styles)
 * so whoever is giving feedback sees what readers will see. It leaves out
 * everything that belongs to a published post: views, likes, the reading
 * list, the newsletter sign-up, feeds and search-engine data. Search engines
 * are told to stay away.
 */
export default function SharedDraft({ draft, fontSettings, customFonts }) {
  const title = cleanTitle(draft.title) || 'Untitled'
  const readingTime = calculateReadingTime(draft.content)
  const formattedDate = draft.lastEdited
    ? new Date(draft.lastEdited).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : null

  return (
    <>
      <Head>
        <title>{`Draft: ${title} / Bublr`}</title>
        <meta name="robots" content="noindex, nofollow, noarchive" />
        {/* Don't hand the private link to sites the draft links out to */}
        <meta name="referrer" content="no-referrer" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,600;1,400;1,600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono&display=swap"
          rel="stylesheet"
        />
        {customFonts && customFonts.length > 0 && (
          <link
            href={`https://fonts.googleapis.com/css2?${customFonts
              .map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
              .join('&')}&display=swap`}
            rel="stylesheet"
          />
        )}
      </Head>

      {/* Same sticky chrome as the writer's own preview */}
      <div
        css={css`
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.5rem 1rem;
          background: var(--muted);
          border-bottom: 1px dashed var(--border-dashed);
          backdrop-filter: blur(8px);
          font-family: 'Inter', sans-serif;
        `}
      >
        <div css={css`display: flex; flex-direction: column; gap: 0.15rem; min-width: 0;`}>
          <span
            css={css`
              display: inline-flex;
              align-items: center;
              gap: 0.4rem;
              font-size: 0.7rem;
              font-weight: 500;
              color: var(--grey-3);
              text-transform: uppercase;
              letter-spacing: 0.12em;
            `}
          >
            <EyeNoneIcon width={11} height={11} />
            Private draft
          </span>
          <span css={css`font-size: 0.72rem; color: var(--grey-3); line-height: 1.4;`}>
            Not published yet. Only people with this link can read it.
          </span>
        </div>
        <ThemeToggle />
      </div>

      <Container maxWidth="640px">
        <article>
          <header>
            <h1
              css={css`
                font-size: 1.75rem;
                letter-spacing: -0.02em;
                line-height: 1.35;
                margin-bottom: 1rem;
              `}
            >
              {title}
            </h1>
          </header>

          <div
            css={css`
              display: flex;
              align-items: center;
              color: var(--grey-3);
              margin-bottom: 2rem;
            `}
          >
            {draft.author.photo && (
              <img
                src={draft.author.photo}
                alt={`${draft.author.displayName}'s profile picture`}
                width="32"
                height="32"
                loading="eager"
                css={css`
                  width: 2rem;
                  height: 2rem;
                  border-radius: 1rem;
                  margin-right: 1rem;
                  object-fit: cover;
                `}
              />
            )}
            <p>
              {draft.author.name ? (
                <Link href={`/${draft.author.name}`}>
                  <a
                    style={{
                      color: 'inherit',
                      textDecoration: 'none',
                      borderBottom: '1px dotted var(--grey-2)',
                    }}
                  >
                    {draft.author.displayName}
                  </a>
                </Link>
              ) : (
                draft.author.displayName
              )}
              {formattedDate && <> / <time>{formattedDate}</time></>}
              {' '} / {readingTime} min read
            </p>
          </div>

          {draft.content.trim() ? (
            <PostContainer
              textDirection={draft.textDirection}
              fontSettings={fontSettings}
              dangerouslySetInnerHTML={{
                __html: sanitizePostHtml(draft.content),
              }}
              css={css`
                margin-bottom: 2rem;
              `}
            />
          ) : (
            <p css={css`color: var(--grey-3); margin-bottom: 2rem;`}>
              Nothing written here yet.
            </p>
          )}
        </article>
      </Container>
    </>
  )
}

SharedDraft.getLayout = function SharedDraftLayout(page) {
  return page
}

export async function getServerSideProps({ params, res }) {
  // Private page: keep it out of search engines and shared caches
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')

  try {
    const result = await getSharedDraft(params.token)
    if (!result) return { notFound: true }
    if (result.redirect) {
      return { redirect: { destination: result.redirect, permanent: false } }
    }
    return { props: result }
  } catch (err) {
    console.error('Shared draft error:', err)
    return { notFound: true }
  }
}

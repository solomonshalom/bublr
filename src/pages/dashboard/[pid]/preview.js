/** @jsxImportSource @emotion/react */
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { css } from '@emotion/react'
import sanitize from 'sanitize-html'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useDocumentData } from 'react-firebase-hooks/firestore'
import { ArrowLeftIcon, EyeOpenIcon } from '@radix-ui/react-icons'

import { auth, firestore } from '../../../lib/firebase'
import { calculateReadingTime, cleanTitle } from '../../../lib/seo-utils'
import { sanitizeFontFamily } from '../../../lib/fonts'

import Container from '../../../components/container'
import PostContainer from '../../../components/post-container'
import ThemeToggle from '../../../components/theme-toggle'
import { LoadingContainer } from '../../../components/loading-container'
import { LinkIconButton } from '../../../components/button'

/**
 * /dashboard/[pid]/preview — full-page preview that mirrors the public
 * /[username]/[slug] view 1:1 (same Container width, same h1, same author
 * meta row, same PostContainer styling). Side-effecting widgets (view counter,
 * like button, reading-list add) are intentionally omitted so the preview
 * doesn't pollute real engagement metrics for an in-progress draft.
 *
 * Auth: only the post's author can preview it.
 */
export default function PostPreview() {
  const router = useRouter()
  const { pid } = router.query
  const [user, userLoading] = useAuthState(auth)

  const [post, postLoading] = useDocumentData(
    pid && typeof pid === 'string' ? firestore.doc(`posts/${pid}`) : null,
    { idField: 'id' }
  )

  const [authorUser, authorLoading] = useDocumentData(
    post?.author ? firestore.doc(`users/${post.author}`) : null,
    { idField: 'id' }
  )

  // Redirect unauthenticated visitors to the landing page
  useEffect(() => {
    if (!user && !userLoading) {
      router.push('/')
    }
  }, [user, userLoading, router])

  // Only the post's author can preview their own draft / post
  useEffect(() => {
    if (post && user && post.author !== user.uid) {
      router.push('/')
    }
  }, [post, user, router])

  if (!post || !authorUser || postLoading || authorLoading) {
    return (
      <LoadingContainer isLoading={true}>
        <div css={css`min-height: 400px;`} />
      </LoadingContainer>
    )
  }

  const cleanedTitle = cleanTitle(post.title) || 'Untitled'
  const readingTime = calculateReadingTime(post.content)
  const editedDate = post.lastEdited?.toDate
    ? post.lastEdited.toDate()
    : (post.lastEdited ? new Date(post.lastEdited) : new Date())
  const formattedDate = editedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const fontSettings = {
    headingFont: sanitizeFontFamily(
      post.fontOverrides?.headingFont || authorUser.fontSettings?.headingFont,
      'Inter'
    ),
    bodyFont: sanitizeFontFamily(
      post.fontOverrides?.bodyFont || authorUser.fontSettings?.bodyFont,
      'Inter'
    ),
    codeFont: sanitizeFontFamily(
      post.fontOverrides?.codeFont || authorUser.fontSettings?.codeFont,
      'JetBrains Mono'
    ),
  }

  return (
    <>
      <Head>
        <title>Preview: {cleanedTitle} / Bublr</title>
        <meta name="robots" content="noindex, nofollow" />
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,600;1,400;1,600&display=swap"
          as="style"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,600;1,400;1,600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* Preview banner — chord-style sticky chrome with back-to-editor */}
      <div
        css={css`
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: var(--muted);
          border-bottom: 1px dashed var(--border-dashed);
          backdrop-filter: blur(8px);
          font-family: 'Inter', sans-serif;
        `}
      >
        <div css={css`display: flex; align-items: center; gap: 0.5rem;`}>
          <LinkIconButton href={`/dashboard/${pid}`} aria-label="Back to editor">
            <ArrowLeftIcon />
          </LinkIconButton>
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
            <EyeOpenIcon width={11} height={11} />
            Preview Mode
          </span>
        </div>
        <ThemeToggle />
      </div>

      {/* Article — mirrors /[username]/[slug] structure exactly so the author
          sees the same layout, typography, and spacing readers will see. */}
      <Container maxWidth="640px">
        <article itemScope itemType="https://schema.org/BlogPosting">
          <header>
            <h1
              itemProp="headline"
              css={css`
                font-size: 1.75rem;
                letter-spacing: -0.02em;
                line-height: 1.35;
                margin-bottom: 1rem;
              `}
            >
              {cleanedTitle}
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
            {authorUser.photo && (
              <img
                src={authorUser.photo}
                alt={`${authorUser.displayName || 'Author'}'s profile picture`}
                width="32"
                height="32"
                loading="eager"
                itemProp="image"
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
              <span itemProp="author" itemScope itemType="https://schema.org/Person">
                <Link href={`/${authorUser.name}`}>
                  <a
                    itemProp="url"
                    style={{
                      color: 'inherit',
                      textDecoration: 'none',
                      borderBottom: '1px dotted var(--grey-2)',
                    }}
                  >
                    <span itemProp="name">{authorUser.displayName}</span>
                  </a>
                </Link>
              </span>{' '}
              / <time>{formattedDate}</time>
              {' '} / {readingTime} min read
            </p>
          </div>

          <PostContainer
            itemProp="articleBody"
            textDirection={post.textDirection || 'auto'}
            fontSettings={fontSettings}
            dangerouslySetInnerHTML={{
              __html: sanitize(post.content || '', {
                allowedTags: sanitize.defaults.allowedTags.concat(['img']),
              }),
            }}
            css={css`
              margin-bottom: 2rem;
            `}
          />
        </article>
      </Container>
    </>
  )
}

PostPreview.getLayout = function PostPreviewLayout(page) {
  return page
}

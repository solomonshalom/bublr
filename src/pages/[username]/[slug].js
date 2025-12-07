/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import Head from 'next/head'
import { css } from '@emotion/react'
import sanitize from 'sanitize-html'
import { htmlToText } from 'html-to-text'
import { useState, useEffect, useRef } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'

import firebase, { firestore, auth } from '../../lib/firebase'
import { getPostByUsernameAndSlug, getUserByID } from '../../lib/db'
import {
  extractFirstImage,
  calculateReadingTime,
  getWordCount,
  generateMetaDescription,
  generateKeywords,
  cleanTitle,
  generateBlogPostingSchema,
  generateBreadcrumbSchema
} from '../../lib/seo-utils'

import meta from '../../components/meta'
import Container from '../../components/container'
import { IconButton } from '../../components/button'
import PostContainer from '../../components/post-container'
import CommunityNotes, { CommunityNotesIcon } from '../../components/community-notes'
import Comments from '../../components/comments'
import ThemeToggle from '../../components/theme-toggle'
import ReadingProgressBar from '../../components/reading-progress-bar'

const SITE_URL = 'https://bublr.life'

// View counter component
function ViewCounter({ postId }) {
  const [views, setViews] = useState(null)
  const didLogViewRef = useRef(false)

  useEffect(() => {
    // Get initial view count
    fetch(`/api/view?id=${encodeURIComponent(postId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.viewsFormatted) {
          setViews(data.viewsFormatted)
        }
      })
      .catch(console.error)

    // Increment view count (only once per page load, not in dev)
    if (!didLogViewRef.current) {
      fetch(`/api/view?id=${encodeURIComponent(postId)}&incr=1`)
        .then(res => res.json())
        .then(data => {
          if (data.viewsFormatted) {
            setViews(data.viewsFormatted)
          }
        })
        .catch(console.error)
      didLogViewRef.current = true
    }
  }, [postId])

  if (views === null) return null

  return (
    <span
      css={css`
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: var(--grey-3);
        font-size: 0.85rem;
      `}
    >
      {/* Eye icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {views} views
    </span>
  )
}

function AddToReadingListButton({ uid, pid }) {
  const [user, setUser] = useState({ readingList: [] })
  const [inList, setInList] = useState(false)

  useEffect(() => {
    ;(async () => {
      const data = await getUserByID(uid)
      setUser(data)
    })()
  }, [uid])

  useEffect(() => {
    setInList(user.readingList.includes(pid))
  }, [pid, user])

  return (
    <IconButton
      css={css`
        margin-left: auto;
      `}
      onClick={async () => {
        const arrayAdd = firebase.firestore.FieldValue.arrayUnion
        const arrayRemove = firebase.firestore.FieldValue.arrayRemove

        await firestore
          .collection('users')
          .doc(uid)
          .update({
            readingList: inList ? arrayRemove(pid) : arrayAdd(pid),
          })

        setUser({
          ...user,
          readingList: inList
            ? user.readingList.filter(id => id != pid)
            : [...user.readingList, pid],
        })
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="1.5rem"
        height="1.5rem"
        fill="var(--grey-3)"
        viewBox="0 0 256 256"
      >
        <rect width="256" height="256" fill="none"></rect>
        {inList ? (
          // Outline reading list icon
          <path d="M192,24H96A16.01833,16.01833,0,0,0,80,40V56H64A16.01833,16.01833,0,0,0,48,72V224a8.00026,8.00026,0,0,0,12.65039,6.50977l51.34277-36.67872,51.35743,36.67872A7.99952,7.99952,0,0,0,176,224V184.6897l19.35059,13.82007A7.99952,7.99952,0,0,0,208,192V40A16.01833,16.01833,0,0,0,192,24Zm0,152.45508-16-11.42676V72a16.01833,16.01833,0,0,0-16-16H96V40h96Z"></path>
        ) : (
          // Filled in reading list icon
          <>
            <path
              d="M168,224l-56.0074-40L56,224V72a8,8,0,0,1,8-8h96a8,8,0,0,1,8,8Z"
              fill="none"
              stroke="var(--grey-3)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="16"
            ></path>
            <path
              d="M88,64V40a8,8,0,0,1,8-8h96a8,8,0,0,1,8,8V192l-32-22.85412"
              fill="none"
              stroke="var(--grey-3)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="16"
            ></path>
          </>
        )}
      </svg>
    </IconButton>
  )
}

export default function Post({ post, seo }) {
  const [user, _loading, _error] = useAuthState(auth)
  const [showCommunityNotes, setShowCommunityNotes] = useState(false)
  const [hasNotes, setHasNotes] = useState(false)

  // Fetch notes count on mount
  useEffect(() => {
    fetch(`/api/notes?postId=${encodeURIComponent(post.id)}`)
      .then(res => res.json())
      .then(data => {
        setHasNotes((data.approvedNotes || []).length > 0)
      })
      .catch(console.error)
  }, [post.id])

  const formattedDate = new Date(post.lastEdited).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Get post color for the progress bar
  const postColor = post.dotColor || '#4D96FF'

  return (
    <Container maxWidth="640px">
      {/* Reading Progress Bar */}
      <ReadingProgressBar color={postColor} />

      <Head>
        {meta({
          title: seo.title,
          description: seo.description,
          url: seo.url,
          image: seo.image,
          type: 'article',
          keywords: seo.keywords,
          author: seo.authorUrl,
          publishedTime: seo.publishedTime,
          modifiedTime: seo.modifiedTime,
          readingTime: seo.readingTime,
          section: 'Blog'
        })}

        {/* Canonical URL */}
        <link rel="canonical" href={seo.canonicalUrl} />

        {/* Preload fonts for better LCP */}
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

        {/* BlogPosting structured data for rich snippets */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.blogPostingSchema) }}
        />

        {/* Breadcrumb structured data for navigation */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.breadcrumbSchema) }}
        />
      </Head>

      {/* Semantic article structure for SEO */}
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
            {seo.cleanTitle}
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
          <img
            src={post.author.photo}
            alt={`${post.author.displayName}'s profile picture`}
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
          <p>
            <span itemProp="author" itemScope itemType="https://schema.org/Person">
              <Link href={`/${post.author.name}`}>
                <a
                  itemProp="url"
                  style={{
                    color: 'inherit',
                    textDecoration: 'none',
                    borderBottom: `1px dotted var(--grey-2)`,
                  }}
                >
                  <span itemProp="name">{post.author.displayName}</span>
                </a>
              </Link>
            </span>{' '}
            / <time itemProp="datePublished" dateTime={seo.publishedTime}>{formattedDate}</time>
          </p>
          <meta itemProp="dateModified" content={seo.modifiedTime} />
        </div>

        <PostContainer
          itemProp="articleBody"
          dangerouslySetInnerHTML={{
            __html: sanitize(post.content, {
              allowedTags: sanitize.defaults.allowedTags.concat(['img']),
            }),
          }}
          css={css`
            margin-bottom: 2rem;
          `}
        />
      </article>

      {/* Footer with view counter, theme toggle, community notes icon, and bookmark */}
      <footer
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--grey-2);
        `}
      >
        <ViewCounter postId={post.id} />
        <div css={css`display: flex; align-items: center; gap: 0.5rem; margin-left: auto;`}>
          <ThemeToggle />
          <CommunityNotesIcon
            onClick={() => setShowCommunityNotes(!showCommunityNotes)}
            hasNotes={hasNotes}
          />
          {user && <AddToReadingListButton uid={user.uid} pid={post.id} />}
        </div>
      </footer>

      {/* Community Notes (expanded/collapsed) */}
      {showCommunityNotes && (
        <CommunityNotes
          postId={post.id}
          isExpanded={showCommunityNotes}
        />
      )}

      {/* Comments Section */}
      <Comments postId={post.id} />
    </Container>
  )
}

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export async function getStaticProps({ params }) {
  const { username, slug } = params

  try {
    const post = await getPostByUsernameAndSlug(username, slug)
    if (!post.published) {
      return { notFound: true }
    }
    const userDoc = await firestore.collection('users').doc(post.author).get()
    post.author = userDoc.data()
    const lastEditedTime = post.lastEdited.toDate().getTime()
    post.lastEdited = lastEditedTime

    // Generate comprehensive SEO data
    const postTitle = cleanTitle(post.title)
    const postUrl = `${SITE_URL}/${post.author.name}/${post.slug}`
    const authorUrl = `${SITE_URL}/${post.author.name}`
    const publishedTime = new Date(lastEditedTime).toISOString()
    const readingTime = calculateReadingTime(post.content)
    const wordCount = getWordCount(post.content)
    const description = generateMetaDescription(post.excerpt, post.content)
    const keywords = generateKeywords(post.title, post.content, post.author.displayName)

    // Extract first image from content, or fall back to author photo
    const firstImage = extractFirstImage(post.content)
    const ogImage = firstImage || post.author.photo

    // Generate structured data schemas
    const blogPostingSchema = generateBlogPostingSchema({
      title: postTitle,
      description,
      content: post.content,
      url: postUrl,
      imageUrl: ogImage,
      authorName: post.author.displayName,
      authorUrl,
      authorImage: post.author.photo,
      datePublished: publishedTime,
      dateModified: publishedTime,
      wordCount,
      readingTime
    })

    const breadcrumbSchema = generateBreadcrumbSchema([
      { name: 'Home', url: SITE_URL },
      { name: post.author.displayName, url: authorUrl },
      { name: postTitle, url: postUrl }
    ])

    const seo = {
      title: `${postTitle} - ${post.author.displayName} | Bublr`,
      cleanTitle: postTitle,
      description,
      keywords,
      url: `/${post.author.name}/${post.slug}`,
      canonicalUrl: postUrl,
      image: ogImage,
      authorUrl,
      publishedTime,
      modifiedTime: publishedTime,
      readingTime,
      wordCount,
      blogPostingSchema,
      breadcrumbSchema
    }

    return {
      props: { post, seo },
      revalidate: 60, // Revalidate at most once per minute
    }
  } catch (err) {
    console.log(err)
    return { notFound: true }
  }
}

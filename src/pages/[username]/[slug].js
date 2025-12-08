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
  generateEnhancedBlogPostingSchema,
  generateBreadcrumbSchema,
  extractFAQsFromContent,
  generateFAQSchema
} from '../../lib/seo-utils'

// Static Organization schema for posts (defined at module level for SSR compatibility)
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://bublr.life/#organization',
  'name': 'Bublr',
  'url': 'https://bublr.life',
  'logo': {
    '@type': 'ImageObject',
    'url': 'https://bublr.life/images/logo.png',
    'width': 512,
    'height': 512
  },
  'description': 'An open-source, ultra-minimal community for writers to share their thoughts, stories, and ideas without ads or paywalls.',
  'foundingDate': '2024',
  'sameAs': ['https://github.com/bublr'],
  'contactPoint': {
    '@type': 'ContactPoint',
    'contactType': 'customer support',
    'url': 'https://bublr.life/about'
  }
}

import meta from '../../components/meta'
import Container from '../../components/container'
import { IconButton } from '../../components/button'
import PostContainer from '../../components/post-container'
import ThemeToggle from '../../components/theme-toggle'
import TranslateModal from '../../components/translate-modal'

const SITE_URL = 'https://bublr.life'

function ViewCounter({ postId, initialViews }) {
  const [views, setViews] = useState(initialViews || 0)
  const didLogViewRef = useRef(false)

  useEffect(() => {
    // Only increment view once per page load
    if (!didLogViewRef.current) {
      fetch(`/api/views/${postId}`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.views) setViews(data.views)
        })
        .catch(console.error)
      didLogViewRef.current = true
    }
  }, [postId])

  return (
    <span
      css={css`
        display: flex;
        align-items: center;
        gap: 0.35rem;
        color: var(--grey-3);
        font-size: 0.85rem;
      `}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="1.1rem"
        height="1.1rem"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
      {views}
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
    <button
      css={css`
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
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
        width="1.1rem"
        height="1.1rem"
        fill="var(--grey-3)"
        viewBox="0 0 256 256"
        css={css`display: block;`}
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
    </button>
  )
}

export default function Post({ post, seo }) {
  const [user, _loading, _error] = useAuthState(auth)

  const formattedDate = new Date(post.lastEdited).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <Container maxWidth="640px">

      <Head>
        {meta({
          title: seo.title,
          description: seo.description,
          url: seo.url,
          image: seo.image,
          type: 'article',
          keywords: seo.keywords,
          author: seo.authorUrl,
          authorName: post.author.displayName,
          publishedTime: seo.publishedTime,
          modifiedTime: seo.modifiedTime,
          readingTime: seo.readingTime,
          wordCount: seo.wordCount,
          section: 'Blog',
          // GEO-specific fields for AI citation
          citationTitle: seo.cleanTitle,
          citationAuthor: post.author.displayName,
          citationDate: seo.publishedTime
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

        {/* Organization schema - critical for E-E-A-T */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />

        {/* BlogPosting structured data with Speakable for voice search and AI */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.blogPostingSchema) }}
        />

        {/* Breadcrumb structured data for navigation */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.breadcrumbSchema) }}
        />

        {/* FAQ schema if content contains Q&A patterns */}
        {seo.faqSchema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.faqSchema) }}
          />
        )}
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
            {' '} / {seo.readingTime} min read
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

      {/* Footer with views on left, theme toggle and bookmark on right */}
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
        <ViewCounter postId={post.id} initialViews={post.views} />
        <div css={css`display: flex; align-items: center; gap: 0.75rem;`}>
          <ThemeToggle />
          <TranslateModal title={post.title} content={post.content} />
          {user && <AddToReadingListButton uid={user.uid} pid={post.id} />}
        </div>
      </footer>
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

    // Generate structured data schemas with GEO optimizations
    const blogPostingSchema = generateEnhancedBlogPostingSchema({
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
      readingTime,
      keywords
    })

    const breadcrumbSchema = generateBreadcrumbSchema([
      { name: 'Home', url: SITE_URL },
      { name: post.author.displayName, url: authorUrl },
      { name: postTitle, url: postUrl }
    ])

    // Extract FAQs from content for FAQ schema (GEO optimization)
    const faqs = extractFAQsFromContent(post.content)
    const faqSchema = faqs.length > 0 ? generateFAQSchema(faqs) : null

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
      breadcrumbSchema,
      faqSchema
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

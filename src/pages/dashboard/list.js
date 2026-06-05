/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import { css } from '@emotion/react'
import { htmlToText } from 'html-to-text'
import { useState, useEffect } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'

import { formatDate } from '../../lib/utils'
import { firestore, auth } from '../../lib/firebase'
import { getPostByID, getUserByID } from '../../lib/db'
import { LoadingContainer } from '../../components/loading-container'
import { AnimatedList, AnimatedListItem } from '../../components/animated-list'

import DashboardLayout, {
  DashboardBody,
  useSidebar,
} from '../../components/dashboard/dashboard-layout'
import PageHeader from '../../components/dashboard/page-header'

const emptyStateStyle = css`
  border: 1px dashed var(--border-dashed);
  border-radius: 6px;
  padding: 2.5rem 1.5rem;
  text-align: center;
  color: var(--grey-3);
  font-size: 0.9rem;
  line-height: 1.55;
  background: var(--accent-bg);

  p + p {
    margin-top: 0.5rem;
  }

  b {
    color: var(--grey-4);
    font-weight: 500;
  }
`

const summaryStyle = css`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0.25rem 0 1.25rem 0;
  color: var(--grey-3);
  font-size: 0.85rem;
`

const countStyle = css`
  color: var(--grey-4);
  font-size: 0.95rem;
`

const listStyle = css`
  list-style: none;
  margin: 0;
  padding: 0;
`

const itemStyle = css`
  border-bottom: 1px dashed var(--border-dashed);

  &:last-of-type {
    border-bottom: none;
  }
`

const linkStyle = css`
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 0.85rem 0.65rem;
  margin: 0 -0.65rem;
  border-radius: 6px;
  text-decoration: none;
  color: inherit;
  transition: background 150ms ease, color 150ms ease;

  @media (max-width: 720px) {
    align-items: flex-start;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &:hover {
    background: var(--accent-soft);

    .reading-title {
      color: var(--accent-foreground);
    }

    .open-icon {
      opacity: 1;
      color: var(--accent-foreground);
    }
  }
`

const dateStyle = css`
  flex-shrink: 0;
  width: 8.25rem;
  font-size: 0.8rem;
  color: var(--grey-3);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  @media (max-width: 720px) {
    width: auto;
    font-size: 0.75rem;
    white-space: normal;
  }
`

const authorChipStyle = css`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--grey-3);
  max-width: 9rem;
  min-width: 0;
`

const avatarStyle = css`
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 50%;
  flex-shrink: 0;
  background: transparent;
  object-fit: cover;
`

const authorNameStyle = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const titleStyle = css`
  flex: 1;
  min-width: 0;
  font-size: 0.95rem;
  font-weight: 400;
  color: var(--grey-4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 150ms ease;

  @media (max-width: 720px) {
    flex: 1 1 100%;
    white-space: normal;
  }
`

const openIconStyle = css`
  flex-shrink: 0;
  opacity: 0;
  color: var(--grey-3);
  transition: opacity 150ms ease, color 150ms ease;

  @media (max-width: 720px) {
    display: none;
  }
`

const ExternalArrowIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M3.5 3a.5.5 0 0 0 0 1h6.793L3.146 11.146a.5.5 0 1 0 .708.708L11 4.707V11.5a.5.5 0 0 0 1 0v-8a.5.5 0 0 0-.5-.5h-8z" fill="currentColor"/>
  </svg>
)

function safeFormatDate(post) {
  const ts = post.lastEdited
  if (!ts) return ''
  try {
    if (typeof ts.toDate === 'function') return formatDate(ts.toDate())
    return formatDate(ts)
  } catch (e) {
    return ''
  }
}

function List({ uid }) {
  const [list, setList] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    ;(async () => {
      try {
        const user = await getUserByID(uid)
        if (!user?.readingList?.length) {
          setList([])
          return
        }
        const postPromises = user.readingList.map(async pid => {
          const post = await getPostByID(pid)
          const author = await firestore
            .collection('users')
            .doc(post.author)
            .get()
          post.author = author.data()
          return post
        })
        const posts = await Promise.all(postPromises)
        setList(posts)
      } catch (err) {
        console.error('Error loading reading list:', err)
        setList([])
      } finally {
        setIsLoading(false)
      }
    })()
  }, [uid])

  if (isLoading) {
    return (
      <LoadingContainer isLoading={true}>
        <div css={css`min-height: 200px;`} />
      </LoadingContainer>
    )
  }

  if (list.length === 0) {
    return (
      <div css={emptyStateStyle}>
        <p>Your reading list is empty.</p>
        <p>
          Open <b>Explore</b> and bookmark posts you want to come back to.
        </p>
      </div>
    )
  }

  return (
    <>
      <div css={summaryStyle}>
        <span css={countStyle}>
          {list.length} {list.length === 1 ? 'post' : 'posts'}
        </span>
        <span>Saved for later.</span>
      </div>

      <AnimatedList css={listStyle}>
        {list.map(post => (
          <AnimatedListItem key={post.id} css={itemStyle}>
            <Link href={`/${post.author.name}/${post.slug}`}>
              <a css={linkStyle}>
                <span css={dateStyle}>{safeFormatDate(post)}</span>
                <span css={authorChipStyle}>
                  {post.author.photo && (
                    <img
                      src={post.author.photo}
                      alt=""
                      data-pfp="true"
                      css={avatarStyle}
                    />
                  )}
                  <span css={authorNameStyle}>
                    {post.author.displayName}
                  </span>
                </span>
                <span className="reading-title" css={titleStyle}>
                  {post.title ? htmlToText(post.title) : 'Untitled'}
                </span>
                <span className="open-icon" css={openIconStyle}>
                  <ExternalArrowIcon />
                </span>
              </a>
            </Link>
          </AnimatedListItem>
        ))}
      </AnimatedList>
    </>
  )
}

function ReadingListContent() {
  const { toggle } = useSidebar()
  const [user, userLoading, userError] = useAuthState(auth)

  return (
    <>
      <PageHeader title="Reading List" onToggleSidebar={toggle} />
      <DashboardBody>
        {userError ? (
          <div css={emptyStateStyle}>
            Something went wrong loading your reading list.
          </div>
        ) : (
          <LoadingContainer isLoading={!user || userLoading}>
            {user && <List uid={user.uid} />}
          </LoadingContainer>
        )}
      </DashboardBody>
    </>
  )
}

export default function ReadingList() {
  return <ReadingListContent />
}

ReadingList.getLayout = function ReadingListPageLayout(page) {
  return <DashboardLayout pageTitle="Reading List">{page}</DashboardLayout>
}

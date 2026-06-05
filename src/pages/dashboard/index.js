/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { css } from '@emotion/react'
import { useRouter } from 'next/router'
import { htmlToText } from 'html-to-text'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useCollectionData } from 'react-firebase-hooks/firestore'

import { createPostForUser } from '../../lib/db'
import { firestore, auth } from '../../lib/firebase'

import Search from '../../components/search'
import { formatDate } from '../../lib/utils'
import { LoadingContainer } from '../../components/loading-container'
import { AnimatedList, AnimatedListItem } from '../../components/animated-list'

import DashboardLayout, {
  DashboardBody,
  useSidebar,
} from '../../components/dashboard/dashboard-layout'
import PageHeader from '../../components/dashboard/page-header'
import ShortcutButton from '../../components/dashboard/shortcut-button'

const searchWrapStyle = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin: 0.25rem 0 1.5rem 0;
`

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

const listStyle = css`
  list-style: none;
  margin: 0;
  padding: 0;
`

const itemStyle = css`
  display: flex;
  align-items: baseline;
  gap: 1.25rem;
  padding: 0.85rem 0;
  border-bottom: 1px dashed var(--border-dashed);

  &:last-of-type {
    border-bottom: none;
  }

  @media (max-width: 720px) {
    flex-direction: column;
    gap: 0.4rem;
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
  }
`

const linkStyle = css`
  flex: 1;
  font-size: 0.95rem;
  color: var(--grey-4);
  text-decoration: none;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;

  &:hover {
    color: var(--grey-5);
  }
`

const draftBadgeStyle = css`
  display: inline-block;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--grey-3);
  background: var(--accent-bg-strong);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.05rem 0.35rem;
  line-height: 1.4;
`

function PostsContent() {
  const router = useRouter()
  const { toggle } = useSidebar()

  const [user] = useAuthState(auth)
  const [posts, postsLoading, postsError] = useCollectionData(
    firestore.collection('posts').where('author', '==', user ? user.uid : ''),
    { idField: 'id' },
  )
  const [filteredPosts, setFilteredPosts] = useState([])
  const [searchInput, setSearchInput] = useState('')

  useEffect(() => {
    setFilteredPosts(posts)
  }, [posts])

  const handleCreatePost = async () => {
    if (!user) return
    try {
      const newId = await createPostForUser(user.uid)
      router.push(`/dashboard/${newId}`)
    } catch (err) {
      console.error('Failed to create post', err)
    }
  }

  return (
    <>
      <PageHeader
        title="Posts"
        onToggleSidebar={toggle}
        actions={
          <ShortcutButton
            letter="C"
            label="Create Post"
            onClick={handleCreatePost}
            aria-label="Create new post (C)"
          />
        }
      />
      <DashboardBody>
        {postsError ? (
          <div css={emptyStateStyle}>
            <p>Something went wrong loading your posts.</p>
            <pre>{JSON.stringify(postsError)}</pre>
          </div>
        ) : (
          <>
            {posts && posts.length > 0 && (
              <div css={searchWrapStyle}>
                <Search
                  variant="dashboard"
                  posts={posts}
                  isGlobalSearch={false}
                  getFilteredPosts={setFilteredPosts}
                  getSearchInput={value => setSearchInput(value)}
                />
              </div>
            )}

            {!posts || postsLoading ? (
              <LoadingContainer isLoading={true}>
                <div css={css`min-height: 200px;`} />
              </LoadingContainer>
            ) : posts.length === 0 ? (
              <div css={emptyStateStyle}>
                <p>Welcome to Bublr.</p>
                <p>
                  Press <b>C</b> or click <b>Create Post</b> to start writing.
                </p>
              </div>
            ) : filteredPosts?.length === 0 && searchInput.length > 0 ? (
              <div css={emptyStateStyle}>
                <p>Nothing matches your search.</p>
              </div>
            ) : (
              <AnimatedList css={listStyle}>
                {[...(filteredPosts || [])]
                  .sort(
                    (a, b) =>
                      b.lastEdited.toDate().getTime() -
                      a.lastEdited.toDate().getTime(),
                  )
                  .map(post => (
                    <AnimatedListItem key={post.id} css={itemStyle}>
                      <time css={dateStyle}>
                        {formatDate(post.lastEdited.toDate())}
                      </time>
                      <Link href={`/dashboard/${post.id}`}>
                        <a css={linkStyle}>
                          {!post.published && (
                            <span css={draftBadgeStyle}>Draft</span>
                          )}
                          {post.title ? htmlToText(post.title) : 'Untitled'}
                        </a>
                      </Link>
                    </AnimatedListItem>
                  ))}
              </AnimatedList>
            )}
          </>
        )}
      </DashboardBody>
    </>
  )
}

export default function Dashboard() {
  return <PostsContent />
}

Dashboard.getLayout = function DashboardPageLayout(page) {
  return <DashboardLayout pageTitle="Posts">{page}</DashboardLayout>
}

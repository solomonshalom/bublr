/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { css } from '@emotion/react'
import { useRouter } from 'next/router'
import { htmlToText } from 'html-to-text'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useCollectionData } from 'react-firebase-hooks/firestore'

import { searchPosts } from '../../lib/db'
import { firestore, auth } from '../../lib/firebase'

import Button from '../../components/button'
import Header from '../../components/header'
import Spinner from '../../components/spinner'
import Container from '../../components/container'
import Search from '../../components/search'
import ProfileSettingsModal from '../../components/profile-settings-modal'
import ThemeToggle from '../../components/theme-toggle'
import NotificationsPanel, { NotificationsTrigger } from '../../components/notifications-panel'
import { truncate } from '../../lib/utils'
import { getPostByID } from '../../lib/db'
import meta from '../../components/meta'

// Static schema for explore page (defined at module level for SSR compatibility)
const collectionPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  'name': 'Explore Writing',
  'description': 'Discover inspiring stories, articles, and blog posts from writers around the world.',
  'url': 'https://bublr.life/explore',
  'isPartOf': { '@id': 'https://bublr.life/#website' },
  'about': { '@type': 'Thing', 'name': 'Writing and Blog Posts' },
  'inLanguage': 'en-US'
}

export default function Explore() {
  const router = useRouter()

  const [user, userLoading, userError] = useAuthState(auth);
  const [explorePosts, setExplorePosts] = useState([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread count
  useEffect(() => {
    if (!user) return

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch(`/api/notifications?userId=${user.uid}&limit=1`)
        const data = await response.json()
        if (response.ok) {
          setUnreadCount(data.unreadCount || 0)
        }
      } catch (err) {
        console.error('Failed to fetch unread count:', err)
      }
    }

    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [user]);

  useEffect(() => {
    if (!user && !userLoading && !userError) {
      router.push('/')
      return
    }
  }, [router, user, userLoading, userError]);

  // Load initial posts on component mount
  useEffect(() => {
    if (user && !userLoading) {
      loadInitialPosts();
    }
  }, [user, userLoading]);

  const loadInitialPosts = async () => {
    if (isSearchLoading) return; // Prevent multiple simultaneous calls
    
    setIsSearchLoading(true);
    try {
      // Try to use orderBy for better performance if possible
      let query = firestore.collection('posts');
      
      try {
        // Try with compound query first (requires index)
        const snapshot = await query
          .where('published', '==', true)
          .orderBy('lastEdited', 'desc')
          .limit(20)
          .get();
        
        const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const postsWithAuthors = await setPostAuthorProfilePics(posts);
        setExplorePosts(postsWithAuthors);
        setHasSearched(false);
        
      } catch (compoundError) {
        console.warn('Compound query failed, using fallback:', compoundError);
        
        // Fallback: Get published posts without ordering
        const publishedSnapshot = await query
          .where('published', '==', true)
          .limit(30)
          .get();
        
        const publishedPosts = publishedSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const aTime = a.lastEdited?.toMillis?.() || a.lastEdited?.toDate?.()?.getTime?.() || a.createdAt || 0;
            const bTime = b.lastEdited?.toMillis?.() || b.lastEdited?.toDate?.()?.getTime?.() || b.createdAt || 0;
            return bTime - aTime;
          })
          .slice(0, 20);
        
        const postsWithAuthors = await setPostAuthorProfilePics(publishedPosts);
        setExplorePosts(postsWithAuthors);
        setHasSearched(false);
      }
      
    } catch (error) {
      console.error('Error loading initial posts:', error);
      setExplorePosts([]);
    } finally {
      setIsSearchLoading(false);
    }
  };

  // Set the profile pics for each author using batch requests
  const setPostAuthorProfilePics = async(posts) => {
    if (!posts || posts.length === 0) return [];
    
    try {
      // Get unique author IDs
      const uniqueAuthorIds = [...new Set(posts.map(post => post.author))];
      
      // Batch fetch all authors at once
      const authorPromises = uniqueAuthorIds.map(id => 
        firestore.collection('users').doc(id).get()
      );
      
      const authorDocs = await Promise.all(authorPromises);
      
      // Create a map of author data
      const authorsMap = {};
      authorDocs.forEach((doc, index) => {
        const authorData = doc.exists ? doc.data() : { displayName: 'Unknown Author', photo: '' };
        authorsMap[uniqueAuthorIds[index]] = {
          ...authorData,
          name: authorData.name || 'unknown'
        };
      });
      
      // Map posts with author data
      return posts.map(post => ({
        ...post,
        author: authorsMap[post.author] || { displayName: 'Unknown Author', photo: '', name: 'unknown' }
      }));
      
    } catch (error) {
      console.error('Error batch fetching authors:', error);
      // Fallback to original method if batch fails
      return posts.map(post => ({
        ...post,
        author: { displayName: 'Unknown Author', photo: '', name: 'unknown' }
      }));
    }
  };

  // Firebase search function
  const getFilteredExplorePosts = async (searchInput) => {
    setIsSearchLoading(true);
    setHasSearched(true);
    
    try {
      if (!searchInput || searchInput.trim() === '') {
        // If search is cleared, reload initial posts
        await loadInitialPosts();
        return explorePosts;
      }
      
      const posts = await searchPosts(searchInput, 20);
      const postsWithAuthors = await setPostAuthorProfilePics(posts);
      setExplorePosts(postsWithAuthors);
      
      return postsWithAuthors;
    } catch (error) {
      console.error('Error searching posts:', error);
      // If there's an error, fall back to loading all posts
      await loadInitialPosts();
      return [];
    } finally {
      setIsSearchLoading(false);
    }
  };

  const shouldShowSpinner = isSearchLoading || (!user && userLoading);
  const shouldShowPosts = user && explorePosts && explorePosts.length > 0;
  // Show empty state only when user has searched and no results found
  const shouldShowEmptyState = user && hasSearched && explorePosts.length === 0 && !isSearchLoading;

  return (
    <>
      <Header>
        <NotificationsTrigger
          onClick={() => setIsPanelOpen(true)}
          unreadCount={unreadCount}
        />

        <Link href="/dashboard">
          <svg css={css`color: var(--grey-2); &:hover { color: var(--grey-3) }; cursor: pointer;`} width="21" height="21" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.8 1L2.74967 0.99997C2.52122 0.999752 2.32429 0.999564 2.14983 1.04145C1.60136 1.17312 1.17312 1.60136 1.04145 2.14983C0.999564 2.32429 0.999752 2.52122 0.99997 2.74967L1 2.8V5.2L0.99997 5.25033C0.999752 5.47878 0.999564 5.67572 1.04145 5.85017C1.17312 6.39864 1.60136 6.82688 2.14983 6.95856C2.32429 7.00044 2.52122 7.00025 2.74967 7.00003L2.8 7H5.2L5.25033 7.00003C5.47878 7.00025 5.67572 7.00044 5.85017 6.95856C6.39864 6.82688 6.82688 6.39864 6.95856 5.85017C7.00044 5.67572 7.00025 5.47878 7.00003 5.25033L7 5.2V2.8L7.00003 2.74967C7.00025 2.52122 7.00044 2.32429 6.95856 2.14983C6.82688 1.60136 6.39864 1.17312 5.85017 1.04145C5.67572 0.999564 5.47878 0.999752 5.25033 0.99997L5.2 1H2.8ZM2.38328 2.01382C2.42632 2.00348 2.49222 2 2.8 2H5.2C5.50779 2 5.57369 2.00348 5.61672 2.01382C5.79955 2.05771 5.94229 2.20045 5.98619 2.38328C5.99652 2.42632 6 2.49222 6 2.8V5.2C6 5.50779 5.99652 5.57369 5.98619 5.61672C5.94229 5.79955 5.79955 5.94229 5.61672 5.98619C5.57369 5.99652 5.50779 6 5.2 6H2.8C2.49222 6 2.42632 5.99652 2.38328 5.98619C2.20045 5.94229 2.05771 5.79955 2.01382 5.61672C2.00348 5.57369 2 5.50779 2 5.2V2.8C2 2.49222 2.00348 2.42632 2.01382 2.38328C2.05771 2.20045 2.20045 2.05771 2.38328 2.01382ZM9.8 1L9.74967 0.99997C9.52122 0.999752 9.32429 0.999564 9.14983 1.04145C8.60136 1.17312 8.17312 1.60136 8.04145 2.14983C7.99956 2.32429 7.99975 2.52122 7.99997 2.74967L8 2.8V5.2L7.99997 5.25033C7.99975 5.47878 7.99956 5.67572 8.04145 5.85017C8.17312 6.39864 8.60136 6.82688 9.14983 6.95856C9.32429 7.00044 9.52122 7.00025 9.74967 7.00003L9.8 7H12.2L12.2503 7.00003C12.4788 7.00025 12.6757 7.00044 12.8502 6.95856C13.3986 6.82688 13.8269 6.39864 13.9586 5.85017C14.0004 5.67572 14.0003 5.47878 14 5.25033L14 5.2V2.8L14 2.74967C14.0003 2.52122 14.0004 2.32429 13.9586 2.14983C13.8269 1.60136 13.3986 1.17312 12.8502 1.04145C12.6757 0.999564 12.4788 0.999752 12.2503 0.99997L12.2 1H9.8Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/>
          </svg>
        </Link>

        <ProfileSettingsModal Trigger={() => <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.5 1.225a5.075 5.075 0 0 0-1.408 9.953c-1.672.203-3.105.794-4.186 1.859-1.375 1.354-2.071 3.371-2.071 6.003a.665.665 0 1 0 1.33 0c0-2.408.634-4.032 1.674-5.057 1.042-1.026 2.598-1.558 4.661-1.558s3.619.532 4.662 1.558c1.039 1.026 1.673 2.649 1.673 5.057a.665.665 0 1 0 1.33 0c0-2.632-.696-4.648-2.072-6.003-1.078-1.064-2.513-1.656-4.185-1.859A5.078 5.078 0 0 0 10.5 1.225M6.755 6.3a3.745 3.745 0 1 1 7.49 0 3.745 3.745 0 0 1-7.49 0" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/></svg>} uid={user?.uid} email={user?.email} />

        <ThemeToggle />

        <button onClick={() => auth.signOut()}>
          <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4.2 1.4a1.4 1.4 0 0 0-1.4 1.4v15.4a1.4 1.4 0 0 0 1.4 1.4h10.5a.7.7 0 0 0 0-1.4H4.2V2.8h10.5a.7.7 0 0 0 0-1.4zm13.446 5.454a.7.7 0 0 0-.991.991L18.61 9.8H9.1a.7.7 0 0 0 0 1.4h9.51l-1.956 1.954a.7.7 0 0 0 .991.991l3.15-3.15a.7.7 0 0 0 0-.991z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/>
          </svg>
        </button>
      </Header>

      {/* Notifications Panel */}
      <NotificationsPanel
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false)
          if (user) {
            fetch(`/api/notifications?userId=${user.uid}&limit=1`)
              .then(res => res.json())
              .then(data => setUnreadCount(data.unreadCount || 0))
              .catch(console.error)
          }
        }}
      />

      {userError ? (
        <>
          <p>Oops, we&apos;ve had an error:</p>
          <pre>{JSON.stringify(userError)}</pre>
        </>
      ) : user ? (
        <>
          <div css={css`
            display: flex;
            flex-wrap: wrap;
            gap: 1em;
            width: 109%;
          `}>
            <Button
              outline
              css={css`
                display: block;
                outline: none;
                cursor: pointer;
                border-radius: 0.33em;
                transition: all 200ms ease 0s;
                background: var(--grey-1);
                color: var(--grey-4);
                border: 1px solid var(--grey-2);
                font-size: 1.3rem;
                padding: 0px;
                width: 2.15em;
                height: 2.15em;
              `}
            >
              <svg
                width="21"
                height="21"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                css={css`
                  margin: 0.2em 0 0 0.1em;
                  path {
                    stroke: var(--grey-4);
                  }
                `}
              >
                <path d="M3 15V9a6 6 0 0 1 6-6h6a6 6 0 0 1 6 6v6a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 3s-4.5 0-4.5 9H13c0 9 2 9 2 9" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16.5 14.5s-1.5 2-4.5 2-4.5-2-4.5-2M7 9v2m10-2v2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
            <Search
              posts={explorePosts}
              isGlobalSearch={true}
              getSearchInput={getFilteredExplorePosts}
              css={css`
                margin-left: 0em
              `}
            />
          </div>

          {shouldShowSpinner ? (
            <Spinner />
          ) : shouldShowPosts ? (
            <ul css={css`
              list-style: none;
              text-decoration: none;
              li {
                max-width: 25rem;
                margin: 2.5rem 0;
                text-decoration: none;
              }
            `}>
              {explorePosts.map(post => (
                <li key={post.id}>
                  <Link href={`/${post.author.name || 'unknown'}/${post.slug}`}>
                    <div css={css`
                      text-decoration: none; 
                      color: inherit;
                      display: block;
                      cursor: pointer;
                    `}>
                      <h3 css={css`
                        font-size: 1rem;
                        font-weight: 400;
                        margin-bottom: 0.6rem;
                        text-decoration: none;
                      `}>
                        {post.title ? htmlToText(post.title) : 'Untitled'}
                      </h3>

                      <div css={css`
                        display: flex;
                        align-items: center;
                        color: var(--grey-3);
                        font-size: 0.9rem;
                        text-decoration: none;
                      `}>
                        {post.author.photo && (
                          <img
                            src={post.author.photo}
                            alt="Profile picture"
                            css={css`
                              width: 1.5rem;
                              border-radius: 1rem;
                              margin-right: 0.75rem;
                            `}
                          />
                        )}
                        <p style={{textDecoration: 'none', color: 'inherit'}}>
                          {post.author.displayName || 'Unknown Author'}
                        </p>
                      </div>

                      <p css={css`
                        color: var(--grey-4);
                        font-family: 'Newsreader', serif;
                        line-height: 1.5em;
                        margin-top: 0.5rem;
                        text-decoration: none;
                      `}>
                        {post.excerpt
                          ? htmlToText(post.excerpt)
                          : post.content 
                            ? truncate(htmlToText(post.content), 25)
                            : 'No preview available'}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : shouldShowEmptyState ? (
            <div css={css`
              text-align: center;
              color: var(--grey-3);
              margin-top: 3rem;
            `}>
              <p>No posts found. Try a different search term.</p>
            </div>
          ) : user && explorePosts.length === 0 && !isSearchLoading ? (
            <div css={css`
              text-align: center;
              color: var(--grey-3);
              margin-top: 3rem;
            `}>
              <p>No posts available yet.</p>
            </div>
          ) : null}
        </>
      ) : (
        <Spinner />
      )}
    </>
  )
}

Explore.getLayout = function Explore(page) {
  return (
    <Container
      maxWidth="640px"
      css={css`
        margin-top: 5rem;
        text-decoration: none;
      `}
    >
      <Head>
        {meta({
          title: 'Explore Writing | Bublr',
          description: 'Discover inspiring stories, articles, and blog posts from writers around the world. An ultra-minimal community for anyone to write anything.',
          url: '/explore',
          image: '/images/socials.png',
          keywords: 'explore, writing community, stories, articles, blog posts, minimal writing platform, discover writers, blog discovery'
        })}
        <link rel="canonical" href="https://bublr.life/explore" />

        {/* CollectionPage schema for content aggregation */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionPageSchema)
        }} />

        <script defer src="https://cloud.umami.is/script.js" data-website-id="ec0fac0a-1f2b-44de-90d2-1e224c8d8492"></script>
        <meta name="mobile-web-app-capable" content="yes" />
      </Head>
      {page}
    </Container>
  )
}
/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import Head from 'next/head'
import { css } from '@emotion/react'
import { useRouter } from 'next/router'
import { htmlToText } from 'html-to-text'
import { useState, useEffect } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'

import Header from '../../components/header'
import Spinner from '../../components/spinner'
import Container from '../../components/container'
import ProfileSettingsModal from '../../components/profile-settings-modal'

import { truncate } from '../../lib/utils'
import { firestore, auth } from '../../lib/firebase'
import { getPostByID, getUserByID } from '../../lib/db'

function List({ uid }) {
  const [list, setList] = useState([])

  useEffect(() => {
    ;(async () => {
      try {
        const user = await getUserByID(uid)
        // Check if user has readingList and it's not empty
        if (user.readingList && user.readingList.length > 0) {
          const postPromises = user.readingList.map(async pid => {
            try {
              const post = await getPostByID(pid)
              const author = await firestore
                .collection('users')
                .doc(post.author)
                .get()
              post.author = author.data()
              return post
            } catch (error) {
              console.error(`Error fetching post ${pid}:`, error)
              return null
            }
          })
          const posts = await Promise.all(postPromises)
          // Filter out null values (posts that failed to load)
          const validPosts = posts.filter(post => post !== null)
          console.log(validPosts)
          setList(validPosts)
        } else {
          setList([])
        }
      } catch (error) {
        console.error('Error loading reading list:', error)
        setList([])
      }
    })()
  }, [uid])

  if (list.length > 0)
    return (
      <ul
        css={css`
          list-style: none;

          li {
            max-width: 25rem;
            margin: 2.5rem 0;
          }
        `}
      >
        {list.map(post => (
          <li key={post.id}>
            <Link href={`/${post.author.name}/${post.slug}`}>
              <a style={{ textDecoration: 'none', color: 'inherit' }}>
                <h3
                  css={css`
                    font-size: 1rem;
                    font-weight: 400;
                    margin-bottom: 0.6rem;
                  `}
                >
                  {post.title ? htmlToText(post.title) : 'Untitled'}
                </h3>

                <div
                  css={css`
                    display: flex;
                    align-items: center;
                    color: var(--grey-3);
                    font-size: 0.9rem;
                  `}
                >
                  <img
                    src={post.author.photo}
                    alt="Profile picture"
                    css={css`
                      width: 1.5rem;
                      border-radius: 1rem;
                      margin-right: 0.75rem;
                    `}
                  />
                  <p>{post.author.displayName}</p>
                </div>

                <p
                  css={css`
                    color: var(--grey-4);
                    font-family: 'Newsreader', serif;
                    line-height: 1.5em;
                    margin-top: 0.5rem;
                  `}
                >
                  {post.excerpt
                    ? htmlToText(post.excerpt)
                    : truncate(htmlToText(post.content), 25)}
                </p>
              </a>
            </Link>
          </li>
        ))}
      </ul>
    )

  return <p>You have no posts saved to read later.</p>
}

export default function ReadingList() {
  const router = useRouter()
  const [user, userLoading, userError] = useAuthState(auth)

  useEffect(() => {
    console.log(user, userLoading, userError)
    if (!user && !userLoading && !userError) {
      router.push('/')
      return
    }
  }, [router, user, userLoading, userError])

  return (
    <>
      <Header>
        <Link href="/dashboard">
          <a>Dashboard</a>
        </Link>
        <ProfileSettingsModal Trigger={() => 'Profile'} uid={user?.uid} />
        <button onClick={() => auth.signOut()}>Sign Out</button>
      </Header>

      {userError ? (
        <>
          <p>Oop, we&apos;ve had an error:</p>
          <pre>{JSON.stringify(error)}</pre>
        </>
      ) : user ? (
        <List uid={user.uid} />
      ) : (
        <Spinner />
      )}
    </>
  )
}

ReadingList.getLayout = function ReadingListLayout(page) {
  return (
    <Container
      maxWidth="640px"
      css={css`
        margin-top: 5rem;
      `}
    >
      <Head>
        <title>Reading List / Bublr</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,600;1,400;1,600&display=swap"
          rel="stylesheet"
        />
      </Head>
      {page}
    </Container>
  )
}

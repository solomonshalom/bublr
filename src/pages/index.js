/** @jsxImportSource @emotion/react */
import Head from 'next/head'
import { css } from '@emotion/react'
import { useAuthState } from 'react-firebase-hooks/auth'

import firebase, { auth } from '../lib/firebase'
import { setUser, userWithIDExists } from '../lib/db'

import meta from '../components/meta'
import Spinner from '../components/spinner'
import Container from '../components/container'
import PeepWalk from '../components/PeepWalk'
import Button, { LinkButton } from '../components/button'
import CTAButton from '../components/cta-button'
import CTAButtonDashboard from '../components/cta-button-dashboard'
import CTAButtonSignOut from '../components/cta-button-signout'

const dicebearStyles = [
  'notionists-neutral',
  'notionists',
  'lorelei-neutral',
  'lorelei',
  'dylan',
]

function generateDiceBearAvatar(uid) {
  const hash = uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const style = dicebearStyles[hash % dicebearStyles.length]
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${uid}`
}

export default function Home() {
  const [user, loading, error] = useAuthState(auth)

  if (error) {
    return (
      <>
        <p>Oop, we&apos;ve had an error:</p>
        <pre>{JSON.stringify(error)}</pre>
      </>
    )
  }

  return (
    <div>
      <div
        css={css`
          margin-top: 0rem;
          margin-bottom: 1.5rem;
          font-size: 4.5rem;
          font-family: "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", emoji, sans-serif;
          -webkit-font-feature-settings: "liga" off, "calt" off;
          font-feature-settings: "liga" off, "calt" off;

          @media (max-width: 720px) {
            margin-bottom: 1.5rem;
          }
        `}
      >
        🍱
      </div>
      <h1
        css={css`
          font-size: 1.25rem;
          letter-spacing: -0.02rem;
          margin-bottom: 1.5rem;
        `}
      >
        An open-source, distraction-free spot for anyone to write anything!
      </h1>
      <ul
        css={css`
          list-style: none;
          color: var(--grey-3);
          margin-bottom: 2.3rem;

          li {
            margin: 0.75rem 0;
          }

          li::before {
            display: inline-block;
            content: '';
            font-size: 0.9rem;
            margin-right: 0.5rem;
          }
        `}
      >
        No Ads, Paywalls, & It's Open-Source!
      </ul>
      {loading ? (
          <Spinner />
      ) : user ? (
        <div
          css={css`
            display: inline-flex;
            flex-direction: column;
            gap: 0.2rem;
          `}
        >
          <CTAButtonDashboard
            onClick={(e) => {
              if (e.target.closest('.arrow')) {
                window.location.href = '/dashboard'
              }
            }}
          />
          <CTAButtonSignOut
            onClick={(e) => {
              if (e.target.closest('.arrow')) {
                auth.signOut()
              }
            }}
          />
        </div>
      ) : (
        <CTAButton
          onClick={(e) => {
            // Check if click was on the arrow element
            if (e.target.closest('.arrow')) {
              const googleAuthProvider = new firebase.auth.GoogleAuthProvider()
              auth.signInWithPopup(googleAuthProvider).then(async cred => {
                let userExists = await userWithIDExists(cred.user.uid)
                if (!userExists) {
                  await setUser(cred.user.uid, {
                    name: cred.user.uid,
                    displayName: cred.user.displayName || 'Anonymous',
                    about: 'Nothing to say about you.',
                    posts: [],
                    photo: generateDiceBearAvatar(cred.user.uid),
                    readingList: [],
                  })
                }
              })
            }
          }}
        >
          Sign Up
        </CTAButton>
      )}
      <div
        css={css`
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: -1;
        `}
      >
        <PeepWalk height="450px" width="100%" />
      </div>
    </div>
  )
}

Home.getLayout = function HomeLayout(page) {
  return (
    <Container maxWidth="420px">
      <Head>
        {meta({
          title: 'Bublr - A Minimal Writing Community',
          description:
            'Bublr is an open-source, ultra-minimal community for writers to share their thoughts, stories, and ideas without ads or paywalls.',
          url: '/',
          image: '/images/socials.png',
        })}
        <link rel="canonical" href="https://bublr.life/" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "url": "https://bublr.life/",
            "name": "Bublr",
            "description": "An open-source, ultra-minimal community for anyone, to write anything",
            "potentialAction": {
              "@type": "SearchAction",
              "target": "https://bublr.life/{search_term_string}",
              "query-input": "required name=search_term_string"
            }
          })
        }} />
      </Head>
      {page}
    </Container>
  )
}

// Check for custom domain and redirect to user's profile
export async function getServerSideProps({ req }) {
  const host = req.headers.host || ''

  // List of main domains that should show the home page
  const mainDomains = ['bublr.life', 'www.bublr.life', 'localhost', 'localhost:3000']
  const hostWithoutPort = host.split(':')[0]

  // Check if it's a main domain or Vercel preview
  const isMainDomain = mainDomains.some(domain => {
    const domainWithoutPort = domain.split(':')[0]
    return hostWithoutPort === domainWithoutPort
  })
  const isVercelPreview = host.includes('.vercel.app')

  if (isMainDomain || isVercelPreview) {
    // Show normal home page
    return { props: {} }
  }

  // This might be a custom domain - look up the user
  try {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life'
    const res = await fetch(`${baseUrl}/api/domain/lookup?domain=${encodeURIComponent(host)}`)

    if (res.ok) {
      const data = await res.json()
      // Redirect to user's profile page (internally)
      return {
        redirect: {
          destination: `/${data.userName}`,
          permanent: false,
        },
      }
    }
  } catch (error) {
    console.error('Custom domain lookup error:', error)
  }

  // Domain not found or error - show home page
  return { props: {} }
}
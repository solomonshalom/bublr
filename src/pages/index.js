/** @jsxImportSource @emotion/react */
import Head from 'next/head'
import { css } from '@emotion/react'
import { useAuthState } from 'react-firebase-hooks/auth'

import firebase, { auth } from '../lib/firebase'
import { setUser, userWithIDExists, getUserByName } from '../lib/db'
import { generateProfilePageSchema, generateOrganizationSchema } from '../lib/seo-utils'

import meta from '../components/meta'
import Spinner from '../components/spinner'
import Profile from './[username]/index'

// Static schema objects for homepage (defined at module level for SSR compatibility)
const SITE_URL = 'https://bublr.life'
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  'name': 'Bublr',
  'url': SITE_URL,
  'logo': {
    '@type': 'ImageObject',
    'url': `${SITE_URL}/images/logo.png`,
    'width': 512,
    'height': 512
  },
  'description': 'An open-source, ultra-minimal community for writers to share their thoughts, stories, and ideas without ads or paywalls.',
  'foundingDate': '2024',
  'sameAs': ['https://github.com/solomonshalom/bublr'],
  'contactPoint': {
    '@type': 'ContactPoint',
    'contactType': 'customer support',
    'url': `${SITE_URL}/about`
  }
}

const webSiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  'url': SITE_URL,
  'name': 'Bublr',
  'description': 'An open-source, ultra-minimal community for writers to share their thoughts, stories, and ideas without ads or paywalls.',
  'publisher': { '@id': `${SITE_URL}/#organization` },
  'inLanguage': 'en-US',
  'potentialAction': {
    '@type': 'SearchAction',
    'target': {
      '@type': 'EntryPoint',
      'urlTemplate': `${SITE_URL}/explore?q={search_term_string}`
    },
    'query-input': 'required name=search_term_string'
  }
}

const siteNavigationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SiteNavigationElement',
  'name': 'Main Navigation',
  'hasPart': [
    { '@type': 'SiteNavigationElement', 'name': 'Home', 'url': SITE_URL },
    { '@type': 'SiteNavigationElement', 'name': 'Explore', 'url': `${SITE_URL}/explore` },
    { '@type': 'SiteNavigationElement', 'name': 'Dashboard', 'url': `${SITE_URL}/dashboard` },
    { '@type': 'SiteNavigationElement', 'name': 'About', 'url': `${SITE_URL}/about` }
  ]
}

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

export default function Home({ customDomainUser, organizationSchema: orgSchema, profilePageSchema }) {
  const [user, loading, error] = useAuthState(auth)

  // If this is a custom domain request, render the Profile component directly
  if (customDomainUser) {
    return <Profile user={customDomainUser} organizationSchema={orgSchema} profilePageSchema={profilePageSchema} />
  }

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
              // Explicitly request email and profile scopes to ensure email is captured
              googleAuthProvider.addScope('email')
              googleAuthProvider.addScope('profile')
              auth.signInWithPopup(googleAuthProvider).then(async cred => {
                let userExists = await userWithIDExists(cred.user.uid)
                if (!userExists) {
                  // New user - create full profile with email
                  await setUser(cred.user.uid, {
                    name: cred.user.uid,
                    displayName: cred.user.displayName || 'Anonymous',
                    email: cred.user.email || null,
                    about: 'Nothing to say about you.',
                    posts: [],
                    photo: generateDiceBearAvatar(cred.user.uid),
                    readingList: [],
                  })
                } else if (cred.user.email) {
                  // Existing user - update email if available (handles pre-existing users missing email)
                  const userDoc = await firestore.collection('users').doc(cred.user.uid).get()
                  const userData = userDoc.data()
                  if (!userData?.email) {
                    await firestore.collection('users').doc(cred.user.uid).update({
                      email: cred.user.email
                    })
                  }
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

Home.getLayout = function HomeLayout(page, pageProps) {
  // For custom domain requests, don't wrap in Container (Profile has its own layout)
  if (pageProps?.customDomainUser) {
    return page
  }

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

        {/* Organization schema - critical for E-E-A-T and AI citation */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema)
        }} />

        {/* WebSite schema with SearchAction for sitelinks */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify(webSiteSchema)
        }} />

        {/* SiteNavigationElement for site structure */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify(siteNavigationSchema)
        }} />
      </Head>
      {page}
    </Container>
  )
}

// Check for custom domain and render profile directly (no redirect)
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

  // This might be a custom domain - look up the user and render profile directly
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life'
    const res = await fetch(`${baseUrl}/api/domain/lookup?domain=${encodeURIComponent(host)}`)

    if (res.ok) {
      const data = await res.json()

      // Fetch full user data (same logic as [username]/index.js getServerSideProps)
      const user = await getUserByName(data.userName)

      // Mark as custom domain access
      user.isCustomDomain = true

      // Process posts efficiently
      const processedPosts = user.posts
        .filter(p => p.published)
        .map(p => ({
          ...p,
          lastEdited: p.lastEdited?.toDate?.() ? p.lastEdited.toDate().getTime() : p.lastEdited?.toMillis?.() || Date.now(),
        }))
        .sort((a, b) => b.lastEdited - a.lastEdited)
        .slice(0, 20)

      user.posts = processedPosts

      // Ensure all required fields exist (same as [username]/index.js)
      if (!user.socialLinks) user.socialLinks = {}
      if (!user.skills) user.skills = []
      if (!user.customSections) user.customSections = []
      if (!user.skillsSectionTitle) user.skillsSectionTitle = ''
      if (!user.sectionOrder) user.sectionOrder = ['skills', 'writing', 'custom']
      if (!user.customBranding) user.customBranding = data.customBranding || null
      if (!user.followers) user.followers = []
      if (!user.following) user.following = []
      if (!user.subscribers) user.subscribers = []
      if (!user.statsVisibility) user.statsVisibility = { followers: false, following: false, subscribers: false }
      if (!user.statsOrder) user.statsOrder = ['followers', 'following', 'subscribers']
      if (!user.statsStyle) user.statsStyle = 'separator'
      if (!user.statsAlignment) user.statsAlignment = 'center'
      if (!user.buttonsVisibility) user.buttonsVisibility = { follow: false, newsletter: true }
      if (!user.buttonsOrder) user.buttonsOrder = ['follow', 'newsletter']
      if (!user.dividersVisibility) user.dividersVisibility = { skills: true, writing: true, custom: true }
      if (!user.banner) user.banner = null
      if (!user.bannerPosition) user.bannerPosition = 'center'
      if (!user.avatarFrame) user.avatarFrame = { type: 'none', color: null, gradientColors: null, customUrl: null, size: 'medium' }

      // Generate schemas for SEO
      const organizationSchema = generateOrganizationSchema()
      const profilePageSchema = generateProfilePageSchema({
        name: user.displayName,
        username: user.name,
        photo: user.photo,
        about: user.about,
        socialLinks: user.socialLinks,
        website: user.link,
        postCount: user.posts?.length || 0,
        followerCount: user.followers?.length || 0,
        subscriberCount: user.subscribers?.length || 0
      })

      return {
        props: {
          customDomainUser: user,
          organizationSchema,
          profilePageSchema,
        },
      }
    }
  } catch (error) {
    console.error('Custom domain lookup error:', error)
  }

  // Domain not found or error - show home page
  return { props: {} }
}
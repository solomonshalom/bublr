/** @jsxImportSource @emotion/react */
import Head from 'next/head'
import Link from 'next/link'
import { css } from '@emotion/react'
import { safeJsonLd } from '../lib/escape'
import { useAuthState } from 'react-firebase-hooks/auth'

import { useRouter } from 'next/router'
import { auth } from '../lib/firebase'
import { getUserByName } from '../lib/db'
import { buildProfilePageProps } from '../lib/profile-page'
import { routeCustomDomain } from '../lib/custom-domain-routing'

import meta from '../components/meta'
import Spinner from '../components/spinner'
import { FadeIn, FadeInGroup, FadeInItem } from '../components/fade-in'

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

import dynamic from 'next/dynamic'
import Container from '../components/container'

// A writer's profile, for "/" on their own domain. Loaded only there, so the
// landing page doesn't ship the whole profile page.
const Profile = dynamic(() => import('./[username]/index'))
import Button, { LinkButton } from '../components/button'

// Dynamic import PeepWalk - it uses GSAP (heavy) and only renders on home page
// This keeps it out of the initial bundle, improving First Contentful Paint
const PeepWalk = dynamic(() => import('../components/PeepWalk'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '450px', width: '100%', background: 'transparent' }} />
  ),
})
import CTAButton from '../components/cta-button'
import { PRO_PLAN } from '../lib/pricing'
import { PRO_GRADIENT, SparkleIcon } from '../components/pro/pro-look'
import CTAButtonDashboard from '../components/cta-button-dashboard'
import CTAButtonSignOut from '../components/cta-button-signout'

// A quiet nudge toward Bublr Pro under the sign-in button
function ProAnnouncement() {
  return (
    <Link href="/docs/custom-domains" passHref>
      <a
        css={css`
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          margin-top: 1.4rem;
          padding: 0.35rem 0.75rem 0.35rem 0.4rem;
          border-radius: 999px;
          font-size: 0.8rem;
          color: var(--grey-4);
          text-decoration: none;
          background: var(--grey-1);
          border: 1px solid transparent;
          background-image: linear-gradient(var(--grey-1), var(--grey-1)), ${PRO_GRADIENT};
          background-origin: border-box;
          background-clip: padding-box, border-box;
          transition: transform 150ms ease, box-shadow 150ms ease;

          &:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 18px -10px rgba(188, 60, 0, 0.6);
          }
        `}
      >
        <span
          css={css`
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.15rem 0.45rem;
            border-radius: 999px;
            font-size: 0.68rem;
            font-weight: 600;
            letter-spacing: 0.04em;
            color: #fff;
            background: ${PRO_GRADIENT};
          `}
        >
          <SparkleIcon size={9} /> New
        </span>
        Your own domain, {PRO_PLAN.shortPriceLabel} →
      </a>
    </Link>
  )
}

export default function Home({ customDomainProfile }) {
  // A writer's own domain: render their profile (hooks below stay unconditional)
  if (customDomainProfile) {
    return <Profile {...customDomainProfile} />
  }
  return <Landing />
}

function Landing() {
  const [user, loading, error] = useAuthState(auth)
  const router = useRouter()

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
      <FadeInGroup staggerDelay={0.1}>
        <FadeInItem>
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
        </FadeInItem>
        <FadeInItem>
          <h1
            css={css`
              font-size: 1.25rem;
              letter-spacing: -0.02rem;
              margin-bottom: 1.5rem;
            `}
          >
            An open-source, distraction-free spot for anyone to write anything!
          </h1>
        </FadeInItem>
        <FadeInItem>
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
        </FadeInItem>
        <FadeInItem>
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
            onClick={() => {
              window.location.href = '/dashboard'
            }}
          />
          <CTAButtonSignOut
            onClick={() => {
              auth.signOut()
            }}
          />
        </div>
      ) : (
        <div
          css={css`
            display: inline-flex;
            flex-direction: column;
            gap: 0.2rem;
          `}
        >
          <CTAButton onClick={() => router.push('/signup')}>
            Get Started
          </CTAButton>
        </div>
      )}
        </FadeInItem>
        <FadeInItem>
          <ProAnnouncement />
        </FadeInItem>
      </FadeInGroup>
      <div
        css={css`
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: -1;
          overflow: hidden;
        `}
      >
        <PeepWalk height="350px" width="100%" />
      </div>
    </div>
  )
}

Home.getLayout = function HomeLayout(page, pageProps) {
  // For custom domain requests, don't wrap in Container (Profile has its own layout)
  if (pageProps?.customDomainProfile) {
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
          __html: safeJsonLd(organizationSchema)
        }} />

        {/* WebSite schema with SearchAction for sitelinks */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: safeJsonLd(webSiteSchema)
        }} />

        {/* SiteNavigationElement for site structure */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: safeJsonLd(siteNavigationSchema)
        }} />
      </Head>
      {page}
    </Container>
  )
}

// On a writer's own domain, "/" is their profile
export async function getServerSideProps({ req }) {
  const route = await routeCustomDomain(req.headers.host)
  if (route.kind === 'redirect') {
    return { redirect: { destination: route.destination, permanent: false } }
  }
  if (route.kind === 'profile') {
    const owner = await getUserByName(route.owner.name)
    const customDomainProfile = await buildProfilePageProps(owner, { customDomain: route.host })
    return { props: { customDomainProfile } }
  }
  return { props: {} }
}

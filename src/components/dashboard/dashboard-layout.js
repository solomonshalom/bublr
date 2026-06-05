/** @jsxImportSource @emotion/react */
import Head from 'next/head'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { css } from '@emotion/react'
import { useRouter } from 'next/router'
import { useEffect, useState, useRef, useCallback, createContext, useContext } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { tinykeys } from 'tinykeys'

import { auth } from '../../lib/firebase'
import { createPostForUser } from '../../lib/db'
import { prefersReducedMotion } from '../../lib/animation-config'

import DashboardSidebar from './dashboard-sidebar'

const SIDEBAR_STORAGE_KEY = 'bublr.dashboard.sidebar.open'

const wrapperStyle = css`
  min-height: 100vh;
  background: var(--grey-1);
  font-family: 'Inter', sans-serif;
`

const mainStyle = css`
  position: relative;
  min-height: 100vh;
  transition: padding-left 200ms ease;
`

const mainOpenStyle = css`
  @media (min-width: 721px) {
    padding-left: var(--sidebar-width);
  }
`

const bodyContainerStyle = css`
  max-width: 760px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem 1.5rem;

  @media (max-width: 720px) {
    padding: 1.25rem 1rem 3rem 1rem;
  }
`

const pageFadeStyle = css`
  will-change: opacity, transform, filter;
  transform-origin: top center;
`

/**
 * DashboardPageTransition — premium scoped fade.
 *
 * Mirrors the global PageTransition pattern (fade out → swap content → fade
 * in + settle), but only animates the main area so the sidebar stays fixed.
 *
 * Premium beats:
 *   • power3.out enter (cubic-bezier(0.22, 1, 0.36, 1)) — Apple-style settle
 *   • subtle 4px blur during exit, restored on enter — adds depth
 *   • scale 0.985 → 1 + y 6 → 0 — content "lands" rather than appears
 *   • main scrolled to top during the blank frame so it never flashes mid-page
 *   • clearProps after enter so the inline transform doesn't trap fixed children
 */
function DashboardPageTransition({ children }) {
  const containerRef = useRef(null)
  const router = useRouter()
  const [displayed, setDisplayed] = useState(children)
  const isFirstMount = useRef(true)
  const isNavigating = useRef(false)
  const childrenRef = useRef(children)
  childrenRef.current = children

  useGSAP(
    () => {
      if (!containerRef.current || !isFirstMount.current) return
      isFirstMount.current = false

      if (prefersReducedMotion()) {
        gsap.set(containerRef.current, { opacity: 1, clearProps: 'transform,filter' })
        return
      }

      gsap.set(containerRef.current, { opacity: 0, y: 6, scale: 0.985, filter: 'blur(3px)' })
      gsap.to(containerRef.current, {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.45,
        ease: 'power3.out',
        clearProps: 'transform,filter',
      })
    },
    { scope: containerRef }
  )

  useGSAP(
    (context, contextSafe) => {
      const fadeOut = contextSafe(() =>
        gsap.to(containerRef.current, {
          opacity: 0,
          y: -4,
          scale: 0.99,
          filter: 'blur(4px)',
          duration: 0.18,
          ease: 'power2.in',
        })
      )

      const fadeIn = contextSafe(() =>
        gsap.to(containerRef.current, {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          duration: 0.45,
          ease: 'power3.out',
          clearProps: 'transform,filter',
          onComplete: () => {
            isNavigating.current = false
          },
        })
      )

      const handleStart = url => {
        if (url === router.asPath || !containerRef.current) return
        isNavigating.current = true
        if (prefersReducedMotion()) return
        fadeOut()
      }

      const handleComplete = () => {
        if (!containerRef.current) return

        // Reset scroll only on the main area (sidebar is position:fixed so unaffected)
        try {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        } catch (e) {
          window.scrollTo(0, 0)
        }

        if (prefersReducedMotion()) {
          setDisplayed(childrenRef.current)
          gsap.set(containerRef.current, { opacity: 1, clearProps: 'transform,filter' })
          isNavigating.current = false
          return
        }

        gsap.set(containerRef.current, { opacity: 0, y: 6, scale: 0.985, filter: 'blur(3px)' })
        setDisplayed(childrenRef.current)
        requestAnimationFrame(() => {
          if (containerRef.current) fadeIn()
        })
      }

      const handleError = () => {
        if (containerRef.current) {
          gsap.set(containerRef.current, { opacity: 1, clearProps: 'transform,filter' })
        }
        isNavigating.current = false
      }

      router.events.on('routeChangeStart', handleStart)
      router.events.on('routeChangeComplete', handleComplete)
      router.events.on('routeChangeError', handleError)

      return () => {
        router.events.off('routeChangeStart', handleStart)
        router.events.off('routeChangeComplete', handleComplete)
        router.events.off('routeChangeError', handleError)
      }
    },
    { scope: containerRef, dependencies: [router] }
  )

  useEffect(() => {
    if (!isNavigating.current) {
      setDisplayed(children)
    }
  }, [children])

  return (
    <div ref={containerRef} css={pageFadeStyle}>
      {displayed}
    </div>
  )
}

const SidebarContext = createContext({
  open: true,
  toggle: () => {},
  openMobile: false,
  setOpenMobile: () => {},
})

export const useSidebar = () => useContext(SidebarContext)

export default function DashboardLayout({ children, pageTitle }) {
  const router = useRouter()
  const [user, userLoading, userError] = useAuthState(auth)

  const [open, setOpen] = useState(true)
  const [openMobile, setOpenMobile] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate sidebar state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      if (stored !== null) {
        setOpen(stored === 'true')
      }
    } catch (e) {
      // ignore
    }
    setHydrated(true)
  }, [])

  // Persist sidebar state
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open))
    } catch (e) {
      // ignore
    }
  }, [open, hydrated])

  const toggle = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 720) {
      setOpenMobile(prev => !prev)
    } else {
      setOpen(prev => !prev)
    }
  }, [])

  // Auth redirect
  useEffect(() => {
    if (!user && !userLoading && !userError) {
      router.push('/')
    }
  }, [router, user, userLoading, userError])

  // Global keyboard shortcuts
  useEffect(() => {
    if (!user) return

    const isTyping = () => {
      const el = document.activeElement
      if (!el) return false
      const tag = el.tagName
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable
      )
    }

    const unsubscribe = tinykeys(window, {
      '$mod+b': event => {
        event.preventDefault()
        toggle()
      },
      c: event => {
        if (isTyping()) return
        event.preventDefault()
        ;(async () => {
          try {
            const newId = await createPostForUser(user.uid)
            router.push(`/dashboard/${newId}`)
          } catch (e) {
            console.error('Failed to create post', e)
          }
        })()
      },
      'g p': event => {
        if (isTyping()) return
        event.preventDefault()
        router.push('/dashboard')
      },
      'g r': event => {
        if (isTyping()) return
        event.preventDefault()
        router.push('/dashboard/list')
      },
      'g u': event => {
        if (isTyping()) return
        event.preventDefault()
        router.push('/dashboard/subscribers')
      },
      'g s': event => {
        if (isTyping()) return
        event.preventDefault()
        router.push('/dashboard/settings/personal')
      },
      'g d': event => {
        if (isTyping()) return
        event.preventDefault()
        router.push('/dashboard/settings/developer')
      },
    })

    return unsubscribe
  }, [user, router, toggle])

  return (
    <SidebarContext.Provider
      value={{ open, toggle, openMobile, setOpenMobile }}
    >
      <Head>
        <title>{pageTitle ? `${pageTitle} / Bublr` : 'Dashboard / Bublr'}</title>
        <meta name="robots" content="noindex, nofollow" />
        <script defer src="https://cloud.umami.is/script.js" data-website-id="a0cdb368-20ae-4630-8949-ac57917e2ae3"></script>
        <meta name="mobile-web-app-capable" content="yes" />
      </Head>
      <div css={wrapperStyle}>
        <DashboardSidebar
          open={open}
          mobileOpen={openMobile}
          onCloseMobile={() => setOpenMobile(false)}
          uid={user?.uid}
          email={user?.email}
        />
        <main css={[mainStyle, open && mainOpenStyle]}>
          {userError ? (
            <div css={css`padding: 2rem;`}>
              <p>Something went wrong:</p>
              <pre>{JSON.stringify(userError)}</pre>
            </div>
          ) : (
            <DashboardPageTransition>{children}</DashboardPageTransition>
          )}
        </main>
      </div>
    </SidebarContext.Provider>
  )
}

export function DashboardBody({ children }) {
  return <div css={bodyContainerStyle}>{children}</div>
}

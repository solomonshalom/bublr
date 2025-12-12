import 'modern-normalize'
import Head from 'next/head'
import { ThemeProvider } from 'next-themes'
import { Global, css } from '@emotion/react'
import { IdProvider } from '@radix-ui/react-id'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { I18nProvider } from '../lib/i18n'
import { SmoothScrollProvider } from '../components/smooth-scroll'

// Premium easing curves
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1]
const EASE_OUT = [0.4, 0, 0.2, 1]

const App = ({ Component, pageProps }) => {
  const getLayout = Component.getLayout || ((page) => page)
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  const [displayedPath, setDisplayedPath] = useState(router.asPath)

  // Handle route change loading state
  useEffect(() => {
    const handleStart = (url) => {
      if (url !== router.asPath) {
        setIsNavigating(true)
      }
    }
    const handleComplete = (url) => {
      setIsNavigating(false)
      setDisplayedPath(url)
      // Scroll to top on route change
      window.scrollTo(0, 0)
    }

    router.events.on('routeChangeStart', handleStart)
    router.events.on('routeChangeComplete', handleComplete)
    router.events.on('routeChangeError', handleComplete)

    return () => {
      router.events.off('routeChangeStart', handleStart)
      router.events.off('routeChangeComplete', handleComplete)
      router.events.off('routeChangeError', handleComplete)
    }
  }, [router])

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="theme-color" content="#FCFCFC" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#171717" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* SEO Meta Tags */}
        <meta name="author" content="Bublr" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta httpEquiv="Content-Language" content="en" />
        
        {/* Open Graph default fallback values */}
        {!router.pathname.includes('[') && (
          <>
            <meta property="og:site_name" content="Bublr" />
            <meta property="twitter:site" content="@bublr" />
            <meta property="og:locale" content="en_US" />
          </>
        )}
      </Head>
      <Global
        styles={css`
          :root {
            --grey-1: #fcfcfc;
            --grey-2: #c7c7c7;
            --grey-3: #6f6f6f;
            --grey-4: #2e2e2e;
            --grey-5: #171717;
            --text: #2B3044;
            --line: #BBC1E1;
            --line-active: #275EFE;
            --code-bg: #f5f5f5;
            --code-text: #374151;
            --border: rgb(222, 223, 223);
          }

          [data-theme='dark'] {
            --grey-1: #171717;
            --grey-2: #2e2e2e;
            --grey-4: #c7c7c7;
            --grey-5: #fcfcfc;
            --code-bg: #262626;
            --code-text: #e5e7eb;
            --border: rgba(255, 255, 255, 0.15);
          }

          *,
          *::before,
          *::after {
            margin: 0;
            padding: 0;
          }

          /* Hide scrollbar globally while keeping scroll functionality */
          * {
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE and Edge */
          }

          *::-webkit-scrollbar {
            display: none; /* Chrome, Safari, Opera */
          }

          html {
            font-size: 100%;
            color: var(--grey-4);
          }

          body {
            background: var(--grey-1);
            font-family: 'Inter', sans-serif;
          }

          h1,
          h2,
          h3,
          h4,
          h5,
          h6 {
            color: var(--grey-5);
            font-weight: 500;
          }

          @media (max-width: 420px) {
            html {
              font-size: 90%;
            }
          }

          // Proesemirror
          .ProseMirror-focused {
            outline: none;
          }

          .ProseMirror .is-editor-empty:first-of-type::before {
            content: attr(data-placeholder);
            float: left;
            color: inherit;
            opacity: 0.5;
            pointer-events: none;
            height: 0;
          }

          .ProseMirror img {
            max-width: 100%;
            height: auto;
          }

          .ProseMirror img.ProseMirror-selectednode {
            box-shadow: 0 0 1rem var(--grey-2);
          }

          /* Reduced motion support */
          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }

          /* Lenis smooth scroll */
          html.lenis {
            height: auto;
          }

          .lenis.lenis-smooth {
            scroll-behavior: auto !important;
          }

          .lenis.lenis-smooth [data-lenis-prevent] {
            overscroll-behavior: contain;
          }
        `}
      />
      <IdProvider>
        <I18nProvider>
          <ThemeProvider defaultTheme="system" attribute="data-theme" enableSystem={true} storageKey="theme">
            <SmoothScrollProvider>
              {/* Premium page transitions */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={displayedPath}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{
                    opacity: isNavigating ? 0.4 : 1,
                    y: isNavigating ? 4 : 0,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: isNavigating ? 0.1 : 0.35,
                    ease: EASE_OUT_EXPO,
                  }}
                >
                  {getLayout(<Component {...pageProps} />, pageProps)}
                </motion.div>
              </AnimatePresence>
            </SmoothScrollProvider>
          </ThemeProvider>
        </I18nProvider>
      </IdProvider>
    </>
  )
}

export default App
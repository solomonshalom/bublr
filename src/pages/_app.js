import 'modern-normalize'
import Head from 'next/head'
import { ThemeProvider } from 'next-themes'
import { Global, css } from '@emotion/react'
import { IdProvider } from '@radix-ui/react-id'
import { useRouter } from 'next/router'
import { I18nProvider } from '../lib/i18n'
import { SmoothScrollProvider } from '../components/smooth-scroll'
import { PageTransition } from '../components/page-transition'

const App = ({ Component, pageProps }) => {
  const getLayout = Component.getLayout || ((page) => page)
  const router = useRouter()

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

          /* Tippy.js Slash Command Theme */
          .tippy-box[data-theme~='slash-command'] {
            background-color: var(--grey-1);
            border: 1px solid var(--grey-2);
            border-radius: 0.5rem;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
            font-family: 'Inter', sans-serif;
            min-width: 240px;
            max-width: 320px;
            max-height: none;
            overflow: visible;
          }

          .tippy-box[data-theme~='slash-command'] .tippy-content {
            padding: 0;
            max-height: 250px;
            overflow-y: auto;
            overflow-x: hidden;
          }

          [data-theme='dark'] .tippy-box[data-theme~='slash-command'] {
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          }

          /* ProseMirror Gapcursor */
          .ProseMirror-gapcursor {
            position: relative;
          }

          .ProseMirror-gapcursor:after {
            content: '';
            display: block;
            position: absolute;
            top: -2px;
            width: 20px;
            border-top: 1px solid var(--grey-4);
            animation: ProseMirror-gapcursor-blink 1.1s steps(2, start) infinite;
          }

          @keyframes ProseMirror-gapcursor-blink {
            to {
              visibility: hidden;
            }
          }

          /* Placeholder styles for TipTap */
          .ProseMirror p.is-editor-empty:first-of-type::before {
            content: attr(data-placeholder);
            float: left;
            color: var(--grey-3);
            pointer-events: none;
            height: 0;
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
          <ThemeProvider defaultTheme="system" attribute="data-theme" enableSystem={true} storageKey="theme" disableTransitionOnChange>
            <SmoothScrollProvider>
              {/* Premium page transitions with GSAP */}
              <PageTransition>
                {getLayout(<Component {...pageProps} />, pageProps)}
              </PageTransition>
            </SmoothScrollProvider>
          </ThemeProvider>
        </I18nProvider>
      </IdProvider>
    </>
  )
}

export default App
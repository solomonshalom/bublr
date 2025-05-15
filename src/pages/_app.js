import 'modern-normalize'
import Head from 'next/head'
import { ThemeProvider } from 'next-themes'
import { Global, css } from '@emotion/react'
import { IdProvider } from '@radix-ui/react-id'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import dynamic from 'next/dynamic'

// Import Firebase for initialization
import firebase from '../lib/firebase'

// Animation for speech controls
const animationStyle = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}`;

const App = ({ Component, pageProps }) => {
  const getLayout = Component.getLayout || (page => page)
  const router = useRouter()
  
  useEffect(() => {
    // Initialize Firebase auth for client
    if (typeof window !== 'undefined' && !window.__FIREBASE_INIT__) {
      window.__FIREBASE_INIT__ = true;
      
      // Notify that Firebase auth is ready
      if (window.__FIREBASE_RESOLVE_AUTH__) {
        window.__FIREBASE_RESOLVE_AUTH__(true);
      }
      
      // Setup service worker
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js').then(
            (registration) => {
              console.log('Service Worker registration successful with scope: ', registration.scope)
            },
            (err) => {
              console.log('Service Worker registration failed: ', err)
            }
          )
        })
      }
    }
    
    // Preload and cache speech capabilities
    if (typeof window !== 'undefined') {
      // Preload speech synthesis capability
      if ('speechSynthesis' in window) {
        // Preload voices
        window.speechSynthesis.getVoices();
      }
      
      // Preload audio context for better performance
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          window._audioContext = new AudioContext();
        }
      } catch (e) {
        console.log('AudioContext initialization failed:', e);
      }
    }
  }, [])

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="theme-color" content="#FCFCFC" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#171717" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Open Graph default fallback values */}
        {!router.pathname.includes('[') && (
          <>
            <meta property="og:site_name" content="Bublr" />
            <meta property="twitter:site" content="@bublr" />
          </>
        )}
      </Head>
      <Global
        styles={css`
          ${animationStyle}
          
          :root {
            --grey-1: #fcfcfc;
            --grey-2: #c7c7c7;
            --grey-3: #6f6f6f;
            --grey-4: #2e2e2e;
            --grey-5: #171717;
          }

          [data-theme='dark'] {
            --grey-1: #171717;
            --grey-2: #2e2e2e;
            --grey-4: #c7c7c7;
            --grey-5: #fcfcfc;
          }

          *,
          *::before,
          *::after {
            margin: 0;
            padding: 0;
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
        `}
      />
      <IdProvider>
        <ThemeProvider defaultTheme="system">
          {getLayout(<Component {...pageProps} />)}
        </ThemeProvider>
      </IdProvider>
    </>
  )
}

export default App

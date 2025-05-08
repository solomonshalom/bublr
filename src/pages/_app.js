import 'modern-normalize'
import Head from 'next/head'
import Script from 'next/script'
import { ThemeProvider } from 'next-themes'
import { Global, css } from '@emotion/react'
import { IdProvider } from '@radix-ui/react-id'

const App = ({ Component, pageProps }) => {
  const getLayout = Component.getLayout || (page => page)

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="application-name" content="Bublr" />
        <meta name="description" content="An open-source, ultra-minimal community for writers, to write." />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Script
        src="https://cloud.umami.is/script.js"
        data-website-id="ec0fac0a-1f2b-44de-90d2-1e224c8d8492"
        strategy="afterInteractive"
      />
      <Global
        styles={css`
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
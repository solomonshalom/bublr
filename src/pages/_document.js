import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx)
    return { ...initialProps }
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          <meta name="application-name" content="Bublr" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Bublr" />
          <meta name="description" content="A minimal writing community" />
          <meta name="format-detection" content="telephone=no" />
          <meta name="mobile-web-app-capable" content="yes" />
          <link rel="apple-touch-icon" href="/images/apple-touch-icon.png" />
        </Head>
        <body>
          {/* Production Firebase auth setup */}
          <script dangerouslySetInnerHTML={{
            __html: `
              // Firebase auth state initialization
              window.__FIREBASE_INIT__ = false;
              window.__FIREBASE_AUTH_READY__ = new Promise((resolve) => {
                window.__FIREBASE_RESOLVE_AUTH__ = resolve;
              });
            `
          }} />
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
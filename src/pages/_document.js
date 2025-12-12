import Document, { Html, Head, Main, NextScript } from 'next/document'

/**
 * Custom Document for Bublr
 *
 * SEO & GEO Optimizations:
 * - Comprehensive meta tags for search engines and AI crawlers
 * - Proper favicon support (including apple-touch-icon, manifest)
 * - Preconnect to critical third-party origins
 * - Security headers via meta tags
 * - Language and locale settings
 * - AI/LLM crawler guidance
 */
class MyDocument extends Document {
  render() {
    return (
      <Html lang="en" dir="ltr" suppressHydrationWarning>
        <Head>
          {/* Character encoding - must be first */}
          <meta charSet="utf-8" />

          {/* Security: Prevent clickjacking */}
          <meta httpEquiv="X-Frame-Options" content="SAMEORIGIN" />

          {/* Security: XSS Protection */}
          <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />

          {/* Security: Content Type Options */}
          <meta httpEquiv="X-Content-Type-Options" content="nosniff" />

          {/* Security: Referrer Policy */}
          <meta name="referrer" content="strict-origin-when-cross-origin" />

          {/* Comprehensive Favicon Support */}
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png" />
          <link rel="manifest" href="/manifest.json" />

          {/* Microsoft Tile */}
          <meta name="msapplication-TileColor" content="#FCFCFC" />

          {/* DNS Prefetch & Preconnect for Performance */}
          <link rel="dns-prefetch" href="//fonts.googleapis.com" />
          <link rel="dns-prefetch" href="//fonts.gstatic.com" />
          <link rel="dns-prefetch" href="//firestore.googleapis.com" />
          <link rel="dns-prefetch" href="//api.dicebear.com" />
          <link rel="dns-prefetch" href="//i.ibb.co" />

          {/* Preconnect with CORS */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="anonymous" />

          {/* GEO: AI/LLM Crawler Guidance */}
          {/* Allow AI crawlers to index and summarize content */}
          <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />

          {/* Specific AI bot permissions */}
          <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1" />
          <meta name="bingbot" content="index, follow, max-image-preview:large" />

          {/* AI Search Engine specific tags (GEO optimization) */}
          <meta name="ChatGPT-verify" content="allow" />
          <meta name="ai-content-summary" content="enabled" />

          {/* Content freshness signals for AI engines */}
          <meta name="revisit-after" content="1 days" />

          {/* Geographic and Language targeting */}
          <meta httpEquiv="Content-Language" content="en-US" />
          <meta name="geo.region" content="US" />
          <meta name="language" content="English" />

          {/* Site verification - configure via environment variables */}
          {process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && (
            <meta name="google-site-verification" content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION} />
          )}
          {process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION && (
            <meta name="msvalidate.01" content={process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION} />
          )}
          {process.env.NEXT_PUBLIC_YANDEX_VERIFICATION && (
            <meta name="yandex-verification" content={process.env.NEXT_PUBLIC_YANDEX_VERIFICATION} />
          )}
          {process.env.NEXT_PUBLIC_PINTEREST_VERIFICATION && (
            <meta name="p:domain_verify" content={process.env.NEXT_PUBLIC_PINTEREST_VERIFICATION} />
          )}

          {/* Format detection - prevent auto-linking */}
          <meta name="format-detection" content="telephone=no" />

          {/* App capable for iOS */}
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Bublr" />

          {/* Windows app settings */}
          <meta name="application-name" content="Bublr" />
          <meta name="mobile-web-app-capable" content="yes" />

          {/* Publisher and Copyright */}
          <meta name="publisher" content="Bublr" />
          <meta name="copyright" content="Bublr" />

          {/* Content category */}
          <meta name="category" content="Writing, Blog, Community" />
          <meta name="classification" content="Writing Platform" />

          {/* Rating */}
          <meta name="rating" content="General" />

          {/* Distribution */}
          <meta name="distribution" content="global" />

          {/* Alternate links for language versions */}
          <link rel="alternate" hrefLang="en" href="https://bublr.life" />
          <link rel="alternate" hrefLang="x-default" href="https://bublr.life" />

          {/* RSS/Atom/JSON Feed autodiscovery links */}
          <link rel="alternate" type="application/rss+xml" title="Bublr RSS Feed" href="https://bublr.life/feed.xml" />
          <link rel="alternate" type="application/atom+xml" title="Bublr Atom Feed" href="https://bublr.life/atom.xml" />
          <link rel="alternate" type="application/feed+json" title="Bublr JSON Feed" href="https://bublr.life/feed.json" />

          {/* Umami Analytics */}
          <script defer src="https://cloud.umami.is/script.js" data-website-id="a5689409-8cdf-475a-8022-d977f83c181e"></script>

          {/* Critical CSS for theme - must be inline to prevent FOUC */}
          <style
            dangerouslySetInnerHTML={{
              __html: `
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
                  color-scheme: light;
                }
                [data-theme='dark'] {
                  --grey-1: #171717;
                  --grey-2: #2e2e2e;
                  --grey-4: #c7c7c7;
                  --grey-5: #fcfcfc;
                  --code-bg: #262626;
                  --code-text: #e5e7eb;
                  --border: rgba(255, 255, 255, 0.15);
                  color-scheme: dark;
                }
                html { background: var(--grey-1); }
                body { background: var(--grey-1); visibility: hidden; }
                body.theme-ready { visibility: visible; }
              `,
            }}
          />
        </Head>
        <body>
          {/* Blocking script to prevent theme flash (FOUC) */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var theme = localStorage.getItem('theme');
                    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    var isDark = theme === 'dark' || (!theme && systemDark);

                    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
                    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
                  } catch (e) {
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                  // Show body immediately after theme is set
                  document.body.classList.add('theme-ready');
                })();
              `,
            }}
          />
          {/* Skip to main content for accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only"
            style={{
              position: 'absolute',
              left: '-9999px',
              top: 'auto',
              width: '1px',
              height: '1px',
              overflow: 'hidden'
            }}
          >
            Skip to main content
          </a>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument

/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import Head from 'next/head'
import { css, Global } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'

import meta from '../../components/meta'

// Global styles - only applies Inter font import
const globalStyles = css`
  @import url('https://fonts.bunny.net/css?family=inter:400,500,600&family=jetbrains-mono:400');
`

export default function NewsletterDocs() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : false

  // Theme-aware colors (matching app's --grey-1)
  const colors = {
    bg: isDark ? '#171717' : '#ffffff',
    text: isDark ? 'rgb(229, 231, 235)' : 'rgb(33, 37, 41)',
    muted: isDark ? 'rgba(229, 231, 235, 0.6)' : 'rgba(33, 37, 41, 0.6)',
    border: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgb(222, 223, 223)',
    codeBg: isDark ? '#262626' : '#f5f5f5',
    codeText: isDark ? '#e5e7eb' : '#374151',
    success: isDark ? '#22c55e' : '#16a34a',
    warning: isDark ? '#eab308' : '#ca8a04',
    error: isDark ? '#ef4444' : '#dc2626',
  }

  const CodeBlock = ({ children }) => (
    <pre
      css={css`
        background: ${colors.codeBg};
        color: ${colors.codeText};
        padding: 1rem;
        border-radius: 8px;
        overflow-x: auto;
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        line-height: 1.6;
        margin: 12px 0;
        border: 1px solid ${colors.border};
      `}
    >
      {children}
    </pre>
  )

  const InlineCode = ({ children }) => (
    <code
      css={css`
        background: ${colors.codeBg};
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.9em;
      `}
    >
      {children}
    </code>
  )

  const Tag = ({ children }) => (
    <span
      css={css`
        background: ${colors.codeBg};
        border: 1px solid ${colors.border};
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 13px;
        font-family: 'JetBrains Mono', monospace;
        display: inline-block;
        margin: 4px 4px 4px 0;
      `}
    >
      {children}
    </span>
  )

  return (
    <>
      <Global styles={globalStyles} />
      <Head>
        {meta({
          title: 'Newsletter Email Templates | Bublr Docs',
          description: 'Learn how to customize your newsletter email templates with placeholder tags for a personalized subscriber experience.',
          url: '/docs/newsletter',
        })}
        <link rel="canonical" href="https://bublr.life/docs/newsletter" />
      </Head>

      <div
        css={css`
          margin: 0;
          font-family: Inter, sans-serif;
          font-size: 14px;
          font-weight: 400;
          line-height: 1.5;
          color: ${colors.text};
          text-align: left;
          background-color: ${colors.bg};
          min-height: 100vh;
          -webkit-text-size-adjust: 100%;
          -webkit-tap-highlight-color: transparent;
          transition: background-color 0.3s ease, color 0.3s ease;

          *, ::after, ::before {
            box-sizing: border-box;
          }

          a {
            color: inherit;
            cursor: pointer;
          }

          p {
            display: block;
            margin-top: 0px;
            margin-bottom: 0px;
            text-align: left;
          }
        `}
      >
        <section
          css={css`
            padding-top: 1.5rem;
            padding-bottom: 1.5rem;

            @media (min-width: 992px) {
              padding: 3rem;
            }
          `}
        >
          <div
            css={css`
              max-width: 700px;
              width: 100%;
              padding-right: 0.75rem;
              padding-left: 0.75rem;
              margin-right: auto;
              margin-left: auto;
            `}
          >
            <div
              css={css`
                padding: 1.5rem;

                @media (min-width: 992px) {
                  padding: 3rem;
                }
              `}
            >
              <Link href="/">
                <a css={css`text-decoration: none; font-size: 2rem;`}>
                  🍱
                </a>
              </Link>

              <p css={css`color: ${colors.muted}; margin-top: 32px; font-size: 12px;`}>
                <Link href="/docs"><a css={css`border-bottom: 1px dotted ${colors.muted};`}>Docs</a></Link>
                {' → Newsletter Templates'}
              </p>

              <h1
                css={css`
                  font-size: 1.25rem;
                  font-weight: 500;
                  margin-top: 12px;
                  margin-bottom: 8px;
                  line-height: 1.2;
                `}
              >
                Custom Newsletter Email Templates
              </h1>

              <p css={css`color: ${colors.muted}; margin-bottom: 32px;`}>
                Personalize the emails sent to your subscribers
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              {/* Overview */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Overview
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                With a paid subscription, you can fully customize the HTML email template that gets sent to your newsletter subscribers when you publish a new post. Use placeholder tags to dynamically insert post content, your author info, and more.
              </p>

              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                Access this feature from <Link href="/dashboard"><a css={css`border-bottom: 1px dotted ${colors.muted};`}>Profile Settings</a></Link> → Custom Domain section → Newsletter Email Template.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              {/* Placeholder Tags */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Placeholder Tags
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                Use these tags in your HTML template. They will be replaced with actual content when the email is sent:
              </p>

              <div css={css`margin-top: 16px;`}>
                <Tag>{'{{title}}'}</Tag>
                <Tag>{'{{excerpt}}'}</Tag>
                <Tag>{'{{content}}'}</Tag>
                <Tag>{'{{authorName}}'}</Tag>
                <Tag>{'{{authorPhoto}}'}</Tag>
                <Tag>{'{{postUrl}}'}</Tag>
                <Tag>{'{{postColor}}'}</Tag>
                <Tag>{'{{unsubscribeUrl}}'}</Tag>
              </div>

              <div css={css`margin-top: 24px;`}>
                <p css={css`font-weight: 500; margin-bottom: 12px; font-size: 13px;`}>
                  Tag Reference
                </p>
                <ul css={css`color: ${colors.muted}; margin-top: 8px; margin-left: 1.25rem; line-height: 2;`}>
                  <li><InlineCode>{'{{title}}'}</InlineCode> — Post title (plain text)</li>
                  <li><InlineCode>{'{{excerpt}}'}</InlineCode> — Post excerpt, max 300 characters</li>
                  <li><InlineCode>{'{{content}}'}</InlineCode> — Content preview, max 500 characters</li>
                  <li><InlineCode>{'{{authorName}}'}</InlineCode> — Your display name</li>
                  <li><InlineCode>{'{{authorPhoto}}'}</InlineCode> — URL to your profile photo</li>
                  <li><InlineCode>{'{{postUrl}}'}</InlineCode> — Full URL to read the post</li>
                  <li><InlineCode>{'{{postColor}}'}</InlineCode> — Post&apos;s accent color (hex, e.g. #4D96FF)</li>
                  <li><InlineCode>{'{{unsubscribeUrl}}'}</InlineCode> — Unsubscribe link <strong>(required)</strong></li>
                </ul>
              </div>

              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                Snake_case versions are also supported: <InlineCode>{'{{post_url}}'}</InlineCode>, <InlineCode>{'{{author_name}}'}</InlineCode>, etc.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              {/* Important Note */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Unsubscribe Link Requirement
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                Your template <strong>must</strong> include the <InlineCode>{'{{unsubscribeUrl}}'}</InlineCode> placeholder. This is required for email compliance (CAN-SPAM, GDPR). Templates without this tag will be rejected.
              </p>

              <CodeBlock>{`<a href="{{unsubscribeUrl}}">Unsubscribe</a>`}</CodeBlock>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              {/* Example Template */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Example Template
              </p>
              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                Here&apos;s a minimal example you can customize. For best email client compatibility, use table-based layouts:
              </p>

              <CodeBlock>{`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: sans-serif; background: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px;">
    <tr>
      <td style="padding: 32px;">
        <!-- Author -->
        <img src="{{authorPhoto}}" width="48" height="48" style="border-radius: 50%;">
        <p style="margin: 16px 0 0 0; font-weight: 500;">{{authorName}}</p>

        <!-- Post -->
        <h1 style="margin: 24px 0 16px 0; font-size: 24px;">
          <a href="{{postUrl}}" style="color: #000; text-decoration: none;">{{title}}</a>
        </h1>

        <p style="color: #666; line-height: 1.6;">{{excerpt}}</p>

        <a href="{{postUrl}}" style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: {{postColor}}; color: #fff; text-decoration: none; border-radius: 6px;">
          Read Post
        </a>

        <!-- Footer -->
        <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #999;">
          <a href="{{unsubscribeUrl}}" style="color: #999;">Unsubscribe</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`}</CodeBlock>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              {/* Tips */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Tips for Email Templates
              </p>
              <ul css={css`color: ${colors.muted}; margin-top: 16px; margin-left: 1.25rem; line-height: 1.9;`}>
                <li>Use <strong>inline styles</strong> — most email clients strip &lt;style&gt; tags</li>
                <li>Use <strong>table layouts</strong> — flexbox and grid aren&apos;t well supported</li>
                <li>Keep it <strong>under 50KB</strong> — large emails may be clipped</li>
                <li>Test with <strong>multiple email clients</strong> (Gmail, Outlook, Apple Mail)</li>
                <li>Use <strong>web-safe fonts</strong> or system font stacks</li>
                <li>Always include <strong>alt text</strong> for images</li>
              </ul>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: ${colors.text};`} />

              {/* How to Use */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                How to Set Your Template
              </p>
              <ol css={css`color: ${colors.muted}; margin-top: 16px; margin-left: 1.25rem; line-height: 1.9;`}>
                <li>Go to your <Link href="/dashboard"><a css={css`border-bottom: 1px dotted ${colors.muted};`}>Dashboard</a></Link></li>
                <li>Click the settings icon (gear) to open Profile Settings</li>
                <li>Scroll to the Custom Domain section</li>
                <li>Expand &quot;Newsletter Email Template&quot;</li>
                <li>Click &quot;Load Default&quot; to start with our template, or paste your own</li>
                <li>Click &quot;Save Template&quot;</li>
              </ol>

              <p css={css`color: ${colors.muted}; margin-top: 16px; line-height: 1.7;`}>
                Your custom template will be used for all future newsletter emails. You can reset to the default at any time.
              </p>

              {/* Footer */}
              <div css={css`font-size: 12px; margin-top: 64px;`}>
                <p css={css`color: ${colors.muted}; a { color: inherit; }`}>
                  Copyright &copy; {currentYear} Bublr<br />
                  <Link href="/"><a>Home</a></Link>
                  &nbsp;&middot;&nbsp;
                  <Link href="/docs"><a>API Docs</a></Link>
                  &nbsp;&middot;&nbsp;
                  <Link href="/about"><a>About</a></Link>
                  &nbsp;&middot;&nbsp;
                  <Link href="/terms"><a>Terms</a></Link>
                  &nbsp;&middot;&nbsp;
                  <Link href="/privacy"><a>Privacy</a></Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

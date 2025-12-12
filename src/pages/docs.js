/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import Head from 'next/head'
import { css, Global } from '@emotion/react'

import meta from '../components/meta'

// Global styles - only applies Inter font import
const globalStyles = css`
  @import url('https://fonts.bunny.net/css?family=inter:400,500,600&family=jetbrains-mono:400');
`

// Code block component using CSS variables
const CodeBlock = ({ children }) => (
  <pre
    css={css`
      background: var(--code-bg);
      color: var(--code-text);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      line-height: 1.6;
      margin: 12px 0;
      border: 1px solid var(--border);
    `}
  >
    {children}
  </pre>
)

// Inline code component
const InlineCode = ({ children }) => (
  <code
    css={css`
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9em;
    `}
  >
    {children}
  </code>
)

export default function Docs() {
  const currentYear = new Date().getFullYear()

  const MethodBadge = ({ method }) => {
    const methodColors = {
      GET: { bg: '#dcfce7', text: '#166534' },
      POST: { bg: '#dbeafe', text: '#1d4ed8' },
      PUT: { bg: '#fef3c7', text: '#92400e' },
      DELETE: { bg: '#fee2e2', text: '#991b1b' },
    }
    const c = methodColors[method] || methodColors.GET

    return (
      <span
        css={css`
          background: ${c.bg};
          color: ${c.text};
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
          margin-right: 8px;
        `}
      >
        {method}
      </span>
    )
  }

  const Endpoint = ({ method, path, description }) => (
    <div
      css={css`
        background: var(--code-bg);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px 16px;
        margin: 12px 0;
      `}
    >
      <div css={css`display: flex; align-items: center; flex-wrap: wrap; gap: 8px;`}>
        <MethodBadge method={method} />
        <code css={css`font-family: 'JetBrains Mono', monospace; font-size: 14px;`}>
          {path}
        </code>
      </div>
      {description && (
        <p css={css`color: var(--grey-3); margin-top: 8px; margin-bottom: 0; font-size: 13px;`}>
          {description}
        </p>
      )}
    </div>
  )

  return (
    <>
      <Global styles={globalStyles} />
      <Head>
        {meta({
          title: 'API Documentation | Bublr',
          description: 'Complete API documentation for the Bublr API. Learn how to integrate your applications with Bublr programmatically.',
          url: '/docs',
        })}
        <link rel="canonical" href="https://bublr.life/docs" />
      </Head>

      <div
        css={css`
          margin: 0;
          font-family: Inter, sans-serif;
          font-size: 14px;
          font-weight: 400;
          line-height: 1.5;
          color: var(--grey-4);
          text-align: left;
          background-color: var(--grey-1);
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

              <h1
                css={css`
                  font-size: 1.25rem;
                  font-weight: 500;
                  margin-top: 32px;
                  margin-bottom: 8px;
                  line-height: 1.2;
                `}
              >
                API Documentation
              </h1>

              <p css={css`color: var(--grey-3); margin-bottom: 32px;`}>
                Integrate with Bublr programmatically
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              {/* Getting Started */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Getting Started
              </p>
              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                The Bublr API allows you to manage your posts and profile programmatically. You can list posts, read content, update your profile, and publish new articles via the API.
              </p>

              <p css={css`font-weight: 500; margin-top: 24px; margin-bottom: 8px;`}>
                Base URL
              </p>
              <CodeBlock>https://bublr.life/api/v1</CodeBlock>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              {/* Authentication */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Authentication
              </p>
              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                All API requests require authentication using an API key. You can create API keys from your <Link href="/dashboard"><a css={css`border-bottom: 1px dotted var(--grey-3);`}>Profile Settings</a></Link> → Advanced.
              </p>

              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                Include your API key in the <InlineCode>Authorization</InlineCode> header:
              </p>

              <CodeBlock>{`Authorization: Bearer bublr_sk_your_api_key_here`}</CodeBlock>

              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                <strong>Important:</strong> Keep your API keys secure. Never expose them in client-side code or public repositories. You can create up to 5 API keys and revoke them at any time.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              {/* Rate Limits */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Rate Limits
              </p>
              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                The API has the following rate limits to ensure fair usage:
              </p>
              <ul css={css`color: var(--grey-3); margin-top: 12px; margin-left: 1.25rem; line-height: 1.7;`}>
                <li><strong>100 requests per minute</strong> for read operations (GET)</li>
                <li><strong>30 requests per minute</strong> for write operations (POST, PUT, DELETE)</li>
              </ul>
              <p css={css`color: var(--grey-3); margin-top: 12px; line-height: 1.7;`}>
                If you exceed these limits, you&apos;ll receive a <InlineCode>429 Too Many Requests</InlineCode> response.
              </p>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              {/* Endpoints */}
              <p css={css`font-weight: 600; margin-bottom: 16px; font-size: 1.1rem;`}>
                Endpoints
              </p>

              {/* Profile */}
              <p css={css`font-weight: 500; margin-bottom: 8px; margin-top: 24px;`}>
                Profile
              </p>

              <Endpoint
                method="GET"
                path="/profile"
                description="Get your profile information"
              />

              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                <strong>Response:</strong>
              </p>
              <CodeBlock>{`{
  "profile": {
    "name": "johndoe",
    "displayName": "John Doe",
    "about": "Writer and developer",
    "photo": "https://...",
    "link": "https://johndoe.com",
    "socialLinks": {
      "twitter": "johndoe",
      "github": "johndoe"
    },
    "skills": ["javascript", "react", "writing"],
    "postsCount": 12,
    "subscribersCount": 45
  }
}`}</CodeBlock>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              {/* Posts */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Posts
              </p>

              <Endpoint
                method="GET"
                path="/posts"
                description="List all your posts"
              />

              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                <strong>Query Parameters:</strong>
              </p>
              <ul css={css`color: var(--grey-3); margin-top: 8px; margin-left: 1.25rem; line-height: 1.7;`}>
                <li><InlineCode>published</InlineCode> — Filter by publish status (<InlineCode>true</InlineCode> or <InlineCode>false</InlineCode>)</li>
                <li><InlineCode>limit</InlineCode> — Number of posts to return (default: 50, max: 100)</li>
                <li><InlineCode>offset</InlineCode> — Number of posts to skip for pagination</li>
              </ul>

              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                <strong>Response:</strong>
              </p>
              <CodeBlock>{`{
  "posts": [
    {
      "id": "abc123",
      "slug": "my-first-post",
      "title": "My First Post",
      "excerpt": "A brief summary...",
      "published": true,
      "lastEdited": "2024-01-15T10:30:00.000Z",
      "createdAt": 1705312200000,
      "dotColor": "#4D96FF"
    }
  ],
  "total": 12,
  "limit": 50,
  "offset": 0
}`}</CodeBlock>

              <Endpoint
                method="GET"
                path="/posts/:slug"
                description="Get a single post by slug"
              />

              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                <strong>Response:</strong>
              </p>
              <CodeBlock>{`{
  "post": {
    "id": "abc123",
    "slug": "my-first-post",
    "title": "My First Post",
    "excerpt": "A brief summary...",
    "content": "<p>Full HTML content...</p>",
    "published": true,
    "lastEdited": "2024-01-15T10:30:00.000Z",
    "createdAt": 1705312200000,
    "dotColor": "#4D96FF"
  }
}`}</CodeBlock>

              <Endpoint
                method="POST"
                path="/posts"
                description="Create a new post"
              />

              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                <strong>Request Body:</strong>
              </p>
              <CodeBlock>{`{
  "title": "My New Post",        // Required, max 200 chars
  "excerpt": "A brief summary",  // Optional, max 500 chars
  "content": "<p>HTML content</p>", // Optional, max 500KB
  "slug": "my-new-post",         // Optional, auto-generated if not provided
  "published": false,            // Optional, default: false
  "dotColor": "#4D96FF"          // Optional, hex color
}`}</CodeBlock>

              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                <strong>Response:</strong>
              </p>
              <CodeBlock>{`{
  "success": true,
  "post": {
    "id": "xyz789",
    "slug": "my-new-post",
    "title": "My New Post",
    "excerpt": "A brief summary",
    "published": false,
    "createdAt": 1705312200000
  },
  "message": "Post created as draft"
}`}</CodeBlock>

              <Endpoint
                method="PUT"
                path="/posts/:slug"
                description="Update an existing post"
              />

              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                <strong>Request Body:</strong> (all fields optional)
              </p>
              <CodeBlock>{`{
  "title": "Updated Title",
  "excerpt": "Updated summary",
  "content": "<p>Updated content</p>",
  "published": true,
  "newSlug": "new-url-slug",
  "dotColor": "#FF6B6B"
}`}</CodeBlock>

              <Endpoint
                method="DELETE"
                path="/posts/:slug"
                description="Delete a post permanently"
              />

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              {/* Error Handling */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Error Handling
              </p>
              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                The API returns consistent error responses with an <InlineCode>error</InlineCode> message and <InlineCode>code</InlineCode>:
              </p>

              <CodeBlock>{`{
  "error": "Invalid API key format. Keys should start with bublr_sk_",
  "code": "INVALID_KEY_FORMAT"
}`}</CodeBlock>

              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                <strong>Common Error Codes:</strong>
              </p>
              <ul css={css`color: var(--grey-3); margin-top: 8px; margin-left: 1.25rem; line-height: 1.7;`}>
                <li><InlineCode>MISSING_AUTH</InlineCode> — Authorization header not provided</li>
                <li><InlineCode>INVALID_KEY_FORMAT</InlineCode> — API key format is invalid</li>
                <li><InlineCode>INVALID_KEY</InlineCode> — API key not found or invalid</li>
                <li><InlineCode>KEY_REVOKED</InlineCode> — API key has been revoked</li>
                <li><InlineCode>INVALID_INPUT</InlineCode> — Request validation failed</li>
                <li><InlineCode>RATE_LIMITED</InlineCode> — Too many requests</li>
              </ul>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              {/* Example */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Example: Publishing a Post with cURL
              </p>

              <CodeBlock>{`curl -X POST https://bublr.life/api/v1/posts \\
  -H "Authorization: Bearer bublr_sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Hello from the API",
    "excerpt": "My first API-published post",
    "content": "<p>This post was created via the Bublr API!</p>",
    "published": true
  }'`}</CodeBlock>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              {/* SDK */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                JavaScript Example
              </p>

              <CodeBlock>{`const BUBLR_API_KEY = 'bublr_sk_your_api_key';
const BASE_URL = 'https://bublr.life/api/v1';

// Fetch all published posts
async function getPosts() {
  const response = await fetch(\`\${BASE_URL}/posts?published=true\`, {
    headers: {
      'Authorization': \`Bearer \${BUBLR_API_KEY}\`
    }
  });
  return response.json();
}

// Create a new post
async function createPost(title, content) {
  const response = await fetch(\`\${BASE_URL}/posts\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${BUBLR_API_KEY}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, content, published: true })
  });
  return response.json();
}`}</CodeBlock>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              {/* Content Moderation */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Content Moderation
              </p>
              <p css={css`color: var(--grey-3); margin-top: 16px; line-height: 1.7;`}>
                When publishing posts via the API, content is automatically moderated for spam, inappropriate content, and policy violations. If content is flagged, the post will be created but not published, and the response will include moderation details:
              </p>

              <CodeBlock>{`{
  "success": true,
  "post": {
    "id": "xyz789",
    "slug": "my-post",
    "published": false
  },
  "moderated": true,
  "moderationReason": "Content flagged as promotional spam",
  "message": "Post created but not published due to content moderation"
}`}</CodeBlock>

              <hr css={css`opacity: 0.15; margin-top: 32px; margin-bottom: 32px; border-color: var(--grey-4);`} />

              {/* Other Docs */}
              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                Other Documentation
              </p>
              <ul css={css`color: var(--grey-3); margin-top: 16px; margin-left: 1.25rem; line-height: 1.9;`}>
                <li>
                  <Link href="/docs/newsletter">
                    <a css={css`border-bottom: 1px dotted var(--grey-3);`}>Newsletter Email Templates</a>
                  </Link>
                  {' — Customize the emails sent to your subscribers'}
                </li>
              </ul>

              {/* Footer */}
              <div css={css`font-size: 12px; margin-top: 64px;`}>
                <p css={css`color: var(--grey-3); a { color: inherit; }`}>
                  Copyright &copy; {currentYear} Bublr<br />
                  <Link href="/"><a>Home</a></Link>
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

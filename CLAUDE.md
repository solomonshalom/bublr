# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
npm install --force      # Install dependencies (--force needed due to legacy peer deps)
npm run dev              # Start development server
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint
npm test                 # Unit + API route tests (Node built-in runner; run npm install --force first)
```

Tests live in `test/unit/`. A loader hook (`test/unit/loader.mjs`) resolves extensionless imports and swaps `src/lib/firebase.js`, `src/lib/resend.js` and `groq-sdk` for in-memory mocks, so real API handlers run offline. `test/unit/helpers.mjs` signs test Firebase ID tokens.

Note: All npm scripts include `NODE_OPTIONS='--openssl-legacy-provider'` due to the older Next.js version (11.0.1).

## Architecture Overview

Bublr is a minimal writing platform built with Next.js 11, Firebase (Firestore + Auth), and Emotion CSS-in-JS.

### Tech Stack
- **Framework**: Next.js 11 with Pages Router
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication (Google sign-in)
- **Styling**: Emotion CSS-in-JS with `@emotion/react`
- **Rich Text Editor**: TipTap (for post creation/editing)
- **Theming**: `next-themes` for dark/light mode

### Key Data Models (Firestore Collections)

**users**
- `name`: unique username/ID used in URLs
- `displayName`: user's display name
- `photo`: profile picture URL (DiceBear avatars for new users)
- `posts`: array of post IDs authored by user
- `readingList`: array of saved post IDs
- `about`: user bio
- `subscribers`: array of newsletter subscriber objects (`{ email, subscribedAt }`)
- `subscription`: object containing Creem subscription data (`{ id, status, customerId, productId, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, lastEventAt }`). Records written before the move to Creem have Polar IDs (UUIDs, not `sub_`/`cust_`)
- `hasCustomDomainAccess`: boolean flag for active custom domain subscription
- `customDomain`: object for custom domain config (`{ domain, status, verification, addedAt, verifiedAt }`)
- `customBranding`: object for custom branding (`{ footerText, updatedAt }`)
- `profileCode`: the writer's Profile HTML (`{ html, css, js, mode: 'off'|'block'|'page', placement: 'top'|'bottom', version, updatedAt }`). Saved snapshots live in the `profileCodeRevisions` subcollection (newest 20 kept)

**posts**
- `title`, `content`, `excerpt`: post content (HTML from TipTap)
- `slug`: URL-friendly identifier
- `author`: user ID
- `published`: boolean visibility flag
- `lastEdited`: Firestore timestamp
- `searchQueries`: array of tokenized terms for fuzzy search
- `dotColor`: optional custom color for the post (hex string, e.g. `#4D96FF`)
- `shareToken`: optional 48-char hex token for a draft's private link (`/draft/<token>`); never send it to public pages

### Page Structure (`src/pages/`)

- `/` - Landing page with Google sign-in
- `/dashboard` - User's post management (create, edit, list)
- `/dashboard/[pid]` - Post editor with TipTap
- `/dashboard/list` - Reading list
- `/dashboard/settings/advanced` - Theme, export (Markdown + JSON .zip), language, custom domain, delete account
- `/dashboard/settings/html` - Profile HTML editor (code, live preview, templates, tag reference, AI helper, history)
- `/explore` - Global post discovery with search (public; no account needed)
- `/draft/[token]` - A draft shared by private link (SSR, noindex; redirects to the live post once published)
- `/[username]` - User profile page
- `/[username]/[slug]` - Published post view (SSG with ISR)

### Important Patterns

**Layout Pattern**: Pages use `getLayout` function for per-page layouts:
```javascript
PageComponent.getLayout = function PageLayout(page) {
  return <Container>{page}</Container>
}
```

**Firebase Hooks**: Uses `react-firebase-hooks` for real-time data:
- `useAuthState(auth)` for authentication state
- `useDocumentData`, `useCollectionData` for Firestore queries

**Search**: Client-side fuzzy search with Levenshtein distance in `src/lib/db.js`, scored over the 100 most recently edited published posts.

**API route auth**: API routes run the Firebase *client* SDK (no admin credentials), so they must verify who is calling. The browser sends the Firebase ID token with `authedFetch` (`src/lib/authed-fetch.js`), and routes check it with `requireAuth(req, res)` / `requireSelf(req, res, claimedUserId)` from `src/lib/server-auth.js`. Never trust a `userId` from the request body. Shared-secret routes use `hasSharedSecret`. The public developer API (`/api/v1/*`) authenticates with `bublr_sk_` API keys instead (`src/lib/api-auth.js`).

**Public page props**: Everything in `getServerSideProps`/`getStaticProps` props is public. Pass users through `toPublicUser` / `toPostAuthor` and posts through `toPublicPost` (`src/lib/public-user.js`); never pass a raw user document.

**Rendering post HTML**: Always use `sanitizePostHtml` (`src/lib/sanitize-post.js`). It keeps what the editor produces (callouts, task lists, highlights) and marks links `nofollow ugc`. Inline JSON-LD goes through `safeJsonLd` (`src/lib/escape.js`).

**Publishing**: `setPostPublished` in `src/lib/publishing.js` runs moderation and, on the first successful publish only, notifies followers and emails subscribers. Both `/api/posts/publish` (dashboard) and `/api/v1/posts` (API) call it directly.

**Draft sharing**: `POST /api/posts/share` (`{ postId, enabled }`, author only) sets or deletes `shareToken`; `getSharedDraft` in `src/lib/draft-share.js` returns only what the `/draft/[token]` page shows. `toPublicPost` strips the token.

**Account deletion**: `POST /api/account/delete` (`{ confirm: "delete my account" }`) needs a sign-in from the last 10 minutes (`auth_time`), refuses while a subscription would renew, then runs `deleteAccountData` in `src/lib/delete-account.js`. Anything new that stores a writer's data (a collection, or their uid in someone else's document) must be removed there too. The browser deletes the Firebase sign-in record afterwards.

**Creem billing**: `src/lib/creem.js` calls Creem's REST API with `fetch` (start a checkout, open the billing portal); there is no SDK. `/api/subscription/webhook` checks and reads deliveries with `validateEvent` from `src/lib/creem-webhook.js` (hex HMAC-SHA256 of the raw body in the `creem-signature` header) and answers 200 to everything it has no use for, because Creem retries anything else. Creem has no cancel-at-period-end flag: status `scheduled_cancel` or `canceled` sets `cancelAtPeriodEnd`, and access lasts until `currentPeriodEnd`. The record is written in a transaction, and an event older than `lastEventAt` is skipped (Creem retries for up to a day, so deliveries arrive out of order). In Creem, the endpoint URL must be `https://www.bublr.life/api/subscription/webhook` (the bare domain redirects). Events about products other than the custom domain plans are acknowledged and ignored, so the Creem store can be shared with other apps.

**Timestamps**: Read `lastEdited` with `toMillis` (`src/lib/timestamps.js`). Older API-created posts stored `{ _seconds }` maps; write `firebase.firestore.Timestamp` values.

**Profile HTML** (MySpace-style custom profiles): writers write HTML/CSS/JS that replaces their profile (`mode: 'page'`) or sits in it as a section (`'block'`). Their code must never run on the bublr.life origin. It is served by `/api/profile-frame/[username]` and previewed through `/api/profile-preview`, both with a `Content-Security-Policy: sandbox` header (no `allow-same-origin`), and shown in an `<iframe sandbox>` (`ProfileCodeFrame`). That way scripts can't read the visitor's Firebase sign-in, cookies or storage, submit forms, open dialogs or touch the page around them. Those two paths are deliberately left out of the site-wide CSP in `next.config.js` (two CSPs would both apply and forbid framing); a test checks the routing. Everything about rendering is in `src/lib/profile-code.js` so the preview and the live page build the same document: `{{tags}}` (a small, budgeted Mustache subset), `<bublr-*>` widgets expanded server-side, `window.bublr` data, and the theme/height messages. `toPublicUser` reduces `profileCode` to `{ mode, placement, version }` so page props never carry the code. Saves go through `POST /api/profile/code` (validation, moderation when shown, version check, history), which signs the code (`src/lib/profile-code-signature.js`, HMAC with a server secret). The database rules can't stop someone writing a user document directly, so only signed code is shown: every page that renders a profile must run `trustedProfileCode` and `profileCodeHeaders` (COOP, so pop-ups from the frame can't reach back to the tab) in its `getServerSideProps`, and the frame route checks the signature too. The frame only answers at its canonical `?embed=…&v=<version>` URL (anything else redirects), so the CDN copy serves everyone. Templates render on the server for every frame request, so keep all parsing in that file single-pass: no regex with two quantifiers over the same characters (a test feeds it hostile input with time limits). The AI helper is `POST /api/profile/code-ai` (Groq; nothing saved). Visitors can always reach the normal profile with `?classic=1`.

**Reserved usernames**: Any new top-level page must be added to `src/lib/reserved-usernames.js` (a test enforces this).

### Environment Variables

Required in `.env.local`:
- Firebase config (see `src/lib/firebase-config.js`)
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name for image/video uploads
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret (server-side only; used by `/api/cloudinary-sign` to sign direct uploads)
- `GROQ_API_KEY` - Groq API key for AI content moderation and the Profile HTML AI helper
- `PROFILE_CODE_SECRET` - (Optional) Signs saved Profile HTML (falls back to `UNSUBSCRIBE_SECRET`, `RESEND_API_KEY`, then `MODERATION_SECRET_KEY`). Changing it hides every custom profile until its writer saves again
- `GROQ_CODE_MODEL` - (Optional) Groq model the Profile HTML AI helper tries first (falls back to `openai/gpt-oss-120b`, then `llama-3.3-70b-versatile`)
- `MODERATION_SECRET_KEY` - Secret key for moderation API endpoints
- `RESEND_API_KEY` - Resend API key for newsletter email notifications
- `UNSUBSCRIBE_SECRET` - (Optional) Signs newsletter unsubscribe links (falls back to `RESEND_API_KEY`)
- `RESEND_FROM_EMAIL` - (Optional) Sender email for newsletters (default: `Bublr <notifications@bublr.life>`)
- `NEXT_PUBLIC_BASE_URL` - (Optional) Base URL for the app (default: `https://bublr.life`)

**Custom Domain Feature (Creem + Vercel):**
- `CREEM_API_KEY` - Creem API key (Settings → API keys; needs Checkouts and Customers read/write). A `creem_test_` key uses the test API
- `CREEM_CUSTOM_DOMAIN_PRODUCT_ID` - Product ID for the $2/month custom domain subscription
- `CREEM_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID` - (Optional) Product ID for the yearly plan, so its webhook events are recognised
- `CREEM_WEBHOOK_SECRET` - Signing secret of the Creem webhook endpoint
- `VERCEL_TOKEN` - Vercel API token for domain management
- `VERCEL_PROJECT_ID` - Your Vercel project ID
- `VERCEL_TEAM_ID` - (Optional) Vercel team ID if using team account

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
- `subscription`: Bublr Pro billing record from Dodo Payments (`{ provider: 'dodo', id, status, customerId, productId, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, graceUntil, lastSyncedAt }`); older Polar records have no `provider`
- `hasCustomDomainAccess`: boolean written whenever billing changes. Read access with `hasActiveAccess(user)` from `src/lib/subscription.js`, never the flag alone (paid-through and grace dates matter)
- `pendingCheckout`: `{ sessionId, email, createdAt }` while a checkout is open
- `customDomain`: object for custom domain config (`{ domain, companion, status: 'pending'|'verified', records, message, addedAt, verifiedAt, lastCheckedAt }`); `companion` is the www/apex partner that redirects to `domain`
- `customBranding`: object for custom branding (`{ footerText, updatedAt }`)

**posts**
- `title`, `content`, `excerpt`: post content (HTML from TipTap)
- `slug`: URL-friendly identifier
- `author`: user ID
- `published`: boolean visibility flag
- `lastEdited`: Firestore timestamp
- `searchQueries`: array of tokenized terms for fuzzy search
- `dotColor`: optional custom color for the post (hex string, e.g. `#4D96FF`)

### Page Structure (`src/pages/`)

- `/` - Landing page with Google sign-in
- `/dashboard` - User's post management (create, edit, list)
- `/dashboard/[pid]` - Post editor with TipTap
- `/dashboard/list` - Reading list
- `/dashboard/settings/advanced` - Theme, export (Markdown + JSON .zip), language
- `/dashboard/settings/domain` - Bublr Pro ($4.99/mo): checkout, plan management, custom domain setup, footer text, newsletter template
- `/docs/custom-domains` - Public guide to Pro and custom domains
- `/explore` - Global post discovery with search (public; no account needed)
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

**Timestamps**: Read `lastEdited` with `toMillis` (`src/lib/timestamps.js`). Older API-created posts stored `{ _seconds }` maps; write `firebase.firestore.Timestamp` values.

**Reserved usernames**: Any new top-level page must be added to `src/lib/reserved-usernames.js` (a test enforces this).

**Bublr Pro billing (Dodo Payments)**: `src/lib/dodo.js` is a small REST client plus Standard Webhooks verification. Every route funnels a Dodo subscription object through `applyDodoSubscription` (`src/lib/billing.js`), which links it to the writer (metadata, stored IDs, then the open checkout's email), ignores stale/other subscriptions, writes in a transaction and emails only on real state changes. The webhook re-reads the subscription from Dodo because deliveries can be late, duplicated or out of order; `/api/subscription/sync` does the same right after checkout. Price copy lives in `src/lib/pricing.js`.

**Custom domains**: `src/lib/custom-domains.js` talks to Vercel (`src/lib/vercel.js`): a 400 on add means "already on this project" (fine), 409 means "on another project" (refuse). `parseDomainInput` / `isPlatformHost` in `src/lib/domain-utils.js` keep Bublr's own and Vercel hosts unclaimable. Requests on a writer's domain are routed by `routeCustomDomain` (`src/lib/custom-domain-routing.js`): `/` is the profile, `/<slug>` a post, lapsed Pro redirects to bublr.life. Profile and post page props come from `buildProfilePageProps` / `buildPostPageProps` so bublr.life and custom domains render identically.

### Environment Variables

Required in `.env.local`:
- Firebase config (see `src/lib/firebase-config.js`)
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name for image/video uploads
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret (server-side only; used by `/api/cloudinary-sign` to sign direct uploads)
- `GROQ_API_KEY` - Groq API key for AI content moderation
- `MODERATION_SECRET_KEY` - Secret key for moderation API endpoints
- `RESEND_API_KEY` - Resend API key for newsletter email notifications
- `RESEND_FROM_EMAIL` - (Optional) Sender email for newsletters (default: `Bublr <notifications@bublr.life>`)
- `NEXT_PUBLIC_BASE_URL` - (Optional) Base URL for the app (default: `https://bublr.life`)

**Bublr Pro (Dodo Payments + Vercel):**
- `DODO_PAYMENTS_API_KEY` - Dodo Payments API key
- `DODO_PAYMENTS_WEBHOOK_KEY` - Signing secret of the webhook pointing at `/api/subscription/webhook`
- `DODO_PAYMENTS_PRODUCT_ID` - The $4.99/month subscription product (comma-separate to also honour older products)
- `DODO_PAYMENTS_ENVIRONMENT` - (Optional) `test_mode` or `live_mode`
- `VERCEL_TOKEN` - Vercel API token for domain management
- `VERCEL_PROJECT_ID` - Your Vercel project ID
- `VERCEL_TEAM_ID` - (Optional) Vercel team ID if using team account

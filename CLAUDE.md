# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
npm install              # Install dependencies (Node 24.12 or newer)
npm run dev              # Start development server (Turbopack)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint (flat config in eslint.config.mjs)
npm test                 # Unit + API route tests (Node built-in runner; run npm install first)
```

Tests live in `test/unit/`. A loader hook (`test/unit/loader.mjs`) resolves extensionless imports and swaps `src/lib/firebase.js`, `src/lib/resend.js`, `groq-sdk` and `@polar-sh/sdk` for in-memory mocks, so real API handlers run offline. `test/unit/helpers.mjs` signs test Firebase ID tokens.

Both lockfiles are kept: after changing dependencies run `npm install` and `bun install --lockfile-only`.

Next.js ships its own docs in `node_modules/next/dist/docs/` (Pages Router guides under `02-pages`). Read the relevant one before changing framework-level code; this version differs from older Next.js in many small ways.

## Architecture Overview

Bublr is a minimal writing platform built with Next.js 16, React 19, Firebase (Firestore + Auth), and Emotion CSS-in-JS.

### Tech Stack
- **Framework**: Next.js 16 with Pages Router (Turbopack for dev and build)
- **Database**: Firebase Firestore, through the SDK's `compat` entry points (see Firebase below)
- **Auth**: Firebase Authentication (Google sign-in, email and password)
- **Styling**: Emotion CSS-in-JS with `@emotion/react`
- **Rich Text Editor**: TipTap 3 (for post creation/editing)
- **Dialogs**: Radix UI Dialog 1.x
- **Theming**: `next-themes` for dark/light mode
- **Billing**: Polar SDK, kept on the 0.x line (1.x is a rewrite tied to dated API versions; moving needs a Polar sandbox to test against)

### Key Data Models (Firestore Collections)

**users**
- `name`: unique username/ID used in URLs
- `displayName`: user's display name
- `photo`: profile picture URL (DiceBear avatars for new users)
- `posts`: array of post IDs authored by user
- `readingList`: array of saved post IDs
- `about`: user bio
- `subscribers`: array of newsletter subscriber objects (`{ email, subscribedAt }`)
- `subscription`: object containing Polar subscription data (`{ id, status, customerId, productId, interval, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd }`; `interval` is `'month'` or `'year'`, and `null` on subscriptions older than the yearly plan)
- `hasCustomDomainAccess`: boolean flag for active custom domain subscription
- `customDomain`: object for custom domain config (`{ domain, status, verification, addedAt, verifiedAt }`)
- `customBranding`: object for custom branding (`{ footerText, updatedAt }`)

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

**Firebase**: `src/lib/firebase.js` exports `auth`, `firestore` and `firebase` from the SDK's `compat` build, so the namespaced API works everywhere, in pages and in API routes: `firestore.collection('users').doc(id).get()`, `firebase.firestore.FieldValue.arrayUnion(...)`, `auth.signOut()`. Don't mix in the modular functions (`getDoc(doc(...))`).

**Firebase Hooks**: live data comes from `src/lib/firebase-hooks.js` (the app's own small hooks, same shape as react-firebase-hooks):
- `useAuthState(auth)` for authentication state
- `useDocumentData(ref, { idField: 'id' })`, `useCollectionData(query, { idField: 'id' })` for Firestore
- The home page (`src/pages/index.js`) still imports `useAuthState` from `react-firebase-hooks/auth`; that package can go once it's switched over.

**Links**: `<Link href="…" css={…}>text</Link>`. Never put an `<a>` inside `<Link>`. A styled link needs its own `text-decoration` and `color`, or it picks up the browser's blue underline.

**Editor menus (TipTap 3)**: `BubbleMenu` and `FloatingMenu` come from `@tiptap/react/menus`. Their `options` and `shouldShow` props must be the same object on every render (module-level constants or `useCallback`). Inline ones are new each render, the menu answers with an editor update, the page re-renders, and it loops forever ("Maximum update depth exceeded"). `setContent(html, { emitUpdate: false })` when filling an editor from saved data. New StarterKit extras (`trailingNode`, `listKeymap`, bundled `link`/`underline`) are switched off so saved HTML stays the same.

**Fonts**: Inter's `@font-face` rules are written into every page by `_document.js` from `src/lib/inter-font-faces.js` (what Next 11 used to inline at build time). Don't add a `<link>` to the Inter stylesheet: it's a render-blocking request, and it changes which characters are drawn in Inter. Fonts a writer picks for their own posts are still linked from the page that needs them.

**Effects run twice in development** (React Strict Mode). Don't guard an effect with an "is this the first run?" ref; check the thing you actually care about (e.g. `clientPost.id !== post.id`).

**Search**: Client-side fuzzy search with Levenshtein distance in `src/lib/db.js`, scored over the 100 most recently edited published posts.

**API route auth**: API routes run the Firebase *client* SDK (no admin credentials), so they must verify who is calling. The browser sends the Firebase ID token with `authedFetch` (`src/lib/authed-fetch.js`), and routes check it with `requireAuth(req, res)` / `requireSelf(req, res, claimedUserId)` from `src/lib/server-auth.js`. Never trust a `userId` from the request body. Shared-secret routes use `hasSharedSecret`. The public developer API (`/api/v1/*`) authenticates with `bublr_sk_` API keys instead (`src/lib/api-auth.js`).

**Public page props**: Everything in `getServerSideProps`/`getStaticProps` props is public. Pass users through `toPublicUser` / `toPostAuthor` and posts through `toPublicPost` (`src/lib/public-user.js`); never pass a raw user document.

**Rendering post HTML**: Always use `sanitizePostHtml` (`src/lib/sanitize-post.js`). It keeps what the editor produces (callouts, task lists, highlights) and marks links `nofollow ugc`. The editor writes inline colours the way the browser serialises them (`rgb(207, 82, 242)`, not `#cf52f2`), so a style rule in the sanitizer has to accept both. Inline JSON-LD goes through `safeJsonLd` (`src/lib/escape.js`).

**Publishing**: `setPostPublished` in `src/lib/publishing.js` runs moderation and, on the first successful publish only, notifies followers and emails subscribers. Both `/api/posts/publish` (dashboard) and `/api/v1/posts` (API) call it directly.

**Draft sharing**: `POST /api/posts/share` (`{ postId, enabled }`, author only) sets or deletes `shareToken`; `getSharedDraft` in `src/lib/draft-share.js` returns only what the `/draft/[token]` page shows. `toPublicPost` strips the token.

**Custom domain plans**: $2/month or $18/year, one Polar product each. The prices shown, and the yearly saving worked out from them, live in `src/lib/plans.js`; never hard-code a price. `POST /api/subscription/create-checkout` takes `{ interval: 'month' | 'year' }` and refuses a second checkout while a subscription is live. The Polar webhook (`/api/subscription/webhook`) is the only thing that grants access. Check access with `hasActiveAccess` / `checkSubscriptionAccess` (`src/lib/subscription.js`), which keep a cancelled writer's access until the period they paid for ends; read period dates with `toMillis`, never `new Date()`. The plan UI is `PlanPicker` and `custom-domain-plans.js` in `src/components/dashboard/`.

**Account deletion**: `POST /api/account/delete` (`{ confirm: "delete my account" }`) needs a sign-in from the last 10 minutes (`auth_time`), refuses while a subscription would renew, then runs `deleteAccountData` in `src/lib/delete-account.js`. Anything new that stores a writer's data (a collection, or their uid in someone else's document) must be removed there too. The browser deletes the Firebase sign-in record afterwards.

**Timestamps**: Read `lastEdited` with `toMillis` (`src/lib/timestamps.js`). Older API-created posts stored `{ _seconds }` maps; write `firebase.firestore.Timestamp` values.

**Reserved usernames**: Any new top-level page must be added to `src/lib/reserved-usernames.js` (a test enforces this).

### Environment Variables

Required in `.env.local`:
- Firebase config (see `src/lib/firebase-config.js`)
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name for image/video uploads
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret (server-side only; used by `/api/cloudinary-sign` to sign direct uploads)
- `GROQ_API_KEY` - Groq API key for AI content moderation
- `MODERATION_SECRET_KEY` - Secret key for moderation API endpoints
- `RESEND_API_KEY` - Resend API key for newsletter email notifications
- `UNSUBSCRIBE_SECRET` - (Optional) Signs newsletter unsubscribe links (falls back to `RESEND_API_KEY`)
- `RESEND_FROM_EMAIL` - (Optional) Sender email for newsletters (default: `Bublr <notifications@bublr.life>`)
- `NEXT_PUBLIC_BASE_URL` - (Optional) Base URL for the app (default: `https://bublr.life`)

**Custom Domain Feature (Polar + Vercel):**
- `POLAR_ACCESS_TOKEN` - Polar API access token (from polar.sh dashboard)
- `POLAR_CUSTOM_DOMAIN_PRODUCT_ID` - Product ID for the $2/month custom domain subscription
- `POLAR_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID` - Product ID for the $18/year custom domain subscription (leave unset and only the monthly plan is offered)
- `POLAR_WEBHOOK_SECRET` - Secret for verifying Polar webhook signatures
- `VERCEL_TOKEN` - Vercel API token for domain management
- `VERCEL_PROJECT_ID` - Your Vercel project ID
- `VERCEL_TEAM_ID` - (Optional) Vercel team ID if using team account

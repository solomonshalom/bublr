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
- `subscribers`: array of newsletter subscriber objects (`{ email, subscribedAt }`); a paid subscriber's entry also has `paid` (a server-signed record, see Paid newsletter)
- `subscription`: object containing Creem subscription data (`{ id, status, customerId, productId, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, lastEventAt }`). Records written before the move to Creem have Polar IDs (UUIDs, not `sub_`/`cust_`)
- `hasCustomDomainAccess`: boolean flag for active custom domain subscription
- `customDomain`: object for custom domain config (`{ domain, status, verification, addedAt, verifiedAt }`)
- `customBranding`: object for custom branding (`{ footerText, updatedAt }`)
- `hasShopAccess`: boolean, set by the subscription webhook when the subscription is on the Pro + Shop plan
- `gallery`: `{ layout: 'albums'|'grid', albums: [{ id, title, cover, items: [{ id, src, alt, type, poster }] }] }` (`src/lib/gallery.js`)
- `music`: `{ mode: 'list'|'spotify', tracks: [...], showRecent }` (`src/lib/music.js`)
- `shop.products`: the writer's catalogue (`src/lib/shop.js`); saved only through `PUT /api/shop/products`
- `shopOrders`: paid shop orders, newest first (up to 200); buyer details and the checkout ID are sealed, only `checkoutHash` is in the open
- `shopGrant`: server signature over the Pro + Shop subscription (see Shop trust)
- `integrations`: `{ payments, spotify }` with the writer's own Stripe/Creem key and Spotify app secret/refresh token, sealed with `src/lib/secret-box.js`
- `gallerySectionTitle`, `musicSectionTitle`, `shopSectionTitle`: optional section titles
- `paidNewsletter`: `{ enabled, currency, monthly, yearly, description, teaseFree, updatedAt, sig }`, saved and signed only by `POST /api/newsletter/paid/settings`
- `fediverse`: `{ enabled, keySealed, keyCreatedAt, enabledAt }`; the writer's ActivityPub private key, sealed (`src/lib/activitypub/actor-keys.js`)

**posts**
- `title`, `content`, `excerpt`: post content (HTML from TipTap)
- `slug`: URL-friendly identifier
- `author`: user ID
- `published`: boolean visibility flag
- `lastEdited`: Firestore timestamp
- `searchQueries`: array of tokenized terms for fuzzy search
- `dotColor`: optional custom color for the post (hex string, e.g. `#4D96FF`)
- `shareToken`: optional 48-char hex token for a draft's private link (`/draft/<token>`); never send it to public pages
- `access`: `'paid'` for posts for paid subscribers (absent = everyone). Then `content` is only the free preview and the whole post is in `paidContentSealed` (see Paid newsletter)
- `fediverse`: `{ gen, live, hash, at }`, what was last sent to fediverse followers (`src/lib/activitypub/federation.js`)

**fediverseFollowers** (one document per writer and remote follower)
- `uid`, `actor`, `inbox`, `sharedInbox`, `followId`, `followedAt`. Written only by the inbox. Like every collection the API routes use, the Firestore rules must let the server read and write it

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
- `/[username]/shop/[productId]` - A product from a writer's shop (SSR); on a custom domain it's `/shop/[productId]`
- `/dashboard/settings/gallery`, `/music`, `/shop` - Editors for the profile blocks
- `/dashboard/settings/newsletter` - Paid newsletter (prices, payment account, paid subscribers)
- `/dashboard/settings/fediverse` - Turn ActivityPub on/off; shows the writer's `@name@bublr.life` handle

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

**Account deletion**: `POST /api/account/delete` (`{ confirm: "delete my account" }`) needs a sign-in from the last 10 minutes (`auth_time`), refuses while a subscription would renew (the writer's own plan, or any reader's paid newsletter subscription), then runs `deleteAccountData` in `src/lib/delete-account.js` (it also tells fediverse followers' servers the account is gone). The browser imports the confirmation constants from `src/lib/account-deletion-rules.js`: `delete-account.js` pulls in server-only code (`dns`, `net`) that can't be bundled for the browser. Anything new that stores a writer's data (a collection, or their uid in someone else's document) must be removed there too. The browser deletes the Firebase sign-in record afterwards.

**Creem billing**: `src/lib/creem.js` calls Creem's REST API with `fetch` (start a checkout, open the billing portal); there is no SDK. `/api/subscription/webhook` checks and reads deliveries with `validateEvent` from `src/lib/creem-webhook.js` (hex HMAC-SHA256 of the raw body in the `creem-signature` header) and answers 200 to everything it has no use for, because Creem retries anything else. Creem has no cancel-at-period-end flag: status `scheduled_cancel` or `canceled` sets `cancelAtPeriodEnd`, and access lasts until `currentPeriodEnd`. The record is written in a transaction, and an event older than `lastEventAt` is skipped (Creem retries for up to a day, so deliveries arrive out of order). In Creem, the endpoint URL must be `https://www.bublr.life/api/subscription/webhook` (the bare domain redirects). Events about products other than the custom domain plans are acknowledged and ignored, so the Creem store can be shared with other apps.

**Profile blocks (Gallery, Music, Shop)**: `src/components/blocks/` holds the profile sections ported from jeremybosma.nl (no licence on that repo; credited in each file). They share `tokens.js` (the reference's palette mapped onto Bublr's profile colours, its `cubic-bezier(0.32, 0.72, 0, 1)` easing, and the view-transition CSS in `<BlockStyles />`). Morphs use `document.startViewTransition` with `flushSync`; browsers without it just swap state. `navigateWithTransition` (`vt-navigation.js`) wraps `router.push` for the shop's grid-to-product morph and tells `PageTransition` to skip its GSAP fade for that one navigation. Section order goes through `withBlockSections` (`src/lib/profile-sections.js`), which slots the three sections into older saved orders. The profile editor (`profile-settings-modal.js`) must never write these fields; they're in `SERVER_MANAGED_USER_FIELDS` (with `shopGrant`, `paidNewsletter` and `fediverse`).

**Secrets in user documents**: user documents are readable by anyone, so writers' secrets (payment keys, Spotify client secret and refresh token, buyer details on orders, digital download links) are sealed with `seal`/`open` from `src/lib/secret-box.js` (AES-256-GCM keyed by `INTEGRATIONS_SECRET`, bound to `<uid>:<purpose>` so a copied value won't open elsewhere). `toPublicUser` strips `integrations`, `shopOrders`, `shopGrant`, the raw `shop`, `paidNewsletter` and `fediverse`; products go to pages through `shopProducts`, the paid plan through `paidPlan`, and the handle through `fediverseHandle`/`fediverseActor`. `toPublicPost` strips `paidContentSealed` and `fediverse`.

**Shop trust**: user documents can also be *written* without signing in (server routes use the unauthenticated client SDK, so the rules must allow it). So the shop never trusts plain fields: `src/lib/shop-trust.js` checks `shopGrant` (HMAC the subscription webhook writes over the Pro + Shop subscription; `hasVerifiedShopAccess`), `shop.sig` (HMAC over the catalogue written by `PUT /api/shop/products`; `trustedProducts`), and a signature on each cached Creem product ID. Use these on the server, never `hasActiveShopAccess`/`shop.products` directly. Orders store only a hash of the checkout ID (the ID works like a receipt); checkout-complete compares the amount and currency actually paid with `bublr_amount`/`bublr_currency` in the checkout metadata. Only Stripe restricted keys (`rk_`) are accepted. With a test key (`mode: 'test'`) only the signed-in writer can buy.

**Shop payments**: buyers pay the writer directly. `src/lib/shop-payments.js` talks to Stripe (Checkout Sessions with inline prices; a restricted key with "Checkout Sessions: Write" is enough) or Creem (digital only: Creem doesn't allow physical goods; one Creem product is created per item and price and cached in `integrations.payments.creemProducts`) with the writer's own key. `/api/shop/checkout` takes the price from the saved product, never the request. `/api/shop/checkout-complete` asks the provider whether the checkout was paid and records the order once (transaction), then emails the writer (`sendShopOrderEmail`). The shop needs the Pro + Shop plan (`hasActiveShopAccess`); `/api/subscription/upgrade` moves a renewing Pro subscription to it via Creem's upgrade endpoint (the Creem key needs subscriptions write).

**Spotify ("live" music)**: each writer creates their own Spotify app (development mode allows the owner, who must have Premium) and pastes its Client ID/Secret; `/api/integrations/spotify/connect` checks them with a client-credentials call, seals the secret and returns the authorize URL with a signed `state`; `/callback` stores the sealed refresh token. `/api/music/now-playing?user=` is public and returns only titles, artists, covers and links (cached 15s per writer). `invalid_grant` marks the connection `expired` so settings shows Reconnect. The redirect URI is `${NEXT_PUBLIC_BASE_URL}/api/integrations/spotify/callback` (override with `SPOTIFY_REDIRECT_BASE`).

**Paid newsletter** (Pro + Shop plan; `src/lib/paid-newsletter.js`, `paid-content.js`, `newsletter-payments.js`, `reader-session.js`, routes under `/api/newsletter/paid/`): readers subscribe monthly or yearly on the writer's own Stripe/Creem account (the one connected for the shop, `integrations.payments`); Bublr takes no cut. Rules:
- *Paid posts are sealed.* Post documents are world-readable, so for `access: 'paid'` the server keeps the whole post in `paidContentSealed` (`sealedFields`) and `content` is only what's above the paywall line (`<div data-type="paywall">`, the editor's `/paywall` block), or empty. Anything that reads `content` therefore shows the preview. Use `fullContent(post)` on the server for the whole post (it returns null if the seal won't open: refuse, never save or show the preview as if it were everything). The editor saves paid posts through `PUT /api/posts/content`, never straight to Firestore; `POST /api/posts/access` switches a post between everyone and paid.
- *Nothing unsigned is trusted.* Prices: `trustedPaidSettings`. Subscriber records: `verifiedPaid` (HMAC over the status, period and the sealed provider ids in `paid.ref`). They're written only after the provider says a checkout was paid (`/complete`, which also compares the amount paid with `bublr_amount`), and re-signed whenever the provider is asked again.
- *Access* (`paidAccess`): active/trialing until the period end + 3 days, past_due + 7 days, cancelled until the period end; a test-mode record counts only while a test key is connected. When a period has run out the server asks the provider (`refreshPaidSubscriber`) before deciding. There are no webhooks from writers' accounts: statuses are checked lazily, or on demand from the Newsletter settings page.
- *Readers* have no accounts. They sign in with a link emailed to their address (`loginUrl` -> `/api/newsletter/paid/session`), which sets an HttpOnly cookie that proves the address for every writer. Coming back from paying sets a cookie limited to that one writer (`paidSessionCookie`), only within an hour of the payment. `GET /api/newsletter/paid/content?postId=` returns the whole sanitized post to the writer (Bearer token) or a paying reader, `{ locked: true }` otherwise; it's never cached.
- *Leaving*: every paid email links to `/api/newsletter/paid/manage` (signed token; cancel, resume, change card via the provider's portal). Unsubscribing also stops the payment (and emails the writer if it couldn't). Account deletion is refused while any live paid subscription would renew (`renewingPaidSubscribers`); the writer ends them all from Settings → Newsletter.
- Stripe restricted keys need Checkout Sessions: Write and Subscriptions: Write (Customer portal: Write is optional). Stripe API versions from 2025-03-31 keep `current_period_end` on the subscription item; `normalizeStripeSubscription` reads both. Creem keys need Products, Checkouts, Subscriptions and Customers; one recurring Creem product is created per price (cached like the shop's).

**Fediverse** (`src/lib/activitypub/`, routes under `/api/activitypub/`): writers opt in (Settings → Fediverse) and are followed as `@name@bublr.life`. bublr.life redirects to www, so ActivityPub URLs live on `https://www.bublr.life/api/activitypub/...` (`apOrigin()`), keyed by uid, and WebFinger answers for both hosts (`/.well-known/webfinger`, `nodeinfo` and `host-meta` are rewrites in `next.config.js`). Rules:
- Every writer has an RSA key sealed in `fediverse.keySealed`; the public key in the actor document is derived from it, never read from the (world-writable) user document.
- The inboxes (`users/[uid]/inbox`, shared `inbox`) accept only deliveries whose HTTP signature checks out against the key the sender's server publishes, owned by the activity's actor. Only Follow, Undo Follow and Delete (actor) do anything; everything else is acknowledged and dropped.
- Every URL from another server goes through `assertPublicUrl` (https, public addresses only, after DNS) and size/time limits (`remote.js`). Tests stub DNS with `_setLookupForTesting`.
- `federatePost(postId)` brings followers up to date after any change (Create, Update only if what they see changed, Delete when unpublished; `gen` moves on after a Delete because Mastodon won't take back a deleted id). It's called by `setPostPublished`, `/api/posts/access`, `/api/posts/federate` (the editor, ~20s after the last edit), the v1 API, and `/api/posts/delete` / account deletion send Deletes. Delivery is best effort within a time budget (no queue); 410 Gone removes followers.
- Paid posts are federated as their free preview and a link (`federatedContent`).

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

**Custom Domain Feature (Creem + Vercel):**
- `CREEM_API_KEY` - Creem API key (Settings → API keys; needs Checkouts and Customers read/write). A `creem_test_` key uses the test API
- `CREEM_CUSTOM_DOMAIN_PRODUCT_ID` - Product ID for the $2/month custom domain subscription
- `CREEM_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID` - (Optional) Product ID for the yearly plan, so its webhook events are recognised
- `CREEM_WEBHOOK_SECRET` - Signing secret of the Creem webhook endpoint
- `CREEM_SHOP_PRODUCT_ID` - Product ID of the $3/month Pro + Shop plan (custom domain + shop). Moving a Pro subscriber to it (`/api/subscription/upgrade`) needs a `CREEM_API_KEY` that may write subscriptions

**Profile blocks:**
- `INTEGRATIONS_SECRET` - At least 32 random characters. Seals writers' payment keys, Spotify tokens, order buyer details, download links, **paid posts' bodies** and fediverse keys, and signs paid newsletter settings and records. Never just replace it: paid posts would become unreadable. To change it, move the old value to `INTEGRATIONS_SECRET_PREVIOUS` first
- `INTEGRATIONS_SECRET_PREVIOUS` - (Optional) The previous `INTEGRATIONS_SECRET` while rotating: values sealed or signed with it still open and verify; everything new uses the current one
- `FEDIVERSE_ORIGIN` - (Optional) Where ActivityPub is served. Default `https://www.bublr.life` (or `NEXT_PUBLIC_BASE_URL` when that isn't bublr.life)
- `FEDIVERSE_DOMAIN` - (Optional) The domain in fediverse handles. Default: `FEDIVERSE_ORIGIN`'s host without `www.`
- `SPOTIFY_REDIRECT_BASE` - (Optional) Base URL for the Spotify callback, if it must differ from `NEXT_PUBLIC_BASE_URL`
- `VERCEL_TOKEN` - Vercel API token for domain management
- `VERCEL_PROJECT_ID` - Your Vercel project ID
- `VERCEL_TEAM_ID` - (Optional) Vercel team ID if using team account

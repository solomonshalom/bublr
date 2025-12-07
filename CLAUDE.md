# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
npm install --force      # Install dependencies (--force needed due to legacy peer deps)
npm run dev              # Start development server
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint
```

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
- `subscription`: object containing Polar subscription data (`{ id, status, customerId, productId, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd }`)
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

### Page Structure (`src/pages/`)

- `/` - Landing page with Google sign-in
- `/dashboard` - User's post management (create, edit, list)
- `/dashboard/[pid]` - Post editor with TipTap
- `/dashboard/list` - Reading list
- `/explore` - Global post discovery with search
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

**Search**: Client-side fuzzy search with Levenshtein distance in `src/lib/db.js`. Posts are indexed with `searchQueries` array for partial matching.

### Environment Variables

Required in `.env.local`:
- Firebase config (see `src/lib/firebase-config.js`)
- `NEXT_PUBLIC_IMGBB_API` - ImgBB API key for image uploads in posts
- `GROQ_API_KEY` - Groq API key for AI content moderation
- `MODERATION_SECRET_KEY` - Secret key for moderation API endpoints
- `RESEND_API_KEY` - Resend API key for newsletter email notifications
- `RESEND_FROM_EMAIL` - (Optional) Sender email for newsletters (default: `Bublr <notifications@bublr.life>`)
- `NEXT_PUBLIC_BASE_URL` - (Optional) Base URL for the app (default: `https://bublr.life`)

**Custom Domain Feature (Polar + Vercel):**
- `POLAR_ACCESS_TOKEN` - Polar API access token (from polar.sh dashboard)
- `POLAR_CUSTOM_DOMAIN_PRODUCT_ID` - Product ID for the $2/month custom domain subscription
- `POLAR_WEBHOOK_SECRET` - Secret for verifying Polar webhook signatures
- `VERCEL_TOKEN` - Vercel API token for domain management
- `VERCEL_PROJECT_ID` - Your Vercel project ID
- `VERCEL_TEAM_ID` - (Optional) Vercel team ID if using team account

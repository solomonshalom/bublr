# Build - Alpha (11 Aug'23)
This is the first, optimized and production build. Although a lot has changed from last year, a key issue that was faced in the development of the website was the `ERR_OSSL_EVP_UNSUPPORTED` issue which can be fixed using NodeJS version `LTS 16.20.2`. 

*A quick but temporary fix for the NodeJS version `18.x` was to try using `NODE_OPTIONS=--openssl-legacy-provider npm run start` under the script tag in `package.json`

Later, I had to mix in Yarn and NPM in the installation and deployment of the site which might not be a good practice, but it sure did fix the issue :D

There's a lot more I need to do, especially the issue with NodeJS version `18.x`. The issues will be noted more thoroughly in the discussions tab!

# Craft - Alpha (12 Aug'23)
This is the second, optimized and production build. Although this has the same issues as the previous version, it did come w/ a lot of makeovers. One of the key points of this build is the use of color, emojis, and a newly added contact page.

OH, I now officially also include an anonymous login :D but I am still trying to figure out how to moderate these contents, as that is a major challenge. 

This is still considered beta due to the now-and-then code changes happening which could potentially break the UI, which is why I suggest using it w/ care and not playing rough, at least for now.

# Alabaster - Beta (14 Aug'23)
FINALLY, we're officially in Beta! W/ a production DB and a Guide tab added - this will be a game-changer! There are still going to be a lot of commits being pushed but nothing that will potentially break (Can't promise!). The styling has also been made better and optimized for both Mobile and Desktop. 

P.S - Every Glory and Honor is to our Lord and Saviour, Jesus Christ! Couldn't have done it w/o him, for he gave me the wisdom that I needed! :D

# Brown - Production (17th Aug'23)
WOHOO! We did it, the production version of Bublr is up and ready to be used! W/ everything set-up and after initial tests, it's ready to run and explore the beautiful world of the Internet.

A major bug that does still exists, is the NodeJS version error (As documented in the first version [Build]). Though, we're launching the production version of Bublr due to the fact that the error not really affecting any users and that we have tons of time to find the ultimate fix. 

P.S - God Is Good, All The Time!

# kimono - Production (28th September'23)
It's been pretty long since the first production launch but ever since then there hasn't exactly been a notable version that could be shown but that has changed, officially and for good. Kimono or v5 fixes a lot of bugs and has a local // global (in-progress) search w/ a unique PFP for every anonymous user :D

We would also love to thank @jennifershinshin who actively worked on the search implementation and bug-fixes, we know that this wouldn't have been possible without her contributions =D

More than everyone, every Glory & Honor's to our Lord & Saviour, Jesus Christ! couldn't have done it w/o God and I and my team are pretty confident about it <3

# Comeback - Pre-release (2nd November'26)
Getting Bublr ready for the December 10th relaunch. Before changing anything we went back to what Bublr is for: *an open-source, distraction-free spot for anyone to write anything, with no ads and no paywalls.* We also looked at what people actually told us. Product Hunt reviewers loved "no ads, no feeds, just pure writing" and "a private space to write without feeling tracked". They struggled to find how to start a post. A paying writer couldn't connect their domain (GitHub issue #7). Across the wider writing world, people ask for the same things: own your words (export), RSS, a calm editor that never loses work, and no spam.

So this release keeps almost every feature, fixes the ones that were quietly broken, removes what nobody used, and closes some serious privacy and security holes. The look and feel stays the same. Anything new reuses the components and colours already in the app.

## Kept
Editor, publishing, profiles and their customisation, Explore, reading list, newsletters, follows, likes and views, guest book, translation, voice input, import, RSS/Atom/JSON feeds, the developer API (and the Freewrite integration), custom domains, dark mode and AI moderation. These are what Bublr is, so they stay. Some of them work properly for the first time now (see Fixed).

## Added
- **Export your writing.** *Settings → Advanced → Your writing → Download export* gives you a .zip with every post and draft as Markdown (with front matter for Hugo, Jekyll, Astro, Obsidian and friends), a README, and a JSON copy that keeps the original HTML. Your words are yours. Take them anywhere.
- **A "Write your first post" button** on the empty dashboard. "Press C" doesn't help on a phone, and people told us they couldn't find how to start.
- **RSS discovery on every post.** Feed readers now find the writer's feed from any of their posts, not just their profile.
- **Tests.** `npm test` runs 64 tests on Node's built-in runner, with no new dependencies. They cover the sign-in checks on every protected API route, the post sanitizer, the export, publishing through the dashboard and the API, and the privacy filter for public pages.

## Changed
- **Explore is open to readers.** You no longer need an account to discover writing. Signed-out visitors used to be bounced to the homepage, even though every footer links to Explore and it's in the sitemap. Posts are now real links, so readers, search engines and screen readers can follow them.
- **Subscribers get one email per post.** Unpublishing to fix a typo and publishing again used to email everyone (and notify every follower) a second time.
- **Links in posts are marked `nofollow ugc`,** and so is the profile website link. This is the standard signal for user-written content. It takes away the backlink payoff that draws SEO spam, and readers won't notice a thing.
- **⌘/Ctrl+B in the editor means Bold while you're typing.** It used to also slide the settings panel open every time you bolded a word.
- **Search covers the 100 most recent posts** instead of an arbitrary 40.
- **One footer for About, Terms, Privacy, Docs and Comeback**, with the same style and the same links everywhere (Terms and Privacy had no About link, Docs had no Explore link…).
- **Your profile footer credits you.** It said "Copyright © Bublr" on your own writing.
- **The About page describes Bublr as it is today**: email sign-up, Explore, newsletters and RSS, import from seven platforms, and export.
- **Translations use the same font as posts** (Inter) instead of the old Newsreader.
- **Reserved usernames.** Names like `explore`, `about` or `docs` can't be taken any more; a profile with one of those names could never be reached.

## Fixed
- **Pop-up callouts, task lists and highlight colours now show on published posts.** The post sanitizer stripped the classes and attributes they need, so callouts showed up as empty boxes, checklists lost their checkboxes and highlights lost their colour. Callouts also never opened on post pages, and their pop-up had no styling.
- **Autosave no longer drops what you just typed.** When a save came back from the server, the editor reset itself and cancelled the next save, so the last words you typed could stay unsaved. It also rewrote the whole post on every save, which could wipe likes or views that arrived at the same moment, and could save a slug that hadn't been validated. It now only writes what changed.
- **Saving settings can't wipe subscribers or followers.** The profile editor rewrote your whole account record on every change. It now only writes the profile fields it owns.
- **Image uploads from the "/" menu and the "+" menu work.** They asked for an upload that nothing was listening for.
- **Image uploads work at all.** The site's Content-Security-Policy blocked uploads to Cloudinary. It also blocked our privacy-friendly analytics, which is why every page logged an error.
- **Posts made through the API (e.g. from Freewrite) no longer 404.** The API saved their date in a format the post page couldn't read. Existing posts with the old format now display too.
- **API-published posts are moderated on the content you actually sent**, and publishing an existing draft via the API works again.
- **The reading list doesn't go blank** when one saved post has been deleted.
- **A profile doesn't 404** when one of its posts was deleted but still referenced.
- **The "Upgrade" card takes you to the custom-domain settings** (it landed on the wrong page), and no longer promises "Priority Support" we don't offer.
- **Publishing never skips moderation.** If the network failed, the editor used to flip the post to published by itself.
- **A missing email or AI key no longer crashes unrelated pages** (publishing, subscription status). Those features just switch off.

## Security & privacy
- **Public pages no longer leak private data.** Profile and post pages shipped the writer's full account record to every visitor: their email address, every newsletter subscriber's email, API-key records and billing details. They now carry only what the page shows (names, bio, counts).
- **Every API route that acts for a writer checks who they are.** Routes trusted whatever user ID the browser sent, so anyone could create API keys for any account (and then edit or delete their posts), publish or unpublish anyone's posts, rewrite a paid writer's newsletter template and email their subscribers, open their billing portal, change their custom domain, forge likes, follows and notifications, or use our paid transcription, translation and upload quotas. The browser now sends the Firebase sign-in token and the server verifies it (`src/lib/server-auth.js`, no service account needed).
- **Notifications are created by the server only**, from the real user's profile, so they can't be forged.
- **Translation works on published posts by id.** It can no longer be used as a free general-purpose translator on our key.
- **Scripts can't sneak into pages** through a post's text in search-engine data, a writer's display name on the unsubscribe page, or a callout's title.
- **The moderation endpoints fail closed.** If their secret wasn't set, sending `Bearer undefined` got in.

## Removed
- A debug endpoint that listed every guest-book entry for any user, including rejected ones (`/api/guestbook/debug`).
- A one-off font migration endpoint (`/api/migrate/fonts`).
- `/api/user/[username]`, which nothing used and which returned a user's drafts.
- Dead code: the old Medium import routes (replaced by the 7-platform importer), an unused link-suggestion route, an unused OG-image route, an old copy of the API-key screen, an unused filter modal, an unused anonymous-login button, an unused newsletter widget and a duplicate sitemap.
- Repo clutter: a committed `dev.log` (with a local machine path in it) and a broken submodule entry.

## For whoever deploys this
- Writers with a tab open from before the deploy need to refresh once. Old pages don't send the sign-in token, so their requests get a "please sign in again" answer.
- `.env.sample` now lists every variable the app reads (the old one still mentioned Dodo Payments; we use Polar).

## Known issues (need a decision or access we don't have here)
- **Firestore rules.** API routes use the browser Firebase SDK with no admin credentials, so the database rules must allow writes without sign-in for them to work. That means someone could still write to the database directly. The real fix is moving server routes to `firebase-admin` with a service account and locking the rules down. The rules aren't in this repo, so this needs the Firebase console.
- **Explore needs a spam clean-up.** Many existing published posts are SEO spam (gambling, "Top 10" listicles, tour packages). New links can't pass search ranking any more, but the existing posts need a moderation pass.
- **Custom domain verification (#7).** We couldn't reproduce it without Vercel access. One thing to check: two-part domain endings like `example.co.uk` are treated as subdomains by `api/domain/verify`, so they're asked for a CNAME instead of an A record.
- **Unsubscribe links carry no token** (anyone who knows an address can unsubscribe it), and email link scanners can trigger them. There's no rate limiting on public endpoints (newsletter sign-up, guest book, views) beyond the guest book's in-memory limit.

# Changelog - Weekly check-in (4th November'26)
Every release note now lives in one place inside Bublr: the new [Changelog](/changelog) page. It reads `changelog.md` directly, so anything added there shows up on the site, newest first, with no copy-pasting. It's linked from every footer.

## Added
- **A Changelog page** at `/changelog`, linked from the footer of About, Terms, Privacy, Docs and the Comeback page, and listed in the sitemap.

## Changed
- `changelog` is now a reserved username, since it's a page.

# Domains - Pre-release (5th November'26)
A short follow-up to the comeback release, aimed at the custom-domain problem reported in GitHub issue #7.

## Fixed
- **Root domains with two-part endings get the right DNS record.** `example.co.uk`, `example.com.au` and similar were treated as subdomains, so Bublr asked for a CNAME when it should have asked for an A record. They now get the A record, and real subdomains like `blog.example.co.uk` still get a CNAME.
- **Deeper subdomains keep their full name.** For `a.b.example.com` the CNAME instructions showed only `a`. They now show `a.b`.
- **Tests.** `npm test` now runs 69 tests, including the domain rules above.

# Anchors - Update (6th November'26)
A weekly check on what writers ask for and what other writing tools offer. Long essays were the gap: you couldn't send someone to one section of a post. Platforms like Ghost, Bear Blog and Write.as all let you link to a heading. A table of contents, scheduling and comments are on other platforms too, but they pull away from a quiet, single-purpose writing space, so we're leaving them out for now.

## Added
- **Link to any section.** Every heading (H1 to H3) in a published post now has its own link. Hover a heading and click the `#` to copy a link that opens the post scrolled right to that section. It's there in the preview too.

## Fixed
- **`npm test` documentation.** Tests need `npm install --force` first; the CLAUDE.md note now matches reality (70 tests).

# Unsubscribe - Update (7th November'26)
Newsletter unsubscribe links were one of the open items in the comeback release's known issues. This week's check closes it. Readers should be able to leave a newsletter in one click, and nobody else should be able to do it for them.

## Fixed
- **Only the owner of an email address can unsubscribe it.** Unsubscribe links used to be just an address and a writer's name, so anyone who knew an address could remove it from a list. Links in newsletter emails are now signed by the server, and links without a valid signature do nothing.
- **Mail scanners can't unsubscribe people by accident.** Opening the link now shows an "Unsubscribe" button, and only pressing it removes the address. Security scanners that pre-open every link in an email used to do it for the reader.
- **Unsubscribing also works for addresses typed with capital letters** (`Reader@Example.com`).

## Added
- **A `List-Unsubscribe` header on every newsletter.** Gmail, Apple Mail and others now show their own "Unsubscribe" button next to the sender, which keeps your emails out of the spam folder.
- **Tests.** `npm test` now runs 72 tests, including the signed-link checks above.

## For whoever deploys this
- Links in emails sent before this release have no signature, so they show "Invalid Unsubscribe Link". Newsletter emails sent from now on work normally. The signing key is `UNSUBSCRIBE_SECRET`, falling back to `RESEND_API_KEY`, so no setup is needed. If you rotate that key, older emails' links stop working.

## Known issues
- Spam clean-up of Explore, the Firestore rules and rate limiting on public endpoints are still open (see the comeback release).
- We looked at comments, scheduling, a table of contents, paid subscriptions and analytics dashboards on other platforms again. They don't fit a quiet, ad-free writing space, so we're leaving them out.

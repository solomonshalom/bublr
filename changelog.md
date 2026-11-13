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

# Guardrails - Update (8th November'26)
Rate limiting on public endpoints was the last open item from the comeback release that we could close without database access. Writers' lists and view counts shouldn't be easy to flood.

## Fixed
- **Newsletter sign-up can't be spammed.** One visitor can make 10 sign-up attempts per 10 minutes. After that they get a "try again in a few minutes" message. This stops scripts from filling a writer's list with made-up addresses.
- **View counts can't be inflated by refreshing.** A visitor counts as one view per post every 30 minutes.

## Added
- **Tests.** `npm test` now runs 73 tests, including the rate limits above.

## Known issues
- Limits are kept in each server's memory, so they slow down casual abuse rather than stop a determined attacker. Sign-ups also still have no email confirmation step. The Firestore rules and the Explore spam clean-up are still open.
- We looked at comments, scheduling and analytics dashboards again. They still don't fit a quiet writing space.

# Confirmed - Update (9th November'26)
Newsletter sign-up had no email confirmation, which was an open item in the last three notes. Anyone could type someone else's address into a writer's form, and that address then got the writer's emails. Substack, Ghost and Buttondown all ask readers to confirm first. We now do too.

## Added
- **Readers confirm their subscription by email.** After signing up they get one email with a "Confirm subscription" button. Only after pressing it do they join the list. Nobody can be subscribed by a stranger, and fake addresses no longer fill up a writer's list.
- **Pending sign-ups show in Subscribers.** The count only includes confirmed readers. People still waiting are marked "(unconfirmed)" and show up as a note under the count. The CSV export has a new `status` column.
- **Tests.** `npm test` now runs 78 tests, including the confirmation flow.

## Changed
- **Writers are notified when a reader confirms,** not when they type their address.
- **Only confirmed subscribers get your posts,** and only confirmed readers count in subscriber numbers on your profile and in the API.
- **Asking again is safe.** Signing up twice before confirming sends the email again (at most once a minute) and never creates a duplicate. As with unsubscribing, opening the link only shows a button, so mail scanners can't confirm anyone.

## For whoever deploys this
- Everyone already on a list stays subscribed, with no action needed. Only new sign-ups need to confirm.
- If `RESEND_API_KEY` isn't set there is no way to send the email, so sign-ups join the list straight away, as before.

## Known issues
- The Firestore rules and the Explore spam clean-up are still open (see the comeback release).
- We looked at comments, scheduling and analytics dashboards again. They still don't fit a quiet writing space.

# Inbox - Update (10th November'26)
Most readers find a writer through one post: a shared link, a search result, a feed. But the only place to subscribe to a writer's newsletter was their profile page, and nothing on a post pointed there. Substack, Ghost, Buttondown and Bear Blog all put the sign-up at the end of every post. Now Bublr does too.

## Added
- **Subscribe from any post.** Every published post now ends with the same "Subscribe to …'s newsletter" button that's on the writer's profile. Readers confirm by email, just like on the profile.
- **It follows your settings.** If you hid the newsletter button on your profile, it's hidden on your posts too. Your custom button text shows here as well. You won't see it on your own posts.
- **Tests.** `npm test` now runs 79 tests, including the setting check above.

## Known issues
- The Firestore rules and the Explore spam clean-up are still open (see the comeback release).
- We looked at comments, scheduling and analytics dashboards again. They still don't fit a quiet writing space.

# Second Reader - Update (11th November'26)
This week's check went back to what people said about Bublr on Product Hunt. Two things stood out. One reader couldn't tell whether Bublr was for private notes or for publishing. Another asked for a way to share a draft and get feedback before it goes live, and we said we'd build it. Medium, Ghost and Write.as all have a private link for drafts. Now Bublr does too, without adding comments or accounts for readers.

## Added
- **Share a draft with a private link.** Open post settings (the ⋮ button) on any draft and press *Create link* under Visibility. Send the link to a friend or an editor and they can read the draft exactly as it will look when published. They don't need an account.
- **You stay in control.** *Turn off* stops the link working straight away. If you create a link again later it's a brand new one, so an old link never comes back to life.
- **Private means private.** The link is a long random address nobody can guess. Search engines are told not to index it, the page isn't cached, and sites you link to from the draft can't see the address. Views, likes and the newsletter button stay off until you publish.
- **After you publish, the same link opens the live post,** so nobody you sent it to ends up on a dead page.
- **Tests.** `npm test` now runs 90 tests, including who can create a link and what a link shows.

## Changed
- **The About page says how drafts work:** nothing is public until you publish, and you can share a draft privately first.
- `draft` is now a reserved username, since it's a page.

## Fixed
- **Voice input can use the microphone again.** A security setting on the site told browsers to block the microphone on every page, including the editor, so voice input could never start recording. The microphone is now allowed on Bublr's own pages only. The camera and location stay blocked.

## Known issues
- A draft link is only as private as the people you send it to. Anyone who has the link can read the draft until you turn it off.
- The Firestore rules and the Explore spam clean-up are still open (see the comeback release).
- We looked at comments, scheduling and analytics dashboards again. They still don't fit a quiet writing space. Feedback on a shared draft happens wherever you already talk to your reader.

# Clean Exit - Update (12th November'26)
This week's check started from Bublr's own privacy page. It says you can "request account deletion", but there was nowhere to do that, and no reply address on the page either. Bear Blog, Write.as, Mataroa, Ghost, Medium and Substack all let a writer delete their account from settings. People told us they like Bublr as "a private space to write without feeling tracked". A place like that should let you leave without asking anyone. The comeback release made it easy to take your words with you. Now you can also take them down.

## Added
- **Delete your account yourself.** *Settings → Advanced → Account → Delete account* removes your profile, every post and draft, your subscriber list, API keys, guest book, notifications, follows and likes. Your sign-in is removed too. There's no waiting period and nobody to email.
- **Hard to do by accident.** You type *delete my account* and confirm it's you (your password, or signing in with Google once more). A tab left open on a shared computer can't delete anything, because the server only accepts a sign-in from the last 10 minutes.
- **No surprise charges.** If your custom domain subscription would renew, Bublr asks you to cancel it first, so you're never billed for an account that no longer exists. Your domain is released when the account goes.
- **Tests.** `npm test` now runs 103 tests, including who can delete an account and that nothing of the writer is left while everyone else's data stays untouched.

## Changed
- **The privacy page says what's true:** you can export everything and delete your account yourself, at any time.
- **The About page lists it** next to Export.

## Known issues
- Published posts can stay visible for up to a minute after deletion, and feeds and the sitemap for up to an hour, until their saved copies refresh. Search engines take longer to forget a page.
- Images you uploaded stay on our image host for now. Bublr doesn't keep a list of which images belong to which writer, so it can't remove them automatically yet.
- Emails already sent to your subscribers can't be recalled.
- If the last step (removing the sign-in) fails, you're signed out and your data is still gone. Signing in again with the same address starts an empty account.
- The Firestore rules and the Explore spam clean-up are still open (see the comeback release).
- We looked at comments, scheduling and analytics dashboards again. They still don't fit a quiet writing space.

# Pay Yearly - Update (13th November'26)
A custom domain has always been $2 a month. Some writers would rather pay once and not think about it again, so there's now a yearly plan as well: $18 a year, which is $6 less than twelve monthly payments.

## Added
- **A yearly plan for custom domains.** $18 a year instead of $24, a saving of 25%. Monthly stays at $2. Choose either in *Settings → Advanced → Custom domain*.
- **Your plan at a glance.** Once you subscribe, the same place shows which plan you're on and the date it renews, or the date it ends if you've cancelled. *Manage Billing* is where you change or cancel it.
- **Tests.** `npm test` now runs 129 tests, including which plan a checkout starts, what a billing webhook is allowed to change, and how long access lasts after cancelling.

## Changed
- **The upgrade box looks like the rest of the dashboard.** The orange card is gone. The plans use the same tiles and buttons as everything else, in light and dark mode.
- **One subscription at a time.** If you already have an active subscription, Bublr won't open a second checkout, so you can't be charged twice by accident.

## Fixed
- **Cancelling no longer cuts you off early.** After you cancel, your domain is meant to keep working until the end of the time you've paid for. A date bug ended it the next time you opened your settings instead. You now keep what you paid for, which matters even more on a yearly plan.
- **Access starts when the payment goes through,** not a moment before.

## Known issues
- Changing between monthly and yearly happens on the billing page run by Polar, our payment provider, not inside Bublr.
- The Firestore rules and the Explore spam clean-up are still open (see the comeback release).

# New Foundations - Update (13th November'26)
Bublr was built on tools from 2021. They still worked, but they had stopped getting fixes, and the very first entry in this changelog is about the workaround it took to build the site at all. This release moves everything underneath to current versions. If it went right, you won't notice: every page was put next to the old one, in light and dark mode and at phone size, and the editor was checked keystroke by keystroke to make sure it saves exactly what it saved before.

## Changed
- **Everything underneath is current.** Next.js 11 → 16, React 17 → 19, Firebase 8 → 13, the editor's engine (Tiptap 2 → 3), dialogs, animations and the rest.
- **The oldest known issue here is closed.** Bublr installs with a plain `npm install` and builds without special flags, on a current version of Node.js. The Node error from the 2023 entries is gone.
- **Links are real links.** Several of them (the dashboard sidebar, your post list, the docs) worked when clicked but weren't proper links underneath, so you couldn't open one in a new tab or copy its address. Now you can.
- **Tests.** `npm test` now runs 132 tests.

## Fixed
- **"Reduce motion" no longer hides the home page.** With that setting switched on in your device, the headline and the Get Started button never appeared.
- **Enter works after you close the "/" menu with Escape.** It used to do nothing until you typed something else.
- **The translate window lost a stray grey strip** along its bottom edge.

## Known issues
- Billing still uses the previous generation of Polar's toolkit. The new one is a rewrite, and it needs testing against Polar's sandbox before we move.
- The code checker lists 39 warnings, most of them from React's newer rules. None of them is an error; they'll be worked through as those files are touched.
- The Firestore rules and the Explore spam clean-up are still open (see the comeback release).

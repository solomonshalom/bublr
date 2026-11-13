# Product notes

Memory for the nightly product run. Read this first, then `CLAUDE.md` and the newest entries in `changelog.md`. Keep it short and current.

## From the owner

*(The owner writes here: priorities, freezes, answers. The nightly run follows it and never edits it.)*

## Research

**Last full round: 13th November 2026.** Next one is due on or after the 20th. On other nights, check only issues and whether main is healthy.

What users said:

- **GitHub issues.** One open issue, [#7](https://github.com/solomonshalom/bublr/issues/7) (Feb 2026): a paying writer set the A record, pressed verify and got an error. The owner replied in May asking them to email. No reply since. The two-part-ending bug (`example.co.uk`) was fixed on 5th November, but nobody has confirmed that it was this writer's problem.
- **Product Hunt reviews** ([2 reviews, both 5.0](https://www.producthunt.com/products/bublr/reviews)). One reviewer couldn't tell how to save after changing a slug, and asked for the save tick to be a word instead. Already answered: the editor shows "Saved" / "Unsaved" in words and the slug saves by itself.
- **Product Hunt launch comments** ([highlights of the August 2025 launch](https://hunted.space/product/bublr/launches/bublr-2)). People liked "no ads, no pressure" and "a private space to write without feeling tracked". Requests and complaints:
  - Share a draft for feedback. Shipped 11th November.
  - Is what I type public or private? About page answered it on 11th November. The landing page still doesn't say.
  - "The navigation buttons at the top are very difficult to spot." Open.
  - After signing in, the home page shows "Dashboard" and "Log out" buttons. One person suggested going straight to the dashboard. Open.
- **Elsewhere.** No independent reviews found. Listings ([Feedbagel](https://feedbagel.com/post/bublr-a-minimalist-open-source-writing-community), SaaSHub, Peerlist) only repeat the launch text.

Peers (Bear Blog, Write.as, Mataroa, Pika, Ghost, Medium, Substack):

- Earlier runs compared features one by one. The gaps that mattered are closed: export, heading links, signed unsubscribe, double opt-in, subscribe at the end of a post, private draft links, account deletion.
- [Bear Blog's docs](https://docs.bearblog.dev/) list a "migration without losing traffic" guide, and Mataroa advertises a redirect to your new address when you leave. Bublr has no equivalent. See Backlog.
- What writers leaving Substack and Medium ask for, according to this year's round-ups, is less interface, privacy, and owning their domain. Bublr already aims at all three. Nothing new to build from this.

## Decisions

Not building. Reopen only with new evidence.

- **Comments.** Bublr has a guest book. Comment threads bring moderation and noise to every post.
- **Scheduled publishing.** Checked on five separate nights. Nobody has asked.
- **Table of contents.** Heading links cover the need without adding anything to the page.
- **Analytics dashboards.** Writers praised not feeling tracked.
- **Paid subscriptions / paywalls.** Against the mission.
- **Upvoting (PR #2).** Stale since May, built on old code. Likes already exist.
- **PR #1 (ImgBot) and PR #3 (Dodo Payments domains).** Stale. Billing moved to Polar. The owner may want to close them.

## Backlog

Nothing may be built on main while the relaunch branch is open (see Waiting on the owner). In order:

1. **"I've moved" redirect for writers who leave.** A writer could set a new address so their Bublr profile and posts point readers there. Evidence: Mataroa and Bear Blog offer it. No Bublr writer has asked, so this is a guess. Fits "your words are yours".
2. **Remove a writer's uploaded images when they delete their account.** The changelog lists it as a known issue. Needs a record of who uploaded what, and real Cloudinary to test. Partly outside setup.
3. **Proposal, the look: skip the "Dashboard / Log out" choice** on the home page for signed-in writers and go to the dashboard. Evidence: one Product Hunt comment.
4. **Proposal, the look: make the top navigation buttons easier to see.** Evidence: one Product Hunt comment.
5. **Proposal, the look: one line on the landing page** saying nothing is public until you publish. Evidence: one Product Hunt comment.

## Waiting on the owner

- **The relaunch branch.** `relaunch/next-16-yearly-plan-launch-assets` was pushed on 13th November. It moves the app to Next 16, React 19, Firebase 13 and Tiptap 3, adds the yearly plan, and changes 139 files, including two new entries at the bottom of `changelog.md`. Anything built on main now would be built underneath it, so the nightly run ships no code and doesn't touch the changelog until it is merged, or until you say otherwise in "From the owner". The owner was notified once, on 13th November. Don't notify again for this.
  - Before merging: it needs Node 24.12 or newer, so check the Node version in the Vercel project settings. The yearly plan stays hidden until `POLAR_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID` is set.
- **Issue #7.** Needs Vercel access, or the writer's domain, to find out what the verify step actually returned.
- **Firestore rules.** Not in this repo. Needs the Firebase console.
- **Explore spam clean-up.** Deletes existing posts, so it's the owner's call. Needs database access.
- **Items 3 to 5 in the backlog.** They change existing pages, so each needs a yes.

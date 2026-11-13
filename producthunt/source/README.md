# Product Hunt gallery

`build.mjs` makes every image in `../`: ten 1242x2688 portraits, the 1270x760 landscape, the 240 thumbnail and a preview strip. The previous set is kept in `../original/`.

```bash
cd producthunt/source
npm i                 # playwright-core, into this folder only (it drives your installed Google Chrome)
node build.mjs ..     # all images
node build.mjs .. 05  # just the ones whose name contains "05"
```

## Where the screens come from

Every app screen is a **real capture of the running app**, saved in `shots/` (390 px wide, 4x). `build.mjs` only frames them: the phone, the headline, and pieces of the same captures shown larger beside the phone. The one drawn piece is the file list on slide 10, because the app has no screen for what is inside an export; its file names are read from a real export (`shots/meta.json`).

`capture/` is how the captures were made, without touching production:

1. A private copy of the repo with `src/lib/firebase.js` replaced by `capture/firebase.emulator.js` (same module, pointed at the local Firebase emulators). Run it with `next dev -p 3107`.
2. `npx firebase-tools emulators:start --only auth,firestore --project demo-bublr` next to `capture/firebase.json`.
3. `node capture/proxy.mjs` (needs a throwaway certificate, `key.pem` and `cert.pem`, beside it). The test browser is started with `--host-resolver-rules="MAP bublr.life 127.0.0.1:3443"`, so the app sees itself at `https://bublr.life` and prints real links. `assertLocal()` in `capture/lib.mjs` stops the run if that mapping is not in place.
4. `node seed.mjs`, then `seed2.mjs`, `seed3.mjs`, `seed4.mjs`: the demo writer signs up through the real sign-up page and writes four posts in the real editor; the rest (publishing, dot colours, the sticker, three other writers) is written straight into the emulator, because publishing needs a Google-signed token an emulator cannot mint.
5. `node capture.mjs` and `node email.mjs` write `shots/`. The email is the app's own template (`generateNewPostEmailHTML`) rendered and photographed.

Two things are left out of the captures on purpose: the pre-launch "Back by Dec 10th" banner, and the demo post is one paragraph long (see the note about the email below).

## Look

Bublr's own greys: paper (`#fcfcfc`) and ink (`#171717`) canvases that alternate, each phone showing the opposite theme. Manrope for the headlines, with the closing comma or full stop in one of the six dot colours. The 🍱 and the peeps crowd come from the home page. A "New" tag marks what was added since the December 2025 launch.

## Found while capturing (not fixed here, these are in `src/`)

- **Newsletter email runs paragraphs together.** `generateNewPostEmailHTML` strips tags from the post without leaving a space, so two paragraphs read "…just words.Most of them…".
- **On a phone, the sticker toolbar covers the blue Done button** in profile edit mode (the toolbar wraps to two rows and sits on top of it).

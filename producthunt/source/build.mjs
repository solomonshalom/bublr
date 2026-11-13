// Renders the Bublr Product Hunt gallery: ten 1242x2688 portraits, a
// 1270x760 landscape, the 240 thumbnail and a preview strip.
//   node build.mjs [outDir] [only-name-substring]
//
// Every app screen in these images is a real capture of the running app
// (./shots, made by ./capture). This file only frames them: the phone, the
// headline, and pieces of the same captures shown larger beside the phone.
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { DOTS, dot, ZIP_CSS, zipCard } from './ui.mjs'

// playwright-core from ./node_modules (npm i), or from wherever
// PLAYWRIGHT_CORE points (e.g. a global install).
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')

const ROOT = path.dirname(new URL(import.meta.url).pathname)
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'out'))
const ONLY = process.argv[3] || ''
const HTML = path.join(ROOT, 'html')
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(HTML, { recursive: true })

const W = 1242, H = 2688
const META = JSON.parse(fs.readFileSync(path.join(ROOT, 'shots/meta.json'), 'utf8'))
const SHOT = n => `../shots/${n}.png`

// ---------- slide chrome ----------
// Two canvases, both from the app's own greys: paper (#fcfcfc, the light
// theme) and ink (#171717, the dark theme). Slides alternate between them and
// each phone shows the opposite theme, so every screen stands off its canvas.
const SLIDE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{overflow:hidden}
body{position:relative;font-family:'Manrope',sans-serif;-webkit-font-smoothing:antialiased;background:var(--bg);color:var(--fg)}
body.paper{--bg:#fcfcfc;--fg:#171717;--sub:#6f6f6f;--line:rgb(222,223,223);--chip:#fff;--bezel:#2e2e2e;--notch-dot:rgba(252,252,252,.16);--phone-shadow:0 44px 96px rgba(0,0,0,.14),0 10px 28px rgba(0,0,0,.08);--float-shadow:0 30px 70px rgba(0,0,0,.22),0 8px 20px rgba(0,0,0,.1);--new-fg:#5b5bd6;--new-bg:rgba(91,91,214,.09);--new-bd:rgba(91,91,214,.3)}
body.ink{--bg:#171717;--fg:#fcfcfc;--sub:#9a9a9a;--line:rgba(255,255,255,.16);--chip:rgba(255,255,255,.04);--bezel:#2e2e2e;--notch-dot:rgba(252,252,252,.16);--phone-shadow:0 0 0 2px rgba(255,255,255,.05),0 50px 120px rgba(0,0,0,.6);--float-shadow:0 34px 90px rgba(0,0,0,.6),0 10px 24px rgba(0,0,0,.35);--new-fg:#b1b4f5;--new-bg:rgba(155,158,240,.14);--new-bd:rgba(155,158,240,.38)}
.copy{position:absolute;left:86px;width:1080px;color:var(--fg)}
.h{font-size:139px;line-height:1.11;letter-spacing:-0.04em;font-weight:400;white-space:nowrap}
.h b,.h span{display:block}
.h b{font-weight:600}
.h i{font-style:normal}
.sub{margin-top:42px;font-size:56px;line-height:1.45;font-weight:500;color:var(--sub);max-width:1040px;text-wrap:pretty}
.cover .h{font-size:150px;line-height:1.3;letter-spacing:-0.042em}
.cover .sub{font-size:61px;line-height:1.47;margin-top:64px;max-width:1060px}
.new{position:absolute;left:4px;top:-92px;display:inline-flex;align-items:center;gap:14px;height:64px;padding:0 28px 0 24px;border-radius:999px;border:2.5px solid var(--new-bd);background:var(--new-bg);color:var(--new-fg);font-size:33px;font-weight:700;letter-spacing:.01em;line-height:1}
.new::before{content:'';width:13px;height:13px;border-radius:50%;background:currentColor}
.phone{position:absolute;background:var(--bezel);box-shadow:var(--phone-shadow)}
.phone .screen{position:absolute;overflow:hidden}
.phone .screen img{display:block}
.phone .notch{position:absolute;background:var(--bezel);z-index:3}
.phone .spk,.phone .cam{position:absolute;background:var(--notch-dot)}
.phone .spk{border-radius:99px}.phone .cam{border-radius:50%}
.float{position:absolute;z-index:6;overflow:hidden;box-shadow:var(--float-shadow)}
.float img{display:block;position:absolute;max-width:none}
.emoji{position:absolute;display:flex;align-items:center;justify-content:flex-start;font-family:"Apple Color Emoji","Segoe UI Emoji",sans-serif;line-height:1}
.peep{position:absolute;width:240px;height:324px;background:url(../assets/characters.png) no-repeat;transform-origin:0 100%}
.kicker{font-size:30px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--sub)}
.chips{display:flex;flex-wrap:wrap;gap:20px 20px}
.chip{display:inline-flex;align-items:center;gap:18px;height:92px;padding:0 34px 0 28px;border-radius:20px;border:2.5px solid var(--line);background:var(--chip);font-size:41px;font-weight:600;letter-spacing:-.01em;color:var(--fg);white-space:nowrap}
.chip svg{flex-shrink:0}
${ZIP_CSS}`

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">`

const doc = (w, h, canvas, body, extraCss = '') => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${SLIDE_CSS}html,body{width:${w}px;height:${h}px}${extraCss}</style></head><body class="${canvas}">${body}</body></html>`

// Phone frame around a real capture (390 CSS px wide). Geometry is taken from
// the reference set: 1086px wide with a 42px bezel shows the page at ~2.57x.
// `inset` is what the phone keeps for itself above the page: the status bar,
// and where the top of the phone is off the slide, the browser's bar too.
function phone({ x, y, w, bezel, shot, inset = 32, insetBg = '#fcfcfc' }) {
  const inner = w - 2 * bezel, z = inner / 390, sh = 844 * z, h = sh + 2 * bezel
  const R = w * 0.148, r = R - bezel
  const nw = w * 0.42, nh = w * 0.104, nr = w * 0.045
  const pw = w * 0.1087, ph = w * 0.011, cy = w * 0.0709, cr = w * 0.012
  return `<div class="phone" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${R}px">
  <div class="screen" style="left:${bezel}px;top:${bezel}px;width:${inner}px;height:${sh}px;border-radius:${r}px;background:${insetBg}">
    <img src="${SHOT(shot)}" style="width:${inner}px;margin-top:${inset * z}px"></div>
  <div class="notch" style="left:${(w - nw) / 2}px;top:0;width:${nw}px;height:${nh}px;border-radius:0 0 ${nr}px ${nr}px">
    <span class="spk" style="left:${nw / 2 - w * 0.022 - pw / 2}px;top:${cy - ph / 2}px;width:${pw}px;height:${ph}px"></span>
    <span class="cam" style="left:${nw / 2 + w * 0.0645 - cr}px;top:${cy - cr}px;width:${cr * 2}px;height:${cr * 2}px"></span>
  </div></div>`
}
const phoneH = (w, bezel) => 844 * ((w - 2 * bezel) / 390) + 2 * bezel

// A piece of a real capture, lifted out of the phone and shown at `z` times
// its real size. `box` is the piece in the capture's own CSS pixels, `srcW`
// the capture's full width in the same units.
const float = ({ x, y, shot, box, srcW = 390, z, radius = 0, shadow, border = '' }) =>
  `<div class="float" style="left:${x}px;top:${y}px;width:${box.w * z}px;height:${box.h * z}px;border-radius:${radius}px;${shadow ? `box-shadow:${shadow};` : ''}${border ? `outline:${border};outline-offset:-1px;` : ''}"><img src="${SHOT(shot)}" style="left:${-box.x * z}px;top:${-box.y * z}px;width:${srcW * z}px"></div>`

// The same, inline: for tiles and cards that lay their pieces out themselves.
const piece = ({ shot, box, srcW = 390, z, radius = 0 }) =>
  `<span style="display:block;position:relative;overflow:hidden;width:${box.w * z}px;height:${box.h * z}px;border-radius:${radius}px;flex-shrink:0"><img src="${SHOT(shot)}" style="display:block;position:absolute;max-width:none;left:${-box.x * z}px;top:${-box.y * z}px;width:${srcW * z}px"></span>`

// Headline: bold line(s) then regular line(s). The closing comma or full
// stop takes the slide's dot colour, the way the last launch's cover did.
const mark = (line, accent) => accent ? line.replace(/([,.])$/, `<i style="color:${accent}">$1</i>`) : line
const copy = ({ top, left = 86, bold, reg = [], sub, cls = '', accent, isNew = false }) =>
  `<div class="copy ${cls}" style="top:${top}px;left:${left}px">${isNew ? '<span class="new">New</span>' : ''}<h1 class="h">${[].concat(bold).map(l => `<b>${mark(l, accent)}</b>`).join('')}${[].concat(reg).map(l => `<span>${mark(l, accent)}</span>`).join('')}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>`

// Two layouts, alternating like the reference: words above a phone that
// runs off the bottom, or a phone hanging from the top with words below.
const SMALL = { x: 78, w: 1086, bezel: 42 }, Z = (SMALL.w - 2 * SMALL.bezel) / 390
const HT_Y = 900, PT_Y = 1800 - phoneH(SMALL.w, SMALL.bezel)
const headlineTop = ({ shot, inset, insetBg, ...c }) =>
  copy({ top: 169, ...c }) + phone({ ...SMALL, y: HT_Y, shot, inset, insetBg })
const phoneTop = ({ shot, inset, insetBg, ...c }) =>
  phone({ ...SMALL, y: PT_Y, shot, inset, insetBg }) + copy({ top: 1963, ...c })
// where a point of the page lands on the slide, for lining pieces up with it
const at = (phoneY, inset) => ({ x: px => SMALL.x + SMALL.bezel + px * Z, y: py => phoneY + SMALL.bezel + (inset + py) * Z })

const peepAt = ({ c, r, x, bottom = 0, s, z = 1, canvasH = H }) =>
  `<div class="peep" style="left:${x}px;top:${canvasH - 324 - bottom}px;transform:scale(${s});background-position:${-c * 240}px ${-r * 324}px;z-index:${z}"></div>`

// What this launch adds over the last one (December 2025).
const whatsNew = [
  [DOTS.orange, 'Markdown export'],
  [DOTS.violet, 'Private draft links'],
  [DOTS.green, 'Subscribe from any post'],
  [DOTS.blue, 'Explore, no sign-up'],
]

// ---------- slides ----------
const slides = []

// 01 — cover (paper, the home page: bento, one line, the crowd)
{
  const front = [[6, 0], [2, 3], [9, 2], [12, 0], [4, 3], [13, 3], [8, 1]]
  const back = [[1, 0], [5, 2], [11, 1], [3, 3], [14, 2], [7, 1]]
  const peeps = back.map(([c, r], i) => peepAt({ c, r, x: -16 + i * 204, bottom: 110, s: 1.8, z: 0 })).join('')
    + front.map(([c, r], i) => peepAt({ c, r, x: -110 + i * 190, bottom: -86, s: 1.95, z: i % 2 ? 2 : 1 })).join('')
  slides.push({
    name: '01-write-anything', w: W, h: H, canvas: 'paper',
    body: `<div class="emoji" style="left:70px;top:150px;width:275px;height:275px;font-size:230px">🍱</div>`
      + copy({ cls: 'cover', top: 520, bold: 'Write anything,', reg: ['with nothing', 'in the way.'], accent: DOTS.orange, sub: 'Free and open-source, with no ads and no paywalls.' })
      + `<div style="position:absolute;left:86px;top:1452px;width:1090px"><p class="kicker" style="margin-bottom:30px">New in this launch</p><div class="chips">${whatsNew.map(([c, t]) => `<span class="chip">${dot(c, 24)}${t}</span>`).join('')}</div></div>`
      + peeps,
  })
}

// 02 + 03 — the editor, one big phone across the pair (rendered once, cut in
// two); on the right, the post settings panel of the same draft
{
  const big = phone({ x: 492, y: HT_Y, w: 1500, bezel: 60, shot: 'editor-sunday', insetBg: '#f6f6f6' })
  const panel = { x: 2, y: 0, w: META.panel.w - 2, h: META.panel.h }
  const body = copy({ top: 169, bold: 'A calm editor', reg: ['that stays out', 'of your way.'], accent: DOTS.green, sub: 'Every word saves itself as you type.' })
    + copy({ top: 169, left: W + 86, isNew: true, bold: 'Share a draft', reg: 'before it’s live.', accent: DOTS.violet, sub: 'Send a private link for a second pair of eyes. Turn it off whenever you like.' })
    + big
    + float({ x: W + 196, y: 1322, shot: 'panel-visibility', box: panel, srcW: META.panel.w, z: 2.74, radius: 38, border: '2px solid rgb(222,223,223)' })
  slides.push({ name: '02+03', w: W * 2, h: H, canvas: 'ink', body, split: ['02-a-calm-editor', '03-share-a-draft'] })
}

// 04 — the / menu (paper, dark editor)
{
  const inset = 92, p = at(PT_Y, inset), m = META.slash.menu
  slides.push({
    name: '04-type-slash', w: W, h: H, canvas: 'paper',
    body: phoneTop({ bold: 'Type /', reg: 'for the rest.', accent: DOTS.blue, sub: 'Headings, to-do lists, quotes, code, images and pop-ups, a keystroke away.', shot: 'editor-slash', inset, insetBg: '#1c1c1c' })
      + float({ x: 356, y: p.y(m.y) + 2, shot: 'slash-menu', box: { x: 0, y: 0, w: m.w, h: m.h }, srcW: m.w, z: 3.06, radius: 25, shadow: '0 30px 70px rgba(0,0,0,.45),0 8px 20px rgba(0,0,0,.25)' }),
  })
}

// 05 — voice input (ink, light editor, 14 seconds into a recording)
{
  const p = at(HT_Y, 32), b = META.voice.button, z = Z * 1.46
  slides.push({
    name: '05-talk-to-write', w: W, h: H, canvas: 'ink',
    body: headlineTop({ bold: 'Talk to write,', reg: 'Bublr types.', accent: DOTS.red, sub: "Hit Voice and say what's on your mind. Bublr turns it into text right where you left off.", shot: 'editor-voice', insetBg: '#f6f6f6' })
      // the Stop button, popped out of the toolbar where it sits
      + float({ x: p.x(b.x) - 6, y: p.y(b.y + b.h / 2) - (b.h * z) / 2, shot: 'editor-voice', box: b, z, radius: 6 * z, shadow: '0 12px 30px rgba(239,68,68,.4),0 3px 8px rgba(0,0,0,.16)' }),
  })
}

// 06 — profile (paper, dark profile) and the dot colour picker from post settings
{
  const d = META.dots, z = 2.42
  slides.push({
    name: '06-your-corner', w: W, h: H, canvas: 'paper',
    body: phoneTop({ bold: 'Your corner,', reg: 'your colors.', accent: DOTS.purple, sub: 'Pick a dot color for every post, add your bio and links, or put it all on your own domain.', shot: 'profile-dark', inset: 128, insetBg: '#171717' })
      + `<div class="float" style="left:330px;top:1396px;padding:42px 46px 46px;background:#fcfcfc;border-radius:34px;outline:2px solid rgb(222,223,223);outline-offset:-1px">${piece({ shot: 'dot-picker', box: { x: 0, y: 0, w: d.w, h: d.h }, srcW: d.w, z })}</div>`,
  })
}

// 07 — stickers (ink, the same profile in light, in edit mode)
{
  const t = META.toolbar, z = 1.76
  slides.push({
    name: '07-make-it-yours', w: W, h: H, canvas: 'ink',
    body: headlineTop({ bold: 'Make it yours,', reg: 'stickers and all.', accent: DOTS.blue, sub: 'Drop a sticker on your page, then drag, resize and rotate it until it sits right.', shot: 'profile-edit', insetBg: '#f7f7f7' })
      // the page fades out under the sticker toolbar, which the app pins to
      // the bottom of the screen (shown here as the one row a wide screen gets)
      + `<div style="position:absolute;left:120px;top:2280px;width:1002px;height:410px;z-index:5;background:linear-gradient(to bottom,rgba(247,247,247,0),#f7f7f7 170px)"></div>`
      + float({ x: (W - t.w * z) / 2, y: 2508, shot: 'sticker-toolbar', box: { x: 0, y: 0, w: t.w, h: t.h }, srcW: t.w, z, radius: 12 * z, shadow: '0 18px 44px rgba(0,0,0,.22),0 4px 12px rgba(0,0,0,.1)' }),
  })
}

// 08 — explore (paper, the crowd reads along)
{
  const crowd = [[4, 2], [0, 1], [13, 0], [5, 2], [1, 3], [8, 2], [14, 3]]
  slides.push({
    name: '08-read-freely', w: W, h: H, canvas: 'paper',
    body: headlineTop({ isNew: true, bold: 'Read freely,', reg: 'no sign-up.', accent: DOTS.blue, sub: 'Anyone can browse Explore. Sign in to follow writers and save posts to your reading list.', shot: 'explore-light' })
      + `<div style="position:absolute;left:120px;top:1930px;width:1002px;height:760px;z-index:5;background:linear-gradient(to bottom,rgba(252,252,252,0),#fcfcfc 230px)"></div>`
      + crowd.map(([c, r], i) => peepAt({ c, r, x: -120 + i * 196, bottom: -78, s: 1.72, z: 7 + (i % 2) })).join(''),
  })
}

// 09 — newsletter (ink, a published post, and the email its subscribers get)
{
  const e = META.email, z = 1.5
  slides.push({
    name: '09-newsletter-built-in', w: W, h: H, canvas: 'ink',
    body: phoneTop({ isNew: true, bold: 'A newsletter,', reg: 'built right in.', accent: DOTS.green, sub: 'Readers sign up at the end of any post and confirm by email. You publish, they get it.', shot: 'post-light', inset: 96 })
      + float({ x: 412, y: 1052, shot: 'email', box: { x: 0, y: 0, w: e.w, h: e.h }, srcW: e.w, z, radius: 8 * z }),
  })
}

// 10 — export (paper, dark settings, and what is inside the .zip)
{
  slides.push({
    name: '10-your-words-are-yours', w: W, h: H, canvas: 'paper',
    body: headlineTop({ isNew: true, bold: 'Your words', reg: 'are yours.', accent: DOTS.orange, sub: 'Export every post and draft as Markdown in one .zip. Leave whenever you like.', shot: 'advanced-dark-full', insetBg: '#1c1c1c' })
      + `<div style="position:absolute;z-index:6;left:486px;top:2010px"><div style="zoom:1.92;width:362px;border-radius:14px;box-shadow:0 14px 34px rgba(0,0,0,.4),0 4px 10px rgba(0,0,0,.2)">${zipCard({ filename: META.export.filename, files: META.exportFiles, counts: META.exportCounts })}</div></div>`,
  })
}

// landscape 1270x760 — the product itself: the editor on a wide screen, and
// the writer's page on a phone. Both are real captures.
{
  const css = `.land .h{font-size:65px;line-height:1.23;letter-spacing:-0.042em}.land .sub{font-size:24px;line-height:1.46;margin-top:28px;max-width:440px;text-wrap:balance}
.win{position:absolute;background:var(--bezel);box-shadow:var(--phone-shadow);overflow:hidden}
.win .bar{display:flex;align-items:center;gap:7px;padding:0 15px}
.win .bar i{width:9px;height:9px;border-radius:50%;background:var(--notch-dot)}
.win img{display:block}`
  const e = META.editorWide, z = 0.84, edge = 8, bar = 30
  const win = { x: 604, y: 92, w: e.w * z + 2 * edge, h: e.h * z + bar + edge }
  const body = `<div class="emoji" style="left:76px;top:118px;width:115px;height:115px;font-size:96px">🍱</div>`
    + copy({ cls: 'land', top: 282, left: 80, bold: 'Write anything,', reg: ['with nothing', 'in the way.'], accent: DOTS.orange, sub: 'A calm, open-source blog and newsletter you can take with you.' })
    + `<div class="win" style="left:${win.x}px;top:${win.y}px;width:${win.w}px;height:${win.h}px;border-radius:17px"><div class="bar" style="height:${bar}px"><i></i><i></i><i></i></div><img src="${SHOT('editor-wide')}" style="width:${e.w * z}px;margin-left:${edge}px;border-radius:3px 3px 10px 10px"></div>`
    + phone({ x: 1016, y: 478, w: 240, bezel: 9, shot: 'profile-dark', insetBg: '#171717' })
  slides.push({ name: 'ph-landscape-1270x760', w: 1270, h: 760, canvas: 'ink', body, css })
}

// Product Hunt thumbnail 240x240
slides.push({ name: 'thumbnail-240', w: 240, h: 240, canvas: 'paper', body: `<div class="emoji" style="left:0;top:0;width:240px;height:240px;justify-content:center;font-size:168px">🍱</div>` })

// ---------- render ----------
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const s of slides) {
  if (ONLY && !s.name.includes(ONLY) && !(s.split || []).some(n => n.includes(ONLY))) continue
  const file = path.join(HTML, `${s.name}.html`)
  fs.writeFileSync(file, doc(s.w, s.h, s.canvas, s.body, s.css || ''))
  await page.setViewportSize({ width: s.w, height: s.h })
  await page.goto('file://' + file, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))))
  await page.waitForTimeout(300)
  if (s.split) {
    for (const [i, n] of s.split.entries()) {
      await page.screenshot({ path: path.join(OUT, `${n}.png`), clip: { x: i * W, y: 0, width: W, height: H } })
    }
  } else {
    await page.screenshot({ path: path.join(OUT, `${s.name}.png`) })
  }
  console.log('rendered', s.name)
}

// preview strip from the portraits
const order = slides.flatMap(s => s.split || [s.name]).filter(n => /^\d\d-/.test(n))
if (!ONLY || 'preview-gallery-strip'.includes(ONLY)) {
  const imgs = order.map((n, i) => `<img src="file://${path.join(OUT, n + '.png')}" style="position:absolute;left:${40 + i * 255}px;top:40px;width:206px;height:446px;border-radius:23px;box-shadow:0 0 0 1px rgb(222,223,223)">`).join('')
  const sw = 40 + order.length * 255 - 49 + 40
  const file = path.join(HTML, 'strip.html')
  fs.writeFileSync(file, `<!doctype html><html><body style="margin:0;width:${sw}px;height:526px;background:#fff;position:relative">${imgs}</body></html>`)
  await page.setViewportSize({ width: sw, height: 526 })
  await page.goto('file://' + file, { waitUntil: 'load' })
  await page.screenshot({ path: path.join(OUT, 'preview-gallery-strip.png') })
  console.log('rendered preview-gallery-strip')
}
await browser.close()

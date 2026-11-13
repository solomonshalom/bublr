// The email a subscriber gets, built by the app's own template
// (generateNewPostEmailHTML in src/lib/resend.js) and photographed.
import fs from 'fs'
import path from 'path'
import { chromium } from './lib.mjs'
const OUT = path.resolve(process.argv[2] || '../shots')
const src = fs.readFileSync(path.resolve(process.argv[3] || '../app/src/lib/resend.js'), 'utf8')
const a = src.indexOf('function generateNewPostEmailHTML')
const b = src.indexOf('\n}\n', a) + 2
const build = new Function(src.slice(a, b) + '\nreturn generateNewPostEmailHTML')()
const photo = 'data:image/png;base64,' + fs.readFileSync(path.resolve('../app/public/demo/juniper.png')).toString('base64')
const post = JSON.parse(fs.readFileSync(path.join(OUT, 'export-post.json'), 'utf8'))
const html = build({
  authorName: 'Juniper Hale', authorPhoto: photo,
  postTitle: post.title, postExcerpt: post.excerpt, postContent: post.html,
  postUrl: 'https://bublr.life/juniper/' + post.slug, postColor: post.dotColor,
  unsubscribeUrl: 'https://bublr.life/api/newsletter/unsubscribe',
})
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 600, height: 900 }, deviceScaleFactor: 4 })
await page.route('**/*', r => (r.request().url().startsWith('data:') || r.request().url().startsWith('about:') ? r.continue() : /fonts\.(googleapis|gstatic)\.com/.test(r.request().url()) ? r.continue() : r.abort()))
// mail apps don't have Inter unless it's installed; load it so it matches the app
await page.setContent(html.replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" rel="stylesheet"></head>'), { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(500)
const card = page.locator('table table').first()
const b2 = await card.boundingBox()
await page.screenshot({ path: path.join(OUT, 'email.png'), clip: { x: b2.x, y: b2.y, width: b2.width, height: b2.height } })
const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf8'))
meta.email = { w: b2.width, h: b2.height }
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2))
console.log('email', meta.email)
await browser.close()

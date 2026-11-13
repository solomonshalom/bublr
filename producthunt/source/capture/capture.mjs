// Screenshots of the real app (private copy + emulator) for the Product Hunt
// slides. Everything saved here is pixels the app itself drew.
//   node capture.mjs <outDir> [only]
import fs from 'fs'
import path from 'path'
import { launch, newContext, BASE, assertLocal, patchDoc } from './lib.mjs'
import { signIn } from './seed.mjs'

const OUT = path.resolve(process.argv[2] || '../shots')
const ONLY = process.argv[3] || ''
fs.mkdirSync(OUT, { recursive: true })
const { uid, ids } = JSON.parse(fs.readFileSync('state.json', 'utf8'))
const want = n => !ONLY || n.includes(ONLY)
const meta = fs.existsSync(path.join(OUT, 'meta.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf8')) : {}
const save = () => fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2))
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(OUT, name + '.png'), animations: 'disabled', ...opts })
const settle = async (page, ms = 1400) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(ms) }
const PHONE = { width: 390, height: 844 }, DESK = { width: 1280, height: 900 }
const box = async loc => { const b = await loc.boundingBox(); return { x: b.x, y: b.y, w: b.width, h: b.height } }

const browser = await launch()

async function editorAt(page, id) {
  await page.goto(`${BASE}/dashboard/${id}`, { waitUntil: 'load' })
  await page.waitForSelector('.ProseMirror', { timeout: 40000 })
  await page.waitForFunction(() => document.querySelectorAll('.ProseMirror').length >= 3 && document.querySelectorAll('.ProseMirror')[2].innerText.trim().length > 10, null, { timeout: 40000 })
  await settle(page, 1800)
}
const endOfBody = async page => {
  await page.locator('.ProseMirror').nth(2).click()
  await page.keyboard.press('Meta+ArrowDown')
  await page.keyboard.press('End')
}

// ---------- signed in, light ----------
if (want('editor-sunday') || want('panel') || want('voice') || want('profile-edit') || want('dots') || want('advanced-light')) {
  const ctx = await newContext(browser, { theme: 'light' })
  const page = await ctx.newPage()
  await signIn(page)

  if (want('editor-sunday')) {
    await page.setViewportSize(PHONE)
    await editorAt(page, ids.sunday)
    await shot(page, 'editor-sunday')
    console.log('editor-sunday')
  }

  if (want('panel')) {
    // The settings panel is a 22rem side panel on a wide screen; same panel, same draft.
    await page.setViewportSize(DESK)
    await editorAt(page, ids.sunday)
    await page.click('button[aria-label^="Toggle post settings"]')
    await page.waitForSelector('aside[data-open="true"]')
    await page.waitForFunction(() => /draft\//.test(document.querySelector('aside[data-open="true"] input[readonly]')?.value || ''), null, { timeout: 20000 })
    await settle(page, 900)
    const aside = await box(page.locator('aside[data-open="true"]'))
    const vis = await box(page.locator('aside[data-open="true"] section').first())
    meta.panel = { w: aside.w, h: vis.y + vis.h - aside.y + 22, link: await page.inputValue('aside[data-open="true"] input[readonly]') }
    await shot(page, 'panel-visibility', { clip: { x: aside.x, y: aside.y, width: aside.w, height: meta.panel.h } })
    console.log('panel-visibility', meta.panel)
    save()
  }

  if (want('dots')) {
    await page.setViewportSize(DESK)
    await editorAt(page, ids.words)
    await page.click('button[aria-label^="Toggle post settings"]')
    await page.waitForSelector('aside[data-open="true"]')
    const field = page.locator('aside[data-open="true"] div:has(> label:text-is("Profile Dot Color"))').last()
    await field.scrollIntoViewIfNeeded()
    await settle(page, 700)
    const b = await box(field)
    meta.dots = { w: b.w, h: b.h }
    await shot(page, 'dot-picker', { clip: { x: b.x, y: b.y, width: b.w, height: b.h } })
    console.log('dot-picker', meta.dots)
    save()
  }

  if (want('voice')) {
    await page.setViewportSize(PHONE)
    await editorAt(page, ids.walk)
    await endOfBody(page)
    await page.locator('button:has-text("Voice")').click()
    await page.mouse.move(8, 700)
    await page.waitForFunction(() => /Stop \(0:14\)/.test(document.body.innerText), null, { timeout: 40000, polling: 100 })
    await shot(page, 'editor-voice', { caret: 'initial' })
    meta.voice = { button: await box(page.locator('button:has-text("Stop")')) }
    console.log('editor-voice', meta.voice)
    save()
    await page.locator('button:has-text("Stop")').click().catch(() => {})
    await page.waitForTimeout(500)
  }

  if (want('profile-edit')) {
    await page.setViewportSize(PHONE)
    await page.goto(`${BASE}/juniper`, { waitUntil: 'load' })
    await page.waitForSelector('text=Writing', { timeout: 40000 })
    await settle(page, 1800)
    await page.locator('button[title="Edit decorations"]').click()
    await page.waitForSelector('button[title="Done editing"]')
    await page.locator('img[src*="sticker-starry-night"]').click({ force: true })
    await settle(page, 900)
    await shot(page, 'profile-edit')
    meta.profileEdit = { sticker: await box(page.locator('img[src*="sticker-starry-night"]')) }
    console.log('profile-edit', meta.profileEdit)
    // the same toolbar as one row, the way a wide screen lays it out
    await page.setViewportSize(DESK)
    await settle(page, 900)
    const bar = page.locator('button[title="Add sticker"]').locator('xpath=..')
    const bb = await box(bar)
    meta.toolbar = { w: bb.w, h: bb.h }
    await shot(page, 'sticker-toolbar', { clip: { x: bb.x, y: bb.y, width: bb.w, height: bb.h } })
    console.log('sticker-toolbar', meta.toolbar)
    save()
    await page.locator('button[title="Done editing"]').click().catch(() => {})
    await page.waitForTimeout(1200)
  }

  if (want('advanced-light')) {
    await page.setViewportSize(PHONE)
    await page.goto(`${BASE}/dashboard/settings/advanced`, { waitUntil: 'load' })
    await page.waitForSelector('button:has-text("Download export")', { timeout: 40000 })
    await settle(page, 1800)
    await shot(page, 'advanced-light')
    meta.advancedLight = { exportButton: await box(page.locator('button:has-text("Download export")')) }
    console.log('advanced-light', meta.advancedLight)
    save()
  }
  await ctx.close()
}

// ---------- signed in, light, on a wide screen ----------
if (want('wide')) {
  const size = { width: 740, height: 580 }
  const ctx = await newContext(browser, { theme: 'light', mobile: false, ...size })
  const page = await ctx.newPage()
  await signIn(page)
  await page.setViewportSize(size)
  await editorAt(page, ids.sunday)
  await page.mouse.move(370, 560)
  await settle(page, 600)
  await shot(page, 'editor-wide')
  meta.editorWide = { w: size.width, h: size.height }
  console.log('editor-wide')
  save()
  await ctx.close()
}

// ---------- signed in, dark ----------
if (want('slash') || want('advanced')) {
  const ctx = await newContext(browser, { theme: 'dark' })
  const page = await ctx.newPage()
  await signIn(page)

  if (want('slash')) {
    await page.setViewportSize(PHONE)
    // back to the two saved paragraphs, so the "/" is typed fresh each run
    await patchDoc('posts/' + ids.notebooks, { content: '<p>Fancy notebooks scare me. The paper is too nice to waste on a bad sentence.</p><p>A boring one asks for nothing. So I fill it.</p>' })
    await editorAt(page, ids.notebooks)
    await endOfBody(page)
    // start from the saved two paragraphs every time
    const paras = await page.locator('.ProseMirror').nth(2).locator('p').count()
    if (paras < 3) await page.keyboard.press('Enter')
    const last = (await page.locator('.ProseMirror').nth(2).locator('p').last().innerText()).trim()
    if (last !== '/') await page.keyboard.type('/')
    else { await page.keyboard.press('Backspace'); await page.keyboard.type('/') }
    await page.waitForSelector('.tippy-box', { timeout: 15000 })
    await page.keyboard.press('ArrowDown')
    await page.waitForFunction(() => /\bSaved\b/.test(document.querySelector('header')?.innerText || ''), null, { timeout: 20000 }).catch(() => console.log('still unsaved'))
    await settle(page, 700)
    const tb = await box(page.locator('.tippy-box'))
    meta.slash = { menu: tb, caret: await page.evaluate(() => { const r = window.getSelection().getRangeAt(0).getBoundingClientRect(); return { x: r.x, y: r.y, h: r.height } }) }
    await shot(page, 'slash-menu', { clip: { x: tb.x, y: tb.y, width: tb.w, height: tb.h } })
    await shot(page, 'editor-slash-open', { caret: 'initial' })
    await page.keyboard.press('Escape')
    await settle(page, 500)
    await page.keyboard.press('ArrowRight')
    await shot(page, 'editor-slash', { caret: 'initial' })
    console.log('slash', meta.slash)
    save()
  }

  if (want('advanced')) {
    await page.setViewportSize(PHONE)
    await page.goto(`${BASE}/dashboard/settings/advanced`, { waitUntil: 'load' })
    await page.waitForSelector('button:has-text("Download export")', { timeout: 40000 })
    await settle(page, 1800)
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('button:has-text("Download export")').click(),
    ])
    const zip = path.join(OUT, 'export.zip')
    await download.saveAs(zip)
    meta.export = { filename: download.suggestedFilename() }
    await page.waitForSelector('button:has-text("Downloaded")', { timeout: 15000 })
    await settle(page, 600)
    await shot(page, 'advanced-dark')
    await shot(page, 'advanced-dark-full', { fullPage: true })
    meta.advanced = { exportButton: await box(page.locator('button:has-text("Downloaded")')), scrollHeight: await page.evaluate(() => document.documentElement.scrollHeight) }
    console.log('advanced', meta.export, meta.advanced)
    save()
  }
  await ctx.close()
}

// ---------- signed out ----------
for (const theme of ['dark', 'light']) {
  const names = theme === 'dark' ? ['profile-dark'] : ['post-light', 'explore-light', 'profile-light', 'draft-light']
  if (!names.some(want)) continue
  const ctx = await newContext(browser, { theme })
  const page = await ctx.newPage()
  await assertLocal(page)
  if (want('profile-' + theme)) {
    await page.goto(`${BASE}/juniper`, { waitUntil: 'load' })
    await page.waitForSelector('text=Writing', { timeout: 40000 })
    await page.waitForSelector('img[src*="sticker-starry-night"]', { timeout: 20000 }).catch(() => console.log('no sticker in view mode?'))
    await settle(page, 2200)
    await shot(page, 'profile-' + theme, { fullPage: true })
    meta['profile-' + theme] = { scrollHeight: await page.evaluate(() => document.documentElement.scrollHeight) }
    console.log('profile-' + theme, meta['profile-' + theme])
  }
  if (theme === 'light' && want('post-light')) {
    await page.goto(`${BASE}/juniper/writing-300-words-a-day-for-a-year`, { waitUntil: 'load' })
    await page.waitForSelector('button:has-text("newsletter")', { timeout: 40000 })
    await settle(page, 2200)
    await shot(page, 'post-light', { fullPage: true })
    meta.post = { scrollHeight: await page.evaluate(() => document.documentElement.scrollHeight), subscribe: await box(page.locator('button:has-text("newsletter")')) }
    console.log('post-light', meta.post)
  }
  if (theme === 'light' && want('explore-light')) {
    await page.goto(`${BASE}/explore`, { waitUntil: 'load' })
    await page.waitForSelector('text=Learning Japanese at 40', { timeout: 40000 })
    await settle(page, 2200)
    await shot(page, 'explore-light', { fullPage: true })
    meta.explore = { scrollHeight: await page.evaluate(() => document.documentElement.scrollHeight) }
    console.log('explore-light', meta.explore)
  }
  if (theme === 'light' && want('draft-light')) {
    await page.goto(`${BASE}/draft/9f2c41e07ab35d86c0e4b7a1d2f3905c6e8a4b17d0c3f2e9`, { waitUntil: 'load' })
    await page.waitForSelector('text=Private draft', { timeout: 40000 })
    await settle(page, 2000)
    await shot(page, 'draft-light')
    console.log('draft-light')
  }
  save()
  await ctx.close()
}

await browser.close()
save()
console.log('done ->', OUT)

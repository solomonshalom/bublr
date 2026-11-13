// Fills the emulator with the demo writer, through the real app where the
// app can do it (sign-up, writing posts) and directly in the emulator for the
// rest (publishing needs Google-signed tokens, which an emulator can't mint).
import fs from 'fs'
import { launch, newContext, BASE, wipe, getDoc, patchDoc, setDoc, assertLocal } from './lib.mjs'

export const EMAIL = 'juniper@example.com', PASSWORD = 'slow-sunday-42'

export async function signIn(page) {
  await assertLocal(page)
  await page.goto(BASE + '/signup', { waitUntil: 'load' })
  await page.waitForSelector('input[type=email]', { timeout: 30000 })
  await page.waitForTimeout(600)
  await page.fill('input[type=email]', EMAIL)
  await page.fill('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForURL('**/dashboard', { timeout: 40000 })
  await page.waitForFunction(() => window.__firebase && window.__firebase.auth().currentUser, null, { timeout: 30000 })
  return page.evaluate(() => window.__firebase.auth().currentUser.uid)
}

async function writePost(page, { title, excerpt, paras }) {
  await page.goto(BASE + '/dashboard', { waitUntil: 'load' })
  const btn = page.locator('button:has-text("Create Post")').first()
  await btn.waitFor({ timeout: 30000 })
  await page.waitForTimeout(800)
  await btn.click()
  await page.waitForURL(/\/dashboard\/[A-Za-z0-9]{12,}$/, { timeout: 40000 })
  await page.waitForSelector('.ProseMirror', { timeout: 40000 })
  await page.waitForTimeout(1200)
  const eds = page.locator('.ProseMirror')
  await eds.nth(0).click(); await page.keyboard.type(title, { delay: 4 })
  await eds.nth(1).click(); await page.keyboard.type(excerpt, { delay: 4 })
  await eds.nth(2).click()
  for (const [i, p] of paras.entries()) { if (i) await page.keyboard.press('Enter'); await page.keyboard.type(p, { delay: 2 }) }
  await page.waitForTimeout(3500) // autosave
  const id = page.url().split('/').pop()
  console.log('wrote', id, title)
  return id
}

if (process.argv[1].endsWith('seed.mjs')) {
  await wipe()
  const browser = await launch()
  const ctx = await newContext(browser)
  const page = await ctx.newPage()
  const uid = await signIn(page)
  // the app writes the new profile right after sign-up; let it finish first
  for (let i = 0; i < 40 && !(await getDoc('users/' + uid)); i++) await page.waitForTimeout(250)
  await page.waitForTimeout(1200)
  await patchDoc('users/' + uid, {
    name: 'juniper', displayName: 'Juniper Hale',
    about: 'Essays on slow mornings, small towns and learning to write in public.',
    photo: '/demo/juniper.png',
  })

  const ids = {}
  ids.sunday = await writePost(page, {
    title: 'Notes from a slow Sunday',
    excerpt: 'On coffee, quiet mornings and writing without an audience.',
    paras: [
      "The kettle clicks off before I'm properly awake. Sundays are for the writing nobody asked for: no deadline, no audience, just a page and whatever turns up.",
      "Most weeks it's small things. The neighbour's radio through the wall. A list of books I keep meaning to finish.",
    ],
  })
  ids.notebooks = await writePost(page, {
    title: 'The case for boring notebooks',
    excerpt: 'Why the plainest notebook on the shelf is the one I actually fill.',
    paras: [
      'Fancy notebooks scare me. The paper is too nice to waste on a bad sentence.',
      'A boring one asks for nothing. So I fill it.',
    ],
  })
  ids.walk = await writePost(page, {
    title: 'Things I noticed on the walk home',
    excerpt: 'A voice memo, mostly. Typed up on the bus.',
    paras: [
      "I've started talking these out loud on the way back. It's quicker than typing, and I notice more when I'm not staring at a screen.",
      'Mrs. Patel has painted her front door yellow. The 7:40 bus was early, for once.',
      'The bakery on the corner was closing early, so I bought the last loaf and ate half of it before the bridge',
    ],
  })
  ids.words = await writePost(page, {
    title: 'Writing 300 words a day for a year',
    excerpt: "What changed, what didn't, and the one rule that kept me going.",
    paras: [
      'In January I promised myself 300 words a day. Not good words. Just words.',
      'Most of them were bad. That was the point.',
      'Some days the 300 words were a grocery list with feelings. Some days they were the best thing I wrote all year. I never knew which until I sat down.',
      "If you want to try it, start tomorrow. Don't wait for a good idea.",
    ],
  })
  const sample = await getDoc('posts/' + ids.words)
  console.log('post shape:', JSON.stringify(sample).slice(0, 900))
  console.log('user:', JSON.stringify(await getDoc('users/' + uid)).slice(0, 600))
  fs.writeFileSync('state.json', JSON.stringify({ uid, ids }, null, 2))
  await page.screenshot({ path: 'out/x-editor.png' })
  await browser.close()
}

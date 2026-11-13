// Shared helpers for driving the private copy of Bublr (emulator-backed).
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
export const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')

// The test browser resolves bublr.life to the local copy (see launch()), so
// the app prints its real address in links. assertLocal() proves it first.
export const BASE = 'https://bublr.life'
const FS = 'http://127.0.0.1:8080/v1/projects/demo-bublr/databases/(default)/documents'
const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }

export function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } }
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } }
}
export function fromValue(v) {
  if ('stringValue' in v) return v.stringValue
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('timestampValue' in v) return new Date(v.timestampValue)
  if ('nullValue' in v) return null
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue)
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromValue(x)]))
  return undefined
}
const fields = o => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toValue(v)])) })

export async function getDoc(path) {
  const r = await fetch(`${FS}/${path}`, { headers: H })
  if (!r.ok) return null
  const j = await r.json()
  return Object.fromEntries(Object.entries(j.fields || {}).map(([k, v]) => [k, fromValue(v)]))
}
export async function patchDoc(path, data) {
  const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const r = await fetch(`${FS}/${path}?${mask}`, { method: 'PATCH', headers: H, body: JSON.stringify(fields(data)) })
  if (!r.ok) throw new Error(`patch ${path}: ${r.status} ${await r.text()}`)
}
export async function setDoc(path, data) {
  const r = await fetch(`${FS}/${path}`, { method: 'PATCH', headers: H, body: JSON.stringify(fields(data)) })
  if (!r.ok) throw new Error(`set ${path}: ${r.status} ${await r.text()}`)
}
export async function listDocs(coll) {
  const r = await fetch(`${FS}/${coll}?pageSize=200`, { headers: H })
  const j = await r.json()
  return (j.documents || []).map(d => ({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromValue(v)])) }))
}
export async function wipe() {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-bublr/databases/(default)/documents', { method: 'DELETE' })
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-bublr/accounts', { method: 'DELETE' })
}

// Only this machine and the font hosts are reachable from the pages.
const ALLOW = /^(bublr\.life|localhost|127\.0\.0\.1|fonts\.googleapis\.com|fonts\.gstatic\.com|fonts\.bunny\.net)$/
export async function newContext(browser, { width = 390, height = 844, dsf = 4, theme = 'light', mobile = true } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: dsf, isMobile: mobile, hasTouch: mobile,
    colorScheme: theme, permissions: ['microphone'], acceptDownloads: true, bypassCSP: true,
  })
  await ctx.route('**/*', route => {
    const host = new URL(route.request().url()).hostname
    return ALLOW.test(host) ? route.continue() : route.abort()
  })
  await ctx.addInitScript(t => {
    try { localStorage.setItem('theme', t) } catch (_) {}
    // The pre-launch "Back by Dec 10th" banner is an announcement, not product UI.
    const add = () => { const s = document.createElement('style'); s.textContent = `div:has(> a[aria-label^="We're making a comeback"]){display:none!important}`; document.documentElement.appendChild(s) }
    if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add)
  }, theme)
  return ctx
}
export const launch = () => chromium.launch({
  channel: 'chrome',
  args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--host-resolver-rules=MAP bublr.life 127.0.0.1:3443', '--ignore-certificate-errors',
  ],
})

// Stop unless bublr.life really is the local copy. Asked through the browser
// (which has the mapping), for a file that only exists in the copy.
export async function assertLocal(page) {
  const r = await page.goto(BASE + '/demo/juniper.png', { waitUntil: 'load' }).catch(() => null)
  if (!r || !r.ok() || !/image\/png/.test(r.headers()['content-type'] || '')) {
    throw new Error('bublr.life is not mapped to the local copy; refusing to continue')
  }
}

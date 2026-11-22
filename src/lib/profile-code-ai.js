import Groq from 'groq-sdk'
import { COMPONENT_NAMES } from './profile-code'

/**
 * The Profile HTML AI helper ("describe it and Bublr writes it"): prompt,
 * Groq call and answer parsing. The route is /api/profile/code-ai.
 */

export const AI_LIMIT = { max: 15, windowMs: 60 * 60 * 1000 }
export const MAX_PROMPT = 2000
const MAX_CONTEXT_PER_FIELD = 24000

let groq = null
function groqClient() {
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 55 * 1000, maxRetries: 0 })
  return groq
}

export function _resetGroqClientForTesting() {
  groq = null
}

export function modelsToTry() {
  const list = [process.env.GROQ_CODE_MODEL, 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile']
  return [...new Set(list.filter(Boolean))]
}

export const SYSTEM_PROMPT = `You build personal profile pages for Bublr, a calm writing platform. Think of the creativity of 2000s MySpace pages, made with today's craft: original, expressive, mobile-friendly, accessible.

You write three parts: HTML (the body content, not a full document), CSS and optional JavaScript. The page runs in a sandboxed iframe: no forms, no alerts, no password fields, no cookies or localStorage. External images, fonts (Google Fonts via @import in CSS), scripts from https CDNs and fetch() to https APIs are allowed.

Live data from the writer's profile (always prefer it over invented text):
Template tags, HTML-escaped automatically: {{displayName}} {{name}} {{about}} {{photo}} {{banner}} {{link}} {{profileUrl}} {{followerCount}} {{followingCount}} {{postCount}} {{totalReads}} {{year}}
Lists: {{#posts}}<a href="{{url}}">{{title}}</a> {{date}} {{excerpt}} {{reads}} {{dotColor}}{{/posts}}, {{#skills}}{{.}}{{/skills}}, {{#socials}}<a href="{{url}}">{{label}}</a>{{/socials}}, {{#guestbook}}{{name}} {{message}} {{date}}{{/guestbook}}, {{#work}}{{title}} {{organization}} {{dates}}{{/work}}, {{#education}}…{{/education}}. Empty-state: {{^posts}}No posts yet{{/posts}}. Show a block only when there's data: {{#hasPosts}}…{{/hasPosts}} (also hasSkills, hasSocials, hasGuestbook, hasWork, hasEducation).
Widgets (expanded server-side; style them via their classes): ${COMPONENT_NAMES.map(n => `<bublr-${n}>`).join(' ')}.
Useful attributes: <bublr-posts limit="5" layout="list|cards|grid|compact">, <bublr-avatar size="96" shape="circle|square|rounded">, <bublr-friends users="alice, bob" title="Top 8"> (real Bublr usernames only; leave it out if you don't know any), <bublr-music src="https://….mp3" title="Song — Artist">, <bublr-counter digits="6">, <bublr-guestbook limit="6">. A widget with content inside repeats that content per item, e.g. <bublr-posts limit="3"><a href="{{url}}">{{title}}</a></bublr-posts>.
Theme: <html> has data-theme="light" or "dark" following the visitor; support both with [data-theme=dark] selectors or the --bublr-bg/--bublr-text/--bublr-muted/--bublr-border/--bublr-accent variables. Scripts can read window.bublr (the same data) and listen for the "bublr:theme" event.
CSS custom properties and class names must not depend on anything outside this page.

Reply with ONLY a JSON object: {"html": "...", "css": "...", "js": "...", "summary": "one sentence on what you made or changed"}. Keep it compact (well under 40 KB). When the writer already has code and asks for a change, return the complete updated code, keeping everything they didn't ask to change.`

function clip(value) {
  const s = typeof value === 'string' ? value : ''
  if (s.length <= MAX_CONTEXT_PER_FIELD) return s
  return `${s.slice(0, MAX_CONTEXT_PER_FIELD)}\n/* …the rest was cut off for length */`
}

export function buildMessages({ prompt, html, css, js }) {
  const hasCode = [html, css, js].some(v => typeof v === 'string' && v.trim())
  const current = hasCode
    ? `Current HTML:\n${clip(html)}\n\nCurrent CSS:\n${clip(css)}\n\nCurrent JS:\n${clip(js)}`
    : 'The writer has no code yet; start from scratch.'
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${current}\n\nWhat the writer wants:\n${prompt}` },
  ]
}

function fenced(text, langs) {
  for (const lang of langs) {
    const m = new RegExp('```' + lang + '\\s*\\n([\\s\\S]*?)```', 'i').exec(text)
    if (m) return m[1]
  }
  return ''
}

/** Read the model's answer: JSON first, then ```html/```css/```js blocks. */
export function parseAnswer(text) {
  const raw = String(text || '').trim()
  const candidates = [raw]
  const fence = /```(?:json)?\s*\n([\s\S]*?)```/i.exec(raw)
  if (fence) candidates.push(fence[1])
  const first = raw.indexOf('{')
  const last = raw.lastIndexOf('}')
  if (first !== -1 && last > first) candidates.push(raw.slice(first, last + 1))
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object' && typeof parsed.html === 'string') {
        return {
          html: parsed.html,
          css: typeof parsed.css === 'string' ? parsed.css : '',
          js: typeof parsed.js === 'string' ? parsed.js : '',
          summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 300) : '',
        }
      }
    } catch (_) {
      // try the next shape
    }
  }
  const html = fenced(raw, ['html'])
  if (html) return { html, css: fenced(raw, ['css']), js: fenced(raw, ['javascript', 'js']), summary: '' }
  return null
}

const statusOf = error => error && (error.status || error.statusCode)
const messageOf = error => String((error && error.message) || '')

// The model isn't available (renamed or retired): try the next one.
const modelMissing = error =>
  statusOf(error) === 404 || /model[\s\S]*(does not exist|not found|decommissioned|deprecated)/i.test(messageOf(error))

// JSON mode refused or failed: the same model may still answer without it.
const jsonModeProblem = error => statusOf(error) === 400 && /response_format|json/i.test(messageOf(error))

/** Ask the first model that answers. Throws the last error if none do. */
export async function complete(messages) {
  let lastError = null
  for (const model of modelsToTry()) {
    for (const json of [true, false]) {
      try {
        const completion = await groqClient().chat.completions.create({
          model,
          messages,
          temperature: 0.5,
          max_tokens: 7000,
          ...(json ? { response_format: { type: 'json_object' } } : {}),
        })
        return completion.choices?.[0]?.message?.content || ''
      } catch (error) {
        lastError = error
        if (modelMissing(error)) break
        if (json && jsonModeProblem(error)) continue
        throw error
      }
    }
  }
  throw lastError || new Error('No model answered')
}

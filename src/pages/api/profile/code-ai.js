import { requireAuth } from '../../../lib/server-auth'
import { isRateLimited } from '../../../lib/rate-limit'
import { validateProfileCode } from '../../../lib/profile-code'
import { AI_LIMIT, MAX_PROMPT, buildMessages, complete, parseAnswer } from '../../../lib/profile-code-ai'

/**
 * POST /api/profile/code-ai  { prompt, html, css, js }
 *   -> { html, css, js, summary }
 *
 * "Describe it and Bublr writes it": asks Groq to build or change the
 * writer's Profile HTML. Nothing is saved here; the editor loads the answer
 * into the preview and the writer decides whether to keep it.
 */

// Writing a whole page can take a while
export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const uid = await requireAuth(req, res)
  if (!uid) return

  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: { message: 'The AI helper isn’t set up on this server.' } })
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (prompt.length < 3) return res.status(400).json({ error: { message: 'Describe what you’d like first' } })
  if (prompt.length > MAX_PROMPT) {
    return res.status(400).json({ error: { message: `Keep the description under ${MAX_PROMPT} characters` } })
  }

  if (isRateLimited(`profile-code-ai:${uid}`, AI_LIMIT)) {
    return res.status(429).json({ error: { message: 'You’ve used the AI helper a lot this hour. Try again later.' } })
  }

  try {
    const text = await complete(buildMessages({ prompt, html: body.html, css: body.css, js: body.js }))
    const answer = parseAnswer(text)
    if (!answer) return res.status(502).json({ error: { message: 'The AI’s answer couldn’t be read. Try again.' } })

    const checked = validateProfileCode({ ...answer, mode: 'off' })
    if (!checked.ok) {
      return res.status(502).json({ error: { message: `The AI’s answer can’t be used: ${checked.error}. Try asking differently.` } })
    }
    const { html, css, js } = checked.value
    return res.status(200).json({ html, css, js, summary: answer.summary })
  } catch (error) {
    console.error('Profile HTML AI error:', error && error.message)
    const status = error && error.status === 429 ? 429 : 502
    return res.status(status).json({
      error: { message: status === 429 ? 'The AI is busy right now. Try again in a minute.' : 'The AI helper didn’t answer. Try again.' },
    })
  }
}

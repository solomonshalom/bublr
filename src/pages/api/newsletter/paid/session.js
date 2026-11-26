import { escapeHtml } from '../../../../lib/escape'
import { clearedSessionCookie, readerFromRequest, verifiedSessionCookie, verifyLoginToken, maskEmail } from '../../../../lib/reader-session'

/**
 * A reader's session for paid posts.
 *
 *   GET ?token=   the sign-in link from an email: sets the session cookie and
 *                 goes on to the post (or page) the link was made for
 *   GET           who is signed in here ({ email } masked, or null)
 *   DELETE        sign out on this device
 */
const STYLE = `
  body { font-family: Inter, -apple-system, sans-serif; padding: 40px 20px; max-width: 400px; margin: 0 auto; text-align: center; background: #fafafa; color: #2e2e2e; }
  .card { background: white; border-radius: 8px; padding: 32px; }
  h1 { font-size: 1.25rem; font-weight: 500; margin-bottom: 8px; }
  p { color: #6f6f6f; font-size: 0.9rem; line-height: 1.5; }
  a { color: #2e2e2e; }
`

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearedSessionCookie())
    return res.status(200).json({ signedOut: true })
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!req.query?.token) {
    const session = readerFromRequest(req)
    return res.status(200).json({ email: session ? maskEmail(session.email) : null })
  }

  const login = verifyLoginToken(String(req.query.token))
  if (!login) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(400).send(`<!DOCTYPE html>
<html><head><title>Link expired - Bublr</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<style>${STYLE}</style></head>
<body><div class="card">
<h1>This link has expired</h1>
<p>Sign-in links work for a limited time. Open the post again and choose “Sign in” to get a new one, or use the link in a more recent email.</p>
<p><a href="/">Return to Bublr</a></p>
</div></body></html>`)
  }

  res.setHeader('Set-Cookie', verifiedSessionCookie(login.email))
  res.setHeader('Location', login.next)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(303).send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${escapeHtml(login.next)}"></head><body><a href="${escapeHtml(login.next)}">Continue</a></body></html>`)
}

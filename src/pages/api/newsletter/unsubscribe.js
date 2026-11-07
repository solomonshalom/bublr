import { firestore } from '../../../lib/firebase'
import { escapeHtml } from '../../../lib/escape'
import { verifyUnsubscribe } from '../../../lib/unsubscribe-token'

// GET (the link in the email) only shows a confirm button, so mail scanners
// that pre-open links can't unsubscribe anyone. The button POSTs to here.
// Every request needs the signed token from the email.

const STYLE = `
  body { font-family: Inter, -apple-system, sans-serif; padding: 40px 20px; max-width: 400px; margin: 0 auto; text-align: center; background: #fafafa; color: #2e2e2e; }
  .card { background: white; border-radius: 8px; padding: 32px; }
  h1 { font-size: 1.25rem; font-weight: 500; margin-bottom: 8px; }
  p { color: #6f6f6f; font-size: 0.9rem; line-height: 1.5; }
  a { color: #2e2e2e; }
  button { font: inherit; background: #2e2e2e; color: white; border: 0; border-radius: 6px; padding: 10px 20px; cursor: pointer; margin-top: 12px; }
`

function page(res, status, title, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(status).send(`<!DOCTYPE html>
<html><head><title>${escapeHtml(title)} - Bublr</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<style>${STYLE}</style></head>
<body><div class="card">${body}</div></body></html>`)
}

const invalid = res =>
  page(
    res,
    400,
    'Invalid link',
    `<h1>Invalid Unsubscribe Link</h1>
     <p>This link appears to be invalid or incomplete. Please use the unsubscribe link from a recent newsletter email.</p>
     <p><a href="https://bublr.life">Return to Bublr</a></p>`
  )

export default async function handler(req, res) {
  const isGet = req.method === 'GET'
  if (!isGet && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const params = isGet ? req.query : { ...(req.query || {}), ...(req.body || {}) }
  const email = typeof params.email === 'string' ? params.email : ''
  const author = typeof params.author === 'string' ? params.author : ''
  const token = typeof params.token === 'string' ? params.token : ''
  const wantsHtml = isGet || (req.headers && String(req.headers['content-type'] || '').includes('form'))

  const fail = (status, message) =>
    wantsHtml
      ? page(res, status, 'Unsubscribe', `<h1>${escapeHtml(message)}</h1><p><a href="https://bublr.life">Return to Bublr</a></p>`)
      : res.status(status).json({ error: message })

  if (!email || !author) {
    return wantsHtml ? invalid(res) : res.status(400).json({ error: 'Email and author are required' })
  }
  if (!verifyUnsubscribe(email, author, token)) {
    return wantsHtml ? invalid(res) : res.status(403).json({ error: 'Invalid unsubscribe link' })
  }

  try {
    const usersSnapshot = await firestore.collection('users').where('name', '==', author).limit(1).get()
    if (usersSnapshot.empty) return fail(404, 'Author Not Found')

    const authorDoc = usersSnapshot.docs[0]
    const authorData = authorDoc.data()
    const authorLabel = escapeHtml(authorData.displayName || author)
    const authorPath = encodeURIComponent(author)

    if (isGet) {
      return page(
        res,
        200,
        'Unsubscribe',
        `<h1>Unsubscribe?</h1>
         <p>Stop getting email about new posts from ${authorLabel}?</p>
         <form method="POST" action="/api/newsletter/unsubscribe">
           <input type="hidden" name="email" value="${escapeHtml(email)}">
           <input type="hidden" name="author" value="${escapeHtml(author)}">
           <input type="hidden" name="token" value="${escapeHtml(token)}">
           <button type="submit">Unsubscribe</button>
         </form>`
      )
    }

    const normalizedEmail = email.trim().toLowerCase()
    const subscribers = authorData.subscribers || []
    const updated = subscribers.filter(
      sub => String(typeof sub === 'string' ? sub : sub.email || '').toLowerCase() !== normalizedEmail
    )
    if (updated.length !== subscribers.length) {
      await firestore.collection('users').doc(authorDoc.id).update({ subscribers: updated })
    }

    if (wantsHtml) {
      return page(
        res,
        200,
        'Unsubscribed',
        `<h1>Successfully Unsubscribed</h1>
         <p>You won't receive any more email about ${authorLabel}'s new posts.</p>
         <p style="margin-top: 24px;"><a href="https://bublr.life/${authorPath}">Visit ${authorLabel}'s profile</a></p>`
      )
    }
    return res.status(200).json({ success: true, message: 'Successfully unsubscribed' })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    return wantsHtml
      ? page(res, 500, 'Error', `<h1>Something went wrong</h1><p>We couldn't process your request. Please try again later.</p>`)
      : res.status(500).json({ error: 'Failed to unsubscribe' })
  }
}

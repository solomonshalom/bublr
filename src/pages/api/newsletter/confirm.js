import { firestore } from '../../../lib/firebase'
import { escapeHtml } from '../../../lib/escape'
import { verifyConfirm } from '../../../lib/unsubscribe-token'
import { isPending, subscriberEmail } from '../../../lib/subscribers'
import { notifyNewSubscriber } from '../../../lib/subscriber-notify'

// Second half of newsletter sign-up. The link in the confirmation email only
// shows a button on GET (mail scanners that pre-open links must not confirm
// anyone); pressing it POSTs here. Every request needs the signed token.

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
    `<h1>Invalid Confirmation Link</h1>
     <p>This link appears to be invalid or incomplete. Try subscribing again from the writer's page.</p>
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

  if (!email || !author || !verifyConfirm(email, author, token)) return invalid(res)

  try {
    const usersSnapshot = await firestore.collection('users').where('name', '==', author).limit(1).get()
    if (usersSnapshot.empty) {
      return page(res, 404, 'Confirm', `<h1>Writer Not Found</h1><p><a href="https://bublr.life">Return to Bublr</a></p>`)
    }

    const authorDoc = usersSnapshot.docs[0]
    const authorData = authorDoc.data()
    const authorLabel = escapeHtml(authorData.displayName || author)
    const authorPath = encodeURIComponent(author)
    const normalizedEmail = email.trim().toLowerCase()
    const subscribers = authorData.subscribers || []
    const existing = subscribers.find(sub => subscriberEmail(sub) === normalizedEmail)

    if (isGet) {
      const body = existing && !isPending(existing)
        ? `<h1>You're already subscribed</h1>
           <p>You'll get an email when ${authorLabel} publishes a new post.</p>`
        : `<h1>Confirm your subscription</h1>
           <p>Get an email when ${authorLabel} publishes a new post?</p>
           <form method="POST" action="/api/newsletter/confirm">
             <input type="hidden" name="email" value="${escapeHtml(email)}">
             <input type="hidden" name="author" value="${escapeHtml(author)}">
             <input type="hidden" name="token" value="${escapeHtml(token)}">
             <button type="submit">Confirm subscription</button>
           </form>`
      return page(res, 200, 'Confirm subscription', body)
    }

    if (existing && isPending(existing)) {
      const { pending, lastRequestedAt, ...rest } = existing
      await firestore.collection('users').doc(authorDoc.id).update({
        subscribers: subscribers.map(sub => (sub === existing ? { ...rest, confirmedAt: new Date().toISOString() } : sub)),
      })
      await notifyNewSubscriber(
        authorDoc.id,
        normalizedEmail,
        subscribers.filter(sub => !isPending(sub)).length + 1
      )
    } else if (!existing) {
      // Removed (by the writer or by unsubscribing) since asking for the email:
      // don't quietly add them back.
      return page(
        res,
        410,
        'Link expired',
        `<h1>This link has expired</h1>
         <p>You're no longer on the list. To subscribe, use the form on <a href="https://bublr.life/${authorPath}">${authorLabel}'s profile</a>.</p>`
      )
    }

    return page(
      res,
      200,
      'Subscribed',
      `<h1>You're subscribed</h1>
       <p>You'll get an email when ${authorLabel} publishes a new post. Every email has an unsubscribe link.</p>
       <p style="margin-top: 24px;"><a href="https://bublr.life/${authorPath}">Visit ${authorLabel}'s profile</a></p>`
    )
  } catch (error) {
    console.error('Confirm error:', error)
    return page(res, 500, 'Error', `<h1>Something went wrong</h1><p>We couldn't process your request. Please try again later.</p>`)
  }
}

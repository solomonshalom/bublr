import { firestore } from '../../../lib/firebase'

export default async function handler(req, res) {
  // Support both GET (from email link) and POST
  const { email, author } = req.method === 'GET' ? req.query : req.body

  if (!email) {
    // If accessed via browser without params, show a simple unsubscribe page
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html')
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Unsubscribe - Bublr</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Inter, -apple-system, sans-serif; padding: 40px 20px; max-width: 400px; margin: 0 auto; text-align: center; }
            h1 { font-size: 1.25rem; font-weight: 500; }
            p { color: #6f6f6f; font-size: 0.9rem; }
          </style>
        </head>
        <body>
          <h1>Invalid Unsubscribe Link</h1>
          <p>This link appears to be invalid or expired. Please use the unsubscribe link from a recent newsletter email.</p>
          <p><a href="https://bublr.life">Return to Bublr</a></p>
        </body>
        </html>
      `)
    }
    return res.status(400).json({ error: 'Email is required' })
  }

  if (!author) {
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html')
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Unsubscribe - Bublr</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Inter, -apple-system, sans-serif; padding: 40px 20px; max-width: 400px; margin: 0 auto; text-align: center; }
            h1 { font-size: 1.25rem; font-weight: 500; }
            p { color: #6f6f6f; font-size: 0.9rem; }
          </style>
        </head>
        <body>
          <h1>Invalid Unsubscribe Link</h1>
          <p>This link appears to be invalid or expired. Please use the unsubscribe link from a recent newsletter email.</p>
          <p><a href="https://bublr.life">Return to Bublr</a></p>
        </body>
        </html>
      `)
    }
    return res.status(400).json({ error: 'Author username is required' })
  }

  try {
    // Find the author by username
    const usersSnapshot = await firestore
      .collection('users')
      .where('name', '==', author)
      .limit(1)
      .get()

    if (usersSnapshot.empty) {
      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'text/html')
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Unsubscribe - Bublr</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Inter, -apple-system, sans-serif; padding: 40px 20px; max-width: 400px; margin: 0 auto; text-align: center; }
              h1 { font-size: 1.25rem; font-weight: 500; }
              p { color: #6f6f6f; font-size: 0.9rem; }
            </style>
          </head>
          <body>
            <h1>Author Not Found</h1>
            <p>The author you're trying to unsubscribe from couldn't be found.</p>
            <p><a href="https://bublr.life">Return to Bublr</a></p>
          </body>
          </html>
        `)
      }
      return res.status(404).json({ error: 'Author not found' })
    }

    const authorDoc = usersSnapshot.docs[0]
    const authorData = authorDoc.data()

    // Get current subscribers and filter out the email
    const subscribers = authorData.subscribers || []
    const normalizedEmail = email.toLowerCase()

    const updatedSubscribers = subscribers.filter(
      (sub) => (typeof sub === 'string' ? sub : sub.email) !== normalizedEmail
    )

    // Update the document
    await firestore.collection('users').doc(authorDoc.id).update({
      subscribers: updatedSubscribers,
    })

    // For GET requests (email links), show a nice confirmation page
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html')
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Unsubscribed - Bublr</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Inter, -apple-system, sans-serif; padding: 40px 20px; max-width: 400px; margin: 0 auto; text-align: center; background: #fafafa; }
            .card { background: white; border-radius: 8px; padding: 32px; }
            h1 { font-size: 1.25rem; font-weight: 500; margin-bottom: 8px; }
            p { color: #6f6f6f; font-size: 0.9rem; line-height: 1.5; }
            .check { width: 48px; height: 48px; background: #6BCB77; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
            .check svg { color: white; }
            a { color: #2e2e2e; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="check">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h1>Successfully Unsubscribed</h1>
            <p>You've been unsubscribed from ${authorData.displayName || author}'s newsletter. You won't receive any more email notifications about their new posts.</p>
            <p style="margin-top: 24px;"><a href="https://bublr.life/${author}">Visit ${authorData.displayName || author}'s profile</a></p>
          </div>
        </body>
        </html>
      `)
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully unsubscribed'
    })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html')
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error - Bublr</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Inter, -apple-system, sans-serif; padding: 40px 20px; max-width: 400px; margin: 0 auto; text-align: center; }
            h1 { font-size: 1.25rem; font-weight: 500; }
            p { color: #6f6f6f; font-size: 0.9rem; }
          </style>
        </head>
        <body>
          <h1>Something went wrong</h1>
          <p>We couldn't process your unsubscribe request. Please try again later.</p>
          <p><a href="https://bublr.life">Return to Bublr</a></p>
        </body>
        </html>
      `)
    }
    return res.status(500).json({ error: 'Failed to unsubscribe' })
  }
}

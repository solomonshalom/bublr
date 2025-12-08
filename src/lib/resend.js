import { Resend } from 'resend'

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY)

// From email address (must be verified in Resend)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Bublr <notifications@stuff.bublr.life>'

/**
 * Generate the HTML email template for new post notifications
 */
function generateNewPostEmailHTML({ authorName, authorPhoto, postTitle, postExcerpt, postContent, postUrl, postColor, unsubscribeUrl }) {
  // Clean HTML content for email (basic sanitization)
  const cleanExcerpt = postExcerpt
    ? postExcerpt.replace(/<[^>]*>/g, '').substring(0, 300)
    : ''

  const cleanContent = postContent
    ? postContent.replace(/<[^>]*>/g, '').substring(0, 500)
    : ''

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New post from ${authorName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #2e2e2e; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Color bar -->
          <tr>
            <td style="height: 4px; background-color: ${postColor || '#4D96FF'};"></td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <!-- Author info -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="width: 40px; vertical-align: middle;">
                    <img src="${authorPhoto}" alt="${authorName}" width="40" height="40" style="border-radius: 50%; display: block;">
                  </td>
                  <td style="padding-left: 12px; vertical-align: middle;">
                    <span style="font-weight: 500; color: #2e2e2e;">${authorName}</span>
                    <span style="color: #6f6f6f;"> published a new post</span>
                  </td>
                </tr>
              </table>

              <!-- Post title -->
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 500; color: #2e2e2e; line-height: 1.3;">
                <a href="${postUrl}" style="color: inherit; text-decoration: none;">${postTitle}</a>
              </h1>

              <!-- Excerpt/Preview -->
              ${cleanExcerpt ? `
              <p style="margin: 0 0 20px 0; color: #6f6f6f; font-size: 14px; line-height: 1.6;">
                ${cleanExcerpt}${cleanExcerpt.length >= 300 ? '...' : ''}
              </p>
              ` : ''}

              <!-- Content preview -->
              <div style="padding: 16px; background-color: #fafafa; border-radius: 6px; border-left: 3px solid ${postColor || '#4D96FF'}; margin-bottom: 24px;">
                <p style="margin: 0; color: #4a4a4a; font-size: 14px; line-height: 1.7;">
                  ${cleanContent}${cleanContent.length >= 500 ? '...' : ''}
                </p>
              </div>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="background-color: #2e2e2e; border-radius: 6px;">
                    <a href="${postUrl}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 500; font-size: 14px;">
                      Read Full Post
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e5e5e5; padding-top: 24px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #9a9a9a;">
                      You're receiving this because you subscribed to ${authorName}'s newsletter on Bublr.
                    </p>
                    <p style="margin: 0; font-size: 12px;">
                      <a href="${unsubscribeUrl}" style="color: #6f6f6f; text-decoration: underline;">Unsubscribe</a>
                      <span style="color: #c7c7c7; margin: 0 8px;">|</span>
                      <a href="https://bublr.life" style="color: #6f6f6f; text-decoration: underline;">Visit Bublr</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

/**
 * Generate plain text version of the email
 */
function generateNewPostEmailText({ authorName, postTitle, postExcerpt, postContent, postUrl, unsubscribeUrl }) {
  const cleanExcerpt = postExcerpt
    ? postExcerpt.replace(/<[^>]*>/g, '').substring(0, 300)
    : ''

  const cleanContent = postContent
    ? postContent.replace(/<[^>]*>/g, '').substring(0, 500)
    : ''

  return `
${authorName} published a new post

${postTitle}

${cleanExcerpt || cleanContent}

Read the full post: ${postUrl}

---
You're receiving this because you subscribed to ${authorName}'s newsletter on Bublr.
Unsubscribe: ${unsubscribeUrl}
`
}

/**
 * Send a new post notification email to a subscriber
 */
export async function sendNewPostNotification({
  subscriberEmail,
  authorName,
  authorPhoto,
  authorUsername,
  postTitle,
  postExcerpt,
  postContent,
  postSlug,
  postColor,
}) {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured')
    return { success: false, error: 'Email service not configured' }
  }

  const postUrl = `https://bublr.life/${authorUsername}/${postSlug}`
  const unsubscribeUrl = `https://bublr.life/api/newsletter/unsubscribe?email=${encodeURIComponent(subscriberEmail)}&author=${encodeURIComponent(authorUsername)}`

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: subscriberEmail,
      subject: `New post from ${authorName}: ${postTitle}`,
      html: generateNewPostEmailHTML({
        authorName,
        authorPhoto,
        postTitle,
        postExcerpt,
        postContent,
        postUrl,
        postColor,
        unsubscribeUrl,
      }),
      text: generateNewPostEmailText({
        authorName,
        postTitle,
        postExcerpt,
        postContent,
        postUrl,
        unsubscribeUrl,
      }),
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (err) {
    console.error('Email send error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Send batch notifications to all subscribers
 * Resend allows up to 100 emails per batch
 */
export async function sendBatchNotifications({
  subscribers,
  authorName,
  authorPhoto,
  authorUsername,
  postTitle,
  postExcerpt,
  postContent,
  postSlug,
  postColor,
}) {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured')
    return { success: false, error: 'Email service not configured', sent: 0 }
  }

  if (!subscribers || subscribers.length === 0) {
    return { success: true, sent: 0 }
  }

  const postUrl = `https://bublr.life/${authorUsername}/${postSlug}`

  // Send emails in batches of 50 (to stay well under limits)
  const batchSize = 50
  let totalSent = 0
  let errors = []

  for (let i = 0; i < subscribers.length; i += batchSize) {
    const batch = subscribers.slice(i, i + batchSize)

    // Send each email in the batch
    const promises = batch.map(async (subscriber) => {
      const email = typeof subscriber === 'string' ? subscriber : subscriber.email
      const unsubscribeUrl = `https://bublr.life/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&author=${encodeURIComponent(authorUsername)}`

      try {
        const { error } = await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: `New post from ${authorName}: ${postTitle}`,
          html: generateNewPostEmailHTML({
            authorName,
            authorPhoto,
            postTitle,
            postExcerpt,
            postContent,
            postUrl,
            postColor,
            unsubscribeUrl,
          }),
          text: generateNewPostEmailText({
            authorName,
            postTitle,
            postExcerpt,
            postContent,
            postUrl,
            unsubscribeUrl,
          }),
        })

        if (error) {
          errors.push({ email, error: error.message })
          return false
        }
        return true
      } catch (err) {
        errors.push({ email, error: err.message })
        return false
      }
    })

    const results = await Promise.all(promises)
    totalSent += results.filter(Boolean).length

    // Small delay between batches to avoid rate limits
    if (i + batchSize < subscribers.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return {
    success: errors.length === 0,
    sent: totalSent,
    total: subscribers.length,
    errors: errors.length > 0 ? errors : undefined,
  }
}

export default resend

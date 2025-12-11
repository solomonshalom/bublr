import { Resend } from 'resend'

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY)

// From email address (must be verified in Resend)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Bublr <notifications@stuff.bublr.life>'

/**
 * Available placeholder tags for custom templates:
 * {{title}} - Post title (plain text)
 * {{excerpt}} - Post excerpt (plain text, max 300 chars)
 * {{content}} - Post content preview (plain text, max 500 chars)
 * {{authorName}} - Author's display name
 * {{authorPhoto}} - Author's profile photo URL
 * {{postUrl}} - Full URL to the post
 * {{postColor}} - Post's custom color (or default #4D96FF)
 * {{unsubscribeUrl}} - REQUIRED: Unsubscribe link for email compliance
 */

/**
 * Replace placeholders in a custom email template
 */
function replaceTemplatePlaceholders(template, data) {
  const {
    authorName,
    authorPhoto,
    postTitle,
    postExcerpt,
    postContent,
    postUrl,
    postColor,
    unsubscribeUrl,
  } = data

  // Clean HTML content for email (basic sanitization)
  const cleanTitle = postTitle
    ? postTitle.replace(/<[^>]*>/g, '')
    : 'New Post'

  const cleanExcerpt = postExcerpt
    ? postExcerpt.replace(/<[^>]*>/g, '').substring(0, 300)
    : ''

  const cleanContent = postContent
    ? postContent.replace(/<[^>]*>/g, '').substring(0, 500)
    : ''

  // Replace all placeholders (case-insensitive matching for flexibility)
  let result = template
    .replace(/\{\{title\}\}/gi, cleanTitle)
    .replace(/\{\{excerpt\}\}/gi, cleanExcerpt)
    .replace(/\{\{content\}\}/gi, cleanContent)
    .replace(/\{\{authorName\}\}/gi, authorName || '')
    .replace(/\{\{authorPhoto\}\}/gi, authorPhoto || '')
    .replace(/\{\{postUrl\}\}/gi, postUrl || '')
    .replace(/\{\{postColor\}\}/gi, postColor || '#4D96FF')
    .replace(/\{\{unsubscribeUrl\}\}/gi, unsubscribeUrl || '')
    // Also support snake_case versions for flexibility
    .replace(/\{\{post_url\}\}/gi, postUrl || '')
    .replace(/\{\{post_color\}\}/gi, postColor || '#4D96FF')
    .replace(/\{\{unsubscribe_url\}\}/gi, unsubscribeUrl || '')
    .replace(/\{\{author_name\}\}/gi, authorName || '')
    .replace(/\{\{author_photo\}\}/gi, authorPhoto || '')

  return result
}

/**
 * Generate plain text version from custom HTML template
 */
function generatePlainTextFromCustomTemplate(data) {
  const {
    authorName,
    postTitle,
    postExcerpt,
    postContent,
    postUrl,
    unsubscribeUrl,
  } = data

  const cleanTitle = postTitle
    ? postTitle.replace(/<[^>]*>/g, '')
    : 'New Post'

  const cleanExcerpt = postExcerpt
    ? postExcerpt.replace(/<[^>]*>/g, '').substring(0, 300)
    : ''

  const cleanContent = postContent
    ? postContent.replace(/<[^>]*>/g, '').substring(0, 500)
    : ''

  return `
${authorName} published a new post

${cleanTitle}

${cleanExcerpt || cleanContent}

Read the full post: ${postUrl}

---
You're receiving this because you subscribed to ${authorName}'s newsletter on Bublr.
Unsubscribe: ${unsubscribeUrl}
`
}

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
              <p style="margin: 0 0 24px 0; color: #6f6f6f; font-size: 14px; line-height: 1.7;">
                ${cleanContent}${cleanContent.length >= 500 ? '...' : ''}
              </p>

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
 * @param {Object} options - Email options
 * @param {string} options.subscriberEmail - Subscriber's email address
 * @param {string} options.authorName - Author's display name
 * @param {string} options.authorPhoto - Author's profile photo URL
 * @param {string} options.authorUsername - Author's username
 * @param {string} options.postTitle - Post title
 * @param {string} options.postExcerpt - Post excerpt
 * @param {string} options.postContent - Post content
 * @param {string} options.postSlug - Post URL slug
 * @param {string} options.postColor - Post's custom color
 * @param {string} [options.customTemplate] - Optional custom HTML template
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
  customTemplate,
}) {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured')
    return { success: false, error: 'Email service not configured' }
  }

  const postUrl = `https://bublr.life/${authorUsername}/${postSlug}`
  const unsubscribeUrl = `https://bublr.life/api/newsletter/unsubscribe?email=${encodeURIComponent(subscriberEmail)}&author=${encodeURIComponent(authorUsername)}`

  const templateData = {
    authorName,
    authorPhoto,
    postTitle,
    postExcerpt,
    postContent,
    postUrl,
    postColor,
    unsubscribeUrl,
  }

  // Use custom template if provided, otherwise use default
  let htmlContent
  if (customTemplate) {
    htmlContent = replaceTemplatePlaceholders(customTemplate, templateData)
  } else {
    htmlContent = generateNewPostEmailHTML(templateData)
  }

  // Generate plain text (always use standard format for accessibility)
  const textContent = customTemplate
    ? generatePlainTextFromCustomTemplate(templateData)
    : generateNewPostEmailText(templateData)

  // Clean post title for subject line
  const cleanTitle = postTitle ? postTitle.replace(/<[^>]*>/g, '') : 'New Post'

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: subscriberEmail,
      subject: `New post from ${authorName}: ${cleanTitle}`,
      html: htmlContent,
      text: textContent,
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
 * @param {Object} options - Batch notification options
 * @param {Array} options.subscribers - Array of subscriber objects or email strings
 * @param {string} options.authorName - Author's display name
 * @param {string} options.authorPhoto - Author's profile photo URL
 * @param {string} options.authorUsername - Author's username
 * @param {string} options.postTitle - Post title
 * @param {string} options.postExcerpt - Post excerpt
 * @param {string} options.postContent - Post content
 * @param {string} options.postSlug - Post URL slug
 * @param {string} options.postColor - Post's custom color
 * @param {string} [options.customTemplate] - Optional custom HTML template
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
  customTemplate,
}) {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured')
    return { success: false, error: 'Email service not configured', sent: 0 }
  }

  if (!subscribers || subscribers.length === 0) {
    return { success: true, sent: 0 }
  }

  const postUrl = `https://bublr.life/${authorUsername}/${postSlug}`

  // Clean post title for subject line
  const cleanTitle = postTitle ? postTitle.replace(/<[^>]*>/g, '') : 'New Post'

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

      const templateData = {
        authorName,
        authorPhoto,
        postTitle,
        postExcerpt,
        postContent,
        postUrl,
        postColor,
        unsubscribeUrl,
      }

      // Use custom template if provided, otherwise use default
      let htmlContent
      if (customTemplate) {
        htmlContent = replaceTemplatePlaceholders(customTemplate, templateData)
      } else {
        htmlContent = generateNewPostEmailHTML(templateData)
      }

      // Generate plain text (always use standard format for accessibility)
      const textContent = customTemplate
        ? generatePlainTextFromCustomTemplate(templateData)
        : generateNewPostEmailText(templateData)

      try {
        const { error } = await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: `New post from ${authorName}: ${cleanTitle}`,
          html: htmlContent,
          text: textContent,
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

/**
 * Send subscription status email (activated, canceled, expired)
 * @param {Object} options - Email options
 * @param {string} options.userEmail - User's email address
 * @param {string} [options.userName] - User's display name
 * @param {string} options.type - Email type: 'activated', 'canceled', or 'expired'
 * @param {string} [options.periodEndDate] - End date for grace period (ISO string)
 */
export async function sendSubscriptionEmail({ userEmail, userName, type, periodEndDate }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured')
    return { success: false, error: 'Email service not configured' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life'
  const logoUrl = `${baseUrl}/images/logo.png`

  let subject, heading, message, ctaText, ctaUrl

  switch (type) {
    case 'activated':
      subject = 'Welcome to Bublr Pro!'
      heading = 'Your subscription is active'
      message = 'Thank you for subscribing! You now have access to custom domains, custom branding, and custom newsletter templates.'
      ctaText = 'Set Up Your Domain'
      ctaUrl = `${baseUrl}/dashboard`
      break

    case 'canceled':
      subject = 'Your Bublr Pro subscription has been canceled'
      heading = 'Subscription canceled'
      message = periodEndDate
        ? `Your subscription has been canceled. You'll continue to have access to Pro features until ${new Date(periodEndDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
        : 'Your subscription has been canceled. Your Pro features have been deactivated.'
      ctaText = 'Resubscribe'
      ctaUrl = `${baseUrl}/dashboard`
      break

    case 'expired':
      subject = 'Your Bublr Pro access has ended'
      heading = 'Pro access expired'
      message = 'Your subscription period has ended. Your custom domain and branding features have been deactivated, but all your settings are saved and will be restored if you resubscribe.'
      ctaText = 'Resubscribe'
      ctaUrl = `${baseUrl}/dashboard`
      break

    default:
      return { success: false, error: 'Invalid email type' }
  }

  const html = generateSubscriptionEmailHTML({
    logoUrl,
    heading,
    userName,
    message,
    ctaText,
    ctaUrl,
    baseUrl,
  })

  const text = generateSubscriptionEmailText({
    heading,
    userName,
    message,
    ctaUrl,
  })

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject,
      html,
      text,
    })

    if (error) {
      console.error('Subscription email error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (err) {
    console.error('Subscription email send error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Generate HTML email template for subscription status emails
 */
function generateSubscriptionEmailHTML({ logoUrl, heading, userName, message, ctaText, ctaUrl, baseUrl }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #2e2e2e; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Logo -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center;">
              <img src="${logoUrl}" alt="Bublr" height="48" style="height: 48px;">
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 500; color: #2e2e2e; text-align: center;">
                ${heading}
              </h1>

              <p style="margin: 0 0 8px 0; color: #6f6f6f; text-align: center;">
                Hi${userName ? ` ${userName}` : ''},
              </p>

              <p style="margin: 0 0 24px 0; color: #6f6f6f; text-align: center;">
                ${message}
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2e2e2e; color: #ffffff; text-decoration: none; font-weight: 500; font-size: 14px; border-radius: 6px;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; font-size: 12px; color: #9a9a9a; text-align: center;">
                <a href="${baseUrl}" style="color: #6f6f6f; text-decoration: underline;">Bublr</a>
                <span style="color: #c7c7c7; margin: 0 8px;">·</span>
                A minimal writing platform
              </p>
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
 * Generate plain text email for subscription status emails
 */
function generateSubscriptionEmailText({ heading, userName, message, ctaUrl }) {
  return `
${heading}

Hi${userName ? ` ${userName}` : ''},

${message}

${ctaUrl}

---
Bublr - A minimal writing platform
https://bublr.life
`
}

export default resend

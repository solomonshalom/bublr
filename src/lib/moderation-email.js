/**
 * The email a writer gets when moderation removes their posts or suspends
 * their account. Kept free of imports so the same builder serves the API
 * routes (through sendModerationEmail in ./resend) and one-off admin runs.
 */

const MAX_TITLES_SHOWN = 5

const POLICY =
  'Bublr is a place for writing that people want to read. We remove posts that exist mainly to advertise, build backlinks or game search rankings, and we remove scams, phishing and adult content.'
const APPEAL = 'If you think we got this wrong, reply to this email with the post title and tell us why. We read every reply.'

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
}

function plainTitle(title) {
  const text = String(title || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  return text || 'Untitled'
}

/**
 * @param {object} options
 * @param {string} [options.userName] - writer's display name
 * @param {string[]} options.postTitles - titles of the removed posts (HTML is stripped)
 * @param {string} options.reason - why, in a sentence or two
 * @param {boolean} [options.suspended] - the account can no longer publish
 * @param {boolean} [options.unpublished] - the posts were taken down but kept as drafts
 * @param {string} [options.baseUrl]
 * @returns {{ subject: string, html: string, text: string }}
 */
export function buildModerationEmail({
  userName,
  postTitles = [],
  reason,
  suspended = false,
  unpublished = false,
  baseUrl = 'https://bublr.life',
}) {
  const titles = postTitles.map(plainTitle)
  const n = titles.length
  const shown = titles.slice(0, MAX_TITLES_SHOWN)
  const more = n - shown.length

  const subject = suspended
    ? 'Your Bublr account has been suspended'
    : n === 1
      ? 'We removed your post from Bublr'
      : `We removed ${n} of your posts from Bublr`
  const heading = suspended
    ? 'Your account has been suspended'
    : n === 1
      ? 'Your post was removed'
      : 'Your posts were removed'
  const intro =
    n === 1
      ? 'We removed this post from Bublr because it broke our content rules:'
      : `We removed ${n} posts from Bublr because they broke our content rules:`
  const draftNote = unpublished
    ? n === 1
      ? 'It is no longer public. You can still find it in your dashboard as a draft.'
      : 'They are no longer public. You can still find them in your dashboard as drafts.'
    : ''
  const outcome = suspended
    ? 'Every post on your account was removed for this reason, so your account can no longer publish.'
    : 'Your account is still active and you are welcome to keep writing. Posts like these will be removed again.'
  const reasonText = reason || 'Content policy violation.'

  const p = 'margin: 0 0 16px 0; color: #6f6f6f;'
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #2e2e2e; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center;">
              <img src="${baseUrl}/images/logo.png" alt="Bublr" height="48" style="height: 48px;">
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 500; color: #2e2e2e; text-align: center;">${escapeHtml(heading)}</h1>
              <p style="${p}">Hi${userName ? ` ${escapeHtml(userName)}` : ''},</p>
              <p style="${p}">${escapeHtml(intro)}</p>
              <ul style="margin: 0 0 16px 0; padding-left: 20px; color: #2e2e2e;">
                ${shown.map(t => `<li style="margin-bottom: 4px;">${escapeHtml(t)}</li>`).join('\n                ')}
                ${more > 0 ? `<li style="margin-bottom: 4px; margin-left: -20px; list-style: none; color: #9a9a9a;">and ${more} more</li>` : ''}
              </ul>
              ${draftNote ? `<p style="${p}">${escapeHtml(draftNote)}</p>` : ''}
              <p style="margin: 0 0 4px 0; color: #2e2e2e; font-weight: 500;">Why</p>
              <p style="${p}">${escapeHtml(reasonText)}</p>
              <p style="${p}">${escapeHtml(POLICY)}</p>
              <p style="${p}">${escapeHtml(outcome)}</p>
              <p style="margin: 0; color: #6f6f6f;">${escapeHtml(APPEAL)}</p>
            </td>
          </tr>
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

  const text = `${heading}

Hi${userName ? ` ${userName}` : ''},

${intro}
${shown.map(t => `- ${t}`).join('\n')}${more > 0 ? `\n...and ${more} more` : ''}
${draftNote ? `\n${draftNote}\n` : ''}
Why: ${reasonText}

${POLICY}

${outcome}

${APPEAL}

---
Bublr - A minimal writing platform
${baseUrl}
`

  return { subject, html, text }
}

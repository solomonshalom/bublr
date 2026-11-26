// Stand-in for src/lib/resend.js: records what would have been emailed.
export const sent = []

export function resetSent() {
  sent.length = 0
}

export async function sendBatchNotifications(params) {
  // Run the per-reader personalisation like the real sender, so tests can see
  // what each reader would get.
  const personalized = (params.subscribers || []).map(sub => ({
    email: typeof sub === 'string' ? sub : sub.email,
    ...(params.personalize ? params.personalize(sub) || {} : {}),
  }))
  sent.push({ kind: 'batch', ...params, personalized })
  const total = (params.subscribers || []).length
  return { success: true, sent: total, total }
}

export async function sendNewPostNotification(params) {
  sent.push({ kind: 'single', ...params })
  return { success: true }
}

export async function sendSubscriptionEmail(params) {
  sent.push({ kind: 'subscription', ...params })
  return { success: true }
}

export async function sendShopOrderEmail(params) {
  sent.push({ kind: 'shop-order', ...params })
  return { success: true }
}

export async function sendConfirmationEmail(params) {
  sent.push({ kind: 'confirm', ...params })
  return { success: true }
}

export async function sendReaderLoginEmail(params) {
  sent.push({ kind: 'reader-login', ...params })
  return { success: true }
}

export async function sendPaidWelcomeEmail(params) {
  sent.push({ kind: 'paid-welcome', ...params })
  return { success: true }
}

export async function sendNewPaidSubscriberEmail(params) {
  sent.push({ kind: 'paid-new-subscriber', ...params })
  return { success: true }
}

export async function sendPaidCancelFailedEmail(params) {
  sent.push({ kind: 'paid-cancel-failed', ...params })
  return { success: true }
}

export async function sendDuplicatePaymentEmail(params) {
  sent.push({ kind: 'paid-duplicate', ...params })
  return { success: true }
}

export default { emails: { send: async () => ({}) }, batch: { send: async () => ({}) } }

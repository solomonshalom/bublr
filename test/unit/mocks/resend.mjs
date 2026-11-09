// Stand-in for src/lib/resend.js: records what would have been emailed.
export const sent = []

export function resetSent() {
  sent.length = 0
}

export async function sendBatchNotifications(params) {
  sent.push({ kind: 'batch', ...params })
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

export async function sendConfirmationEmail(params) {
  sent.push({ kind: 'confirm', ...params })
  return { success: true }
}

export default { emails: { send: async () => ({}) }, batch: { send: async () => ({}) } }

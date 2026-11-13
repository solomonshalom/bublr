// Stand-in for the @polar-sh/sdk package (and @polar-sh/sdk/webhooks): records
// the checkouts that would have been created and "verifies" webhooks with a
// fixed signature, so the billing routes run offline.
export const checkouts = []
export const portalSessions = []

export function resetPolar() {
  checkouts.length = 0
  portalSessions.length = 0
}

export class Polar {
  constructor(options) {
    this.options = options
    this.checkouts = {
      create: async params => {
        checkouts.push(params)
        return { id: `co_${checkouts.length}`, url: `https://polar.test/checkout/co_${checkouts.length}` }
      },
    }
    this.customerSessions = {
      create: async params => {
        portalSessions.push(params)
        return { customerPortalUrl: `https://polar.test/portal/${params.customerId}` }
      },
    }
  }
}

// ---- @polar-sh/sdk/webhooks ----
export const VALID_SIGNATURE = 'test-valid-signature'

export class WebhookVerificationError extends Error {}

const DATE_FIELDS = ['currentPeriodStart', 'currentPeriodEnd']

// Like the real SDK, hands back the event with its dates as Date objects.
export function validateEvent(body, headers, secret) {
  if (!secret || headers['webhook-signature'] !== VALID_SIGNATURE) {
    throw new WebhookVerificationError('Invalid signature')
  }
  const event = JSON.parse(body)
  for (const field of DATE_FIELDS) {
    if (typeof event.data?.[field] === 'string') event.data[field] = new Date(event.data[field])
  }
  return event
}

import { Polar } from '@polar-sh/sdk'

import { PLAN_INTERVALS } from './plans'

// Initialize Polar client
const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
})

export default polar

// A Polar product bills on one cycle, so the custom domain add-on is two
// products: $2/month and $18/year. Prices shown in the app live in lib/plans.js.
const PRODUCT_ENV = {
  month: 'POLAR_CUSTOM_DOMAIN_PRODUCT_ID',
  year: 'POLAR_CUSTOM_DOMAIN_YEARLY_PRODUCT_ID',
}

/** Polar product ID for a billing interval, or null when it isn't configured. */
export function customDomainProductId(interval) {
  const name = PRODUCT_ENV[interval]
  return (name && process.env[name]) || null
}

/** The intervals a writer can actually buy on this deployment. */
export function availablePlanIntervals() {
  return PLAN_INTERVALS.filter(interval => customDomainProductId(interval))
}

// Webhook secret for verifying incoming webhooks
export const WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET

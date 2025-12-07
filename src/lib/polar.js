import { Polar } from '@polar-sh/sdk'

// Initialize Polar client
const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
})

export default polar

// Product ID for custom domain subscription ($2/month)
export const CUSTOM_DOMAIN_PRODUCT_ID = process.env.POLAR_CUSTOM_DOMAIN_PRODUCT_ID

// Webhook secret for verifying incoming webhooks
export const WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET

/**
 * The custom domain plans and what they cost, in one place, so the plan
 * picker, the sidebar card and the About page can't drift apart.
 *
 * Safe to import in the browser: there are no secrets here. The charge itself
 * comes from the two Polar products (see lib/polar.js), so these prices are
 * only what we *show*. Keep them equal to the product prices in Polar.
 */

// US dollars
export const PLANS = {
  month: { interval: 'month', label: 'Monthly', price: 2, per: 'month' },
  year: { interval: 'year', label: 'Yearly', price: 18, per: 'year' },
}

export const PLAN_INTERVALS = ['month', 'year']

// What a request without a choice means. The checkout button was monthly-only
// before there was a yearly plan.
export const DEFAULT_INTERVAL = 'month'

export function isPlanInterval(value) {
  return value === 'month' || value === 'year'
}

/** `$2`, `$1.50`: no cents unless there are some. */
export function formatUsd(amount) {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`
}

/** `$2/month`, `$18/year` */
export function planPriceLabel(interval) {
  const plan = PLANS[interval]
  return plan ? `${formatUsd(plan.price)}/${plan.per}` : ''
}

/**
 * What paying yearly saves over twelve monthly payments. Worked out from the
 * prices above, so the "Save 25%" badge can never disagree with them.
 */
export function yearlySavings() {
  const twelveMonths = PLANS.month.price * 12
  const amount = twelveMonths - PLANS.year.price
  return {
    twelveMonths, // 24
    amount, // 6
    percent: Math.round((amount / twelveMonths) * 100), // 25
    perMonth: PLANS.year.price / 12, // 1.5
  }
}

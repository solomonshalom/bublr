// The Pro plan's price and pitch, in one place, so the sidebar card, the
// settings page, the docs and the emails all say the same thing.
//
// The amount actually charged is set on the product in the Dodo Payments
// dashboard (DODO_PAYMENTS_PRODUCT_ID). Keep the two in step.

export const PRO_PLAN = {
  name: 'Bublr Pro',
  priceCents: 499,
  currency: 'USD',
  price: '$4.99',
  interval: 'month',
  priceLabel: '$4.99/month',
  shortPriceLabel: '$4.99/mo',
  features: [
    'Your own domain, like yourname.com or blog.yourname.com',
    'Free HTTPS certificate, set up for you',
    'Your own footer text, or none at all',
    'Your own newsletter email template',
  ],
}

export default PRO_PLAN

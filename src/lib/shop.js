/**
 * The shop on a writer's profile (Pro + Shop plan). Products live in the
 * writer's user document under `shop.products`; they are saved through
 * /api/shop/products, which runs `normalizeProducts` so prices and fields are
 * checked on the server, not trusted from the browser.
 *
 * Payments never pass through Bublr: each writer connects their own Stripe or
 * Creem account (lib/shop-payments.js) and buyers pay them directly.
 *
 * The storefront (grid, product page, checkout sheet) is ported from the
 * "Supply" shop on jeremybosma.nl (github.com/jeremybosma/jeremybosma).
 */

export const MAX_PRODUCTS = 200
export const MAX_IMAGES = 8
export const MAX_OPTIONS = 12

// Stripe charges at least ~$0.50; Creem's floor is similar.
export const MIN_PRICE = 50
export const MAX_PRICE = 1000000 // 10,000.00
export const MAX_SHIPPING = 100000

export const CURRENCIES = {
  usd: { label: 'USD ($)', symbol: '$' },
  eur: { label: 'EUR (€)', symbol: '€' },
  gbp: { label: 'GBP (£)', symbol: '£' },
  cad: { label: 'CAD ($)', symbol: 'CA$' },
  aud: { label: 'AUD ($)', symbol: 'A$' },
  inr: { label: 'INR (₹)', symbol: '₹' },
}

// Creem (a merchant of record) sells digital goods only, in USD and EUR.
export const PROVIDERS = {
  stripe: { name: 'Stripe', currencies: Object.keys(CURRENCIES), physical: true },
  creem: { name: 'Creem', currencies: ['usd', 'eur'], physical: false },
}

export class ShopValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ShopValidationError'
    this.status = 400
  }
}

const ID_RE = /^[a-z0-9]{4,24}$/
const HEX_RE = /^#[0-9a-f]{6}$/i

export function newId(length = 10) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : null
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(length)
    cryptoObj.getRandomValues(bytes)
    for (const b of bytes) out += alphabet[b % alphabet.length]
    return out
  }
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

function cleanText(value, max) {
  if (typeof value !== 'string') return ''
  // No markup in product text: it is rendered as plain text everywhere.
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max)
}

export function isHttpsUrl(value, max = 800) {
  if (typeof value !== 'string' || value.length > max) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch (_) {
    return false
  }
}

function toCents(value, { min, max, label }) {
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new ShopValidationError(`${label} must be a whole number of cents`)
  if (n < min || n > max) throw new ShopValidationError(`${label} is out of range`)
  return n
}

function normalizeOptions(list, kind) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const out = []
  for (const raw of list.slice(0, MAX_OPTIONS)) {
    if (!raw || typeof raw !== 'object') continue
    const title = cleanText(raw.title, kind === 'size' ? 16 : 32)
    if (!title) continue
    let id = typeof raw.id === 'string' && ID_RE.test(raw.id) ? raw.id : newId(8)
    while (seen.has(id)) id = newId(8)
    seen.add(id)
    const option = { id, title, available: raw.available !== false }
    if (kind === 'color') {
      option.hex = HEX_RE.test(raw.hex || '') ? raw.hex.toLowerCase() : '#888888'
      option.image = isHttpsUrl(raw.image) ? raw.image : null
    }
    out.push(option)
  }
  return out
}

/**
 * Check and tidy one product from the editor. Throws ShopValidationError with
 * a message the writer can act on. `previous` (the saved version, if any)
 * keeps fields the browser never sees, like the sealed delivery link.
 */
export function normalizeProduct(raw, { previous = null } = {}) {
  if (!raw || typeof raw !== 'object') throw new ShopValidationError('Invalid product')
  const title = cleanText(raw.title, 80)
  if (!title) throw new ShopValidationError('Every product needs a name')

  const id = typeof raw.id === 'string' && ID_RE.test(raw.id) ? raw.id : newId(10)
  const currency = Object.prototype.hasOwnProperty.call(CURRENCIES, raw.currency) ? raw.currency : 'usd'
  const kind = raw.kind === 'digital' ? 'digital' : 'physical'
  const images = (Array.isArray(raw.images) ? raw.images : []).filter(url => isHttpsUrl(url)).slice(0, MAX_IMAGES)

  const product = {
    id,
    title,
    description: cleanText(raw.description, 2000),
    images,
    price: toCents(raw.price, { min: MIN_PRICE, max: MAX_PRICE, label: `The price of “${title}”` }),
    currency,
    kind,
    shipping: kind === 'physical'
      ? toCents(raw.shipping ?? 0, { min: 0, max: MAX_SHIPPING, label: `Shipping for “${title}”` })
      : 0,
    colors: normalizeOptions(raw.colors, 'color'),
    sizes: normalizeOptions(raw.sizes, 'size'),
    soldOut: raw.soldOut === true,
    active: raw.active !== false,
    createdAt: typeof previous?.createdAt === 'number' ? previous.createdAt : Date.now(),
  }

  // A colour's photo has to be one of the product's photos.
  for (const color of product.colors) {
    if (color.image && !images.includes(color.image)) color.image = null
  }

  if (previous?.deliverySealed && kind === 'digital') product.deliverySealed = previous.deliverySealed
  return product
}

export function normalizeProducts(list, previousList = []) {
  if (!Array.isArray(list)) throw new ShopValidationError('Products must be a list')
  if (list.length > MAX_PRODUCTS) throw new ShopValidationError(`A shop can hold up to ${MAX_PRODUCTS} products`)
  const previousById = new Map((previousList || []).map(p => [p?.id, p]))
  const seen = new Set()
  return list.map(raw => {
    const product = normalizeProduct(raw, { previous: previousById.get(raw?.id) })
    while (seen.has(product.id)) product.id = newId(10)
    seen.add(product.id)
    return product
  })
}

/** What a buyer may see of a product: no sealed delivery link, nothing internal. */
export function toPublicProduct(product) {
  if (!product || typeof product !== 'object') return null
  const { deliverySealed, ...rest } = product
  return { ...rest, hasDelivery: Boolean(deliverySealed) }
}

/** The products a visitor can see, in the writer's order. */
export function publicProducts(shop) {
  const list = Array.isArray(shop?.products) ? shop.products : []
  return list.filter(p => p && p.active !== false && p.title).map(toPublicProduct)
}

export function findProduct(shop, productId) {
  const list = Array.isArray(shop?.products) ? shop.products : []
  return list.find(p => p && p.id === productId) || null
}

/** Whether a colour/size combination can be bought (port of isVariantAvailable). */
export function isVariantAvailable(product, colorId, sizeId) {
  if (!product || product.soldOut) return false
  const colors = product.colors || []
  const sizes = product.sizes || []
  if (colorId) {
    const color = colors.find(c => c.id === colorId)
    if (!color || color.available === false) return false
  }
  if (sizeId) {
    const size = sizes.find(s => s.id === sizeId)
    if (!size || size.available === false) return false
  }
  if (!colorId && colors.length && !colors.some(c => c.available !== false)) return false
  if (!sizeId && sizes.length && !sizes.some(s => s.available !== false)) return false
  return true
}

/** The colour and size a buyer chose, checked against the product. */
export function resolveVariant(product, { colorId = null, sizeId = null } = {}) {
  const colors = product.colors || []
  const sizes = product.sizes || []
  const color = colors.length ? colors.find(c => c.id === colorId) : null
  const size = sizes.length ? sizes.find(s => s.id === sizeId) : null
  if (colors.length && !color) throw new ShopValidationError('Choose a colour')
  if (sizes.length && !size) throw new ShopValidationError('Choose a size')
  if (!isVariantAvailable(product, color?.id || null, size?.id || null)) {
    throw new ShopValidationError('That option is out of stock')
  }
  const title = [color?.title, size?.title].filter(Boolean).join(' / ')
  return { color, size, title }
}

export function orderTotal(product) {
  return product.price + (product.kind === 'physical' ? product.shipping || 0 : 0)
}

export function formatPrice(cents, currency = 'usd', locale) {
  const value = (Number(cents) || 0) / 100
  try {
    return new Intl.NumberFormat(locale || 'en-US', {
      style: 'currency',
      currency: String(currency || 'usd').toUpperCase(),
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch (_) {
    return `${(CURRENCIES[currency]?.symbol || '$')}${value.toFixed(2)}`
  }
}

/** Parse "12.50" from a price input into cents (null if it isn't a price). */
export function parsePriceInput(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : null
  const text = String(value || '').replace(/[^\d.,]/g, '').replace(',', '.')
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

export function centsToInput(cents) {
  if (!Number.isFinite(cents)) return ''
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
}

// Address checks for physical orders (ported from supply-address.ts, simplified:
// Bublr writers ship themselves, so any country can be chosen).
const REGION_REQUIRED = new Set(['US', 'CA', 'AU'])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function regionRequired(country) {
  return REGION_REQUIRED.has(String(country || '').toUpperCase())
}

export function getAddressFieldErrors(address, { physical = true } = {}) {
  const a = address || {}
  const errors = {}
  if (!cleanText(a.first_name, 60)) errors.first_name = 'Enter your first name'
  if (!cleanText(a.last_name, 60)) errors.last_name = 'Enter your last name'
  if (!EMAIL_RE.test(String(a.email || '').trim())) errors.email = 'Enter a valid email'
  if (!physical) return errors
  if (!/^[A-Z]{2}$/.test(String(a.country || ''))) errors.country = 'Choose a country'
  if (!cleanText(a.address1, 120)) errors.address1 = 'Enter your street address'
  if (!cleanText(a.city, 80)) errors.city = 'Enter your city'
  if (!cleanText(a.zip, 20)) errors.zip = 'Enter your postal code'
  if (regionRequired(a.country) && !cleanText(a.region, 60)) errors.region = 'Enter your state or province'
  const phone = String(a.phone || '').replace(/[^\d+]/g, '')
  if (phone && (phone.length < 6 || phone.length > 18)) errors.phone = 'Enter a valid phone number'
  return errors
}

export function getAddressError(address, options) {
  const errors = getAddressFieldErrors(address, options)
  const first = Object.values(errors)[0]
  return first || null
}

/** The buyer details kept for an order (validated, trimmed). */
export function cleanBuyer(address, { physical = true } = {}) {
  const a = address || {}
  const buyer = {
    first_name: cleanText(a.first_name, 60),
    last_name: cleanText(a.last_name, 60),
    email: String(a.email || '').trim().slice(0, 200),
  }
  if (!physical) return buyer
  return {
    ...buyer,
    phone: String(a.phone || '').replace(/[^\d+\s-]/g, '').trim().slice(0, 24),
    country: String(a.country || '').toUpperCase().slice(0, 2),
    region: cleanText(a.region, 60),
    address1: cleanText(a.address1, 120),
    address2: cleanText(a.address2, 120),
    city: cleanText(a.city, 80),
    zip: cleanText(a.zip, 20),
  }
}

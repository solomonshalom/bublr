// Pure helpers behind the gallery, music and shop blocks, and the encryption
// that protects writers' payment keys and Spotify tokens.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

process.env.INTEGRATIONS_SECRET = 'test-integrations-secret-that-is-long-enough-123'

const box = await import('../../src/lib/secret-box.js')
const shop = await import('../../src/lib/shop.js')
const music = await import('../../src/lib/music.js')
const gallery = await import('../../src/lib/gallery.js')
const { withBlockSections } = await import('../../src/lib/profile-sections.js')
const { toPublicUser } = await import('../../src/lib/public-user.js')
const { signShopGrant, signCatalogue } = await import('../../src/lib/shop-trust.js')
const { isReservedUsername } = await import('../../src/lib/reserved-usernames.js')

// Fake keys are joined at runtime so secret scanners don't mistake them for real ones.
const fakeKey = (...parts) => parts.join('_')

beforeEach(() => {
  process.env.INTEGRATIONS_SECRET = 'test-integrations-secret-that-is-long-enough-123'
})

// ---------------------------------------------------------------- secret box

test('secret box: a sealed value opens only with the same context', () => {
  const sealed = box.seal(fakeKey('sk', 'live', 'supersecret'), 'alice:payments')
  assert.ok(!sealed.includes('supersecret'))
  assert.equal(box.open(sealed, 'alice:payments'), fakeKey('sk', 'live', 'supersecret'))
  assert.equal(box.open(sealed, 'mallory:payments'), null)
  assert.equal(box.open(sealed, 'alice:spotify-secret'), null)
})

test('secret box: tampered, foreign or empty values do not open', () => {
  const sealed = box.seal('hello', 'ctx')
  const parts = sealed.split('.')
  const flipped = Buffer.from(parts[3], 'base64url')
  flipped[0] ^= 1
  parts[3] = flipped.toString('base64url')
  assert.equal(box.open(parts.join('.'), 'ctx'), null)
  assert.equal(box.open('v1.bad', 'ctx'), null)
  assert.equal(box.open(null, 'ctx'), null)
  assert.equal(box.open('', 'ctx'), null)
})

test('secret box: another server secret cannot open old values', () => {
  const sealed = box.seal('hello', 'ctx')
  process.env.INTEGRATIONS_SECRET = 'a-completely-different-secret-value-456789'
  assert.equal(box.open(sealed, 'ctx'), null)
})

test('secret box: without INTEGRATIONS_SECRET nothing is sealed', () => {
  delete process.env.INTEGRATIONS_SECRET
  assert.equal(box.canSeal(), false)
  assert.throws(() => box.seal('x', 'ctx'), /INTEGRATIONS_SECRET/)
  process.env.INTEGRATIONS_SECRET = 'short'
  assert.equal(box.canSeal(), false)
})

test('secret box: OAuth state is signed, expires and cannot be edited', () => {
  const now = Date.now()
  const state = box.signState({ uid: 'alice' }, { now })
  assert.equal(box.verifyState(state, { now: now + 1000 }).uid, 'alice')
  assert.equal(box.verifyState(state, { now: now + 16 * 60 * 1000 }), null)
  const [body, mac] = state.split('.')
  const forged = Buffer.from(JSON.stringify({ uid: 'mallory', iat: now })).toString('base64url')
  assert.equal(box.verifyState(`${forged}.${mac}`, { now }), null)
  assert.equal(box.verifyState(`${body}.x`, { now }), null)
})

test('secret box: key hints never show the key', () => {
  assert.equal(box.keyHint(fakeKey('rk', 'live', '51AbCdEfGhIjKlMnOp1234')), 'rk_live_…1234')
  assert.equal(box.keyHint(fakeKey('creem', 'test', '0123456789abcd')), 'creem_test_…abcd')
  assert.equal(box.keyHint('short'), '••••')
})

// ---------------------------------------------------------------- shop

const baseProduct = {
  title: 'Rich Kids tee',
  price: 2500,
  currency: 'usd',
  kind: 'physical',
  shipping: 500,
  images: ['https://res.cloudinary.com/x/image/upload/a.jpg', 'http://insecure.example/b.jpg', 'javascript:alert(1)'],
  colors: [{ title: 'White', hex: '#FFFFFF', image: 'https://res.cloudinary.com/x/image/upload/a.jpg' }, { title: 'Black', hex: 'red', image: 'https://elsewhere.example/c.jpg' }],
  sizes: [{ title: 'S' }, { title: 'M', available: false }, { title: '' }],
}

test('shop: products are checked and tidied on the server', () => {
  const p = shop.normalizeProduct(baseProduct)
  assert.match(p.id, /^[a-z0-9]{10}$/)
  assert.deepEqual(p.images, ['https://res.cloudinary.com/x/image/upload/a.jpg'])
  assert.equal(p.colors[0].hex, '#ffffff')
  assert.equal(p.colors[1].hex, '#888888')
  assert.equal(p.colors[1].image, null, 'a colour photo must be one of the product photos')
  assert.deepEqual(p.sizes.map(s => [s.title, s.available]), [['S', true], ['M', false]])
  assert.equal(p.shipping, 500)
  assert.equal(p.active, true)
})

test('shop: prices must be whole cents within range; digital items have no shipping', () => {
  assert.throws(() => shop.normalizeProduct({ ...baseProduct, price: 12.5 }), /whole number/)
  assert.throws(() => shop.normalizeProduct({ ...baseProduct, price: 10 }), /out of range/)
  assert.throws(() => shop.normalizeProduct({ ...baseProduct, price: 2_000_000 }), /out of range/)
  assert.throws(() => shop.normalizeProduct({ ...baseProduct, title: '   ' }), /needs a name/)
  assert.equal(shop.normalizeProduct({ ...baseProduct, kind: 'digital', shipping: 900 }).shipping, 0)
  assert.equal(shop.normalizeProduct({ ...baseProduct, currency: 'doge' }).currency, 'usd')
})

test('shop: a sealed download link survives an edit but never reaches buyers', () => {
  const saved = { ...shop.normalizeProduct({ ...baseProduct, kind: 'digital', id: 'prod000001' }), deliverySealed: 'v1.a.b.c' }
  const edited = shop.normalizeProduct({ ...baseProduct, kind: 'digital', id: 'prod000001', title: 'New name', deliverySealed: 'v1.forged.by.browser' }, { previous: saved })
  assert.equal(edited.deliverySealed, 'v1.a.b.c')
  const pub = shop.toPublicProduct(edited)
  assert.equal(pub.deliverySealed, undefined)
  assert.equal(pub.hasDelivery, true)
})

test('shop: duplicate ids are replaced and the list is capped', () => {
  const list = shop.normalizeProducts([{ ...baseProduct, id: 'sameid123' }, { ...baseProduct, id: 'sameid123' }])
  assert.notEqual(list[0].id, list[1].id)
  assert.throws(() => shop.normalizeProducts(new Array(shop.MAX_PRODUCTS + 1).fill(baseProduct)), /up to/)
})

test('shop: variant availability and the chosen option', () => {
  const p = shop.normalizeProduct(baseProduct)
  const [white] = p.colors
  const [small, medium] = p.sizes
  assert.equal(shop.isVariantAvailable(p, white.id, small.id), true)
  assert.equal(shop.isVariantAvailable(p, white.id, medium.id), false)
  assert.equal(shop.resolveVariant(p, { colorId: white.id, sizeId: small.id }).title, 'White / S')
  assert.throws(() => shop.resolveVariant(p, { colorId: white.id, sizeId: medium.id }), /out of stock/)
  assert.throws(() => shop.resolveVariant(p, { colorId: 'nope', sizeId: small.id }), /colour/)
  assert.equal(shop.isVariantAvailable({ ...p, soldOut: true }, white.id, small.id), false)
})

test('shop: buyer details are required where they matter', () => {
  const ok = { first_name: 'Ana', last_name: 'Lee', email: 'ana@example.com', country: 'US', region: 'CA', address1: '1 Main St', city: 'LA', zip: '90001' }
  assert.equal(shop.getAddressError(ok), null)
  assert.match(shop.getAddressError({ ...ok, region: '' }), /state/)
  assert.match(shop.getAddressError({ ...ok, email: 'nope' }), /email/)
  assert.equal(shop.getAddressError({ first_name: 'Ana', last_name: 'Lee', email: 'ana@example.com' }, { physical: false }), null)
  assert.equal(shop.getAddressError({ ...ok, country: 'NL', region: '' }), null)
})

test('shop: prices format for people and parse from inputs', () => {
  assert.equal(shop.formatPrice(2500, 'usd'), '$25')
  assert.equal(shop.formatPrice(1999, 'eur'), '€19.99')
  assert.equal(shop.parsePriceInput('19,99'), 1999)
  assert.equal(shop.parsePriceInput('$25'), 2500)
  assert.equal(shop.parsePriceInput(''), null)
  assert.equal(shop.centsToInput(1999), '19.99')
})

// ---------------------------------------------------------------- public user

test('public user: payment keys, Spotify tokens, orders and the raw catalogue stay private', () => {
  const active = { status: 'active', cancelAtPeriodEnd: false, productId: 'prod_shop' }
  const products = [{ ...shop.normalizeProduct(baseProduct), deliverySealed: 'v1.d' }, { ...shop.normalizeProduct(baseProduct), active: false }]
  const user = {
    id: 'alice',
    name: 'alice',
    hasCustomDomainAccess: true,
    hasShopAccess: true,
    subscription: active,
    shopGrant: signShopGrant('alice', active),
    integrations: { payments: { keySealed: 'v1.x.y.z' }, spotify: { status: 'connected', refreshSealed: 'v1.r' } },
    shopOrders: [{ id: 'o1', buyerSealed: 'v1.b' }],
    shop: { products, sig: signCatalogue('alice', products) },
    music: { mode: 'spotify', tracks: [] },
    gallery: { albums: [{ id: 'a', title: 'x', items: [{ src: 'https://e.com/a.jpg' }, { src: 'javascript:1' }] }] },
  }
  const pub = toPublicUser(user)
  const json = JSON.stringify(pub)
  for (const secret of ['v1.x.y.z', 'v1.r', 'v1.b', 'v1.d']) assert.ok(!json.includes(secret), `${secret} leaked`)
  assert.equal(pub.integrations, undefined)
  assert.equal(pub.shopOrders, undefined)
  assert.equal(pub.shop, undefined)
  assert.equal(pub.shopProducts.length, 1, 'hidden products are left out')
  assert.equal(pub.shopGrant, undefined)
  assert.equal(toPublicUser({ ...user, shopGrant: 'forged' }).shopProducts.length, 0, 'a hand-set plan shows no shop')
  assert.equal(pub.musicLive, true)
  assert.equal(pub.gallery.albums[0].items.length, 1)
})

test('public user: the shop is hidden without the Pro + Shop plan', () => {
  const user = { name: 'bob', hasCustomDomainAccess: true, hasShopAccess: false, shop: { products: [shop.normalizeProduct(baseProduct)] } }
  assert.deepEqual(toPublicUser(user).shopProducts, [])
  const lapsed = { ...user, hasShopAccess: true, subscription: { cancelAtPeriodEnd: true, currentPeriodEnd: Date.now() - 1000 } }
  assert.deepEqual(toPublicUser(lapsed).shopProducts, [])
})

// ---------------------------------------------------------------- music

test('music: songs from one album fold into an album row; duplicates merge', () => {
  const tracks = [
    { title: 'Saint Pablo', author: 'Kanye West', type: 'single', album: 'The Life of Pablo' },
    { title: 'Closer', author: 'Ne-Yo', type: 'single' },
    { title: 'Ultralight Beam', author: 'Kanye West', type: 'single', album: 'The Life of Pablo' },
    { title: 'Closer', author: 'Ne-Yo', type: 'single', album: 'Year of the Gentleman' },
  ].map(music.normalizeTrack)
  const items = music.buildMusicListItems(tracks)
  assert.equal(items[0].kind, 'album-group')
  assert.equal(items[0].album, 'The Life of Pablo')
  assert.equal(items[0].tracks.length, 2)
  assert.equal(items.filter(i => i.kind === 'track').length, 2)
})

test('music: bad tracks are dropped and the mode defaults to the list', () => {
  const m = music.normalizeMusic({ mode: 'hack', tracks: [{ title: 'x' }, { title: 'A', author: 'B', image: 'http://x' }] })
  assert.equal(m.mode, 'list')
  assert.equal(m.tracks.length, 1)
  assert.equal(m.tracks[0].image, null)
  assert.equal(music.platformSearchUrl('spotify', { author: 'A B', title: 'C' }), 'https://open.spotify.com/search/A%20B%20C')
})

// ---------------------------------------------------------------- gallery

test('gallery: only https media is kept; videos get a Cloudinary poster', () => {
  const g = gallery.normalizeGallery({
    layout: 'grid',
    albums: [
      { title: 'Trip', items: [{ src: 'https://res.cloudinary.com/demo/video/upload/v1/clip.mp4' }, { src: 'ftp://x' }] },
      { title: 'Empty', items: [] },
    ],
  })
  assert.equal(g.layout, 'grid')
  assert.equal(g.albums.length, 1)
  assert.equal(g.albums[0].items[0].type, 'video')
  assert.equal(g.albums[0].items[0].poster, 'https://res.cloudinary.com/demo/video/upload/so_0/v1/clip.jpg')
  assert.deepEqual(gallery.pickPreviewIndices([1, 2].map(i => ({ src: String(i) })), 'a'), [0, 1])
})

// ---------------------------------------------------------------- sections

test('profile sections: Gallery, Music and Shop join older saved orders after Writing', () => {
  assert.deepEqual(withBlockSections(['skills', 'writing', 'guestbook']), ['skills', 'writing', 'gallery', 'music', 'shop', 'guestbook'])
  assert.deepEqual(withBlockSections(['shop', 'skills']), ['shop', 'skills', 'gallery', 'music'])
  assert.deepEqual(withBlockSections(['skills', 'skills']), ['skills', 'gallery', 'music', 'shop'])
})

test('reserved usernames: the custom-domain shop path is reserved', () => {
  assert.equal(isReservedUsername('shop'), true)
})

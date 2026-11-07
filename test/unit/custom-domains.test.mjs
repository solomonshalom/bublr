// Custom domains: input parsing, DNS records, the Vercel-backed set/verify/
// remove routes, and how requests on a writer's domain are routed.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { installTestCerts, authHeader, call } from './helpers.mjs'
import { installFetch } from './fetch-mock.mjs'
import { resetStore, seed, read } from './mocks/firebase.mjs'

process.env.VERCEL_TOKEN = 'vercel_test_token'
process.env.VERCEL_PROJECT_ID = 'prj_bublr'
process.env.VERCEL_TEAM_ID = 'team_bublr'
process.env.NEXT_PUBLIC_BASE_URL = 'https://bublr.life'

const utils = await import('../../src/lib/domain-utils.js')
const domains = await import('../../src/lib/custom-domains.js')
const { routeCustomDomain } = await import('../../src/lib/custom-domain-routing.js')
const { buildProfilePageProps } = await import('../../src/lib/profile-page.js')
const { buildPostPageProps } = await import('../../src/lib/post-page.js')
const api = async route => (await import(`../../src/pages/api/${route}.js`)).default
const setDomain = await api('domain/set')
const verifyDomain = await api('domain/verify')
const removeDomain = await api('domain/remove')
const lookup = await api('domain/lookup')

const DAY = 24 * 60 * 60 * 1000
const iso = ms => new Date(ms).toISOString()
const PRO = { hasCustomDomainAccess: true, subscription: { provider: 'dodo', id: 'sub_1', status: 'active' } }
const LAPSED = { hasCustomDomainAccess: true, subscription: { provider: 'dodo', id: 'sub_1', status: 'cancelled', currentPeriodEnd: iso(Date.now() - DAY) } }

// ---- a fake Vercel ----
let project // name -> project domain
let elsewhere // domains attached to some other Vercel project
let dnsReady // domains whose DNS points at us
let needsTxt // domains Vercel wants a TXT ownership record for
let txtAdded // ...and where it has been added
let planFull
let calls

function installVercel() {
  calls = installFetch(req => {
    assert.equal(req.host, 'api.vercel.com')
    assert.equal(req.headers.Authorization, 'Bearer vercel_test_token')
    assert.equal(req.query.teamId, 'team_bublr', 'every call is scoped to the team')

    if (req.method === 'POST' && req.path === '/v10/projects/prj_bublr/domains') {
      const { name, redirect } = req.body
      if (planFull) return { status: 402, body: { error: { message: 'limit' } } }
      if (elsewhere.has(name)) return { status: 409, body: { error: { code: 'domain_already_in_use', message: 'in use' } } }
      if (project[name]) return { status: 400, body: { error: { message: 'already exists on project' } } }
      const apex = utils.apexDomain(name)
      project[name] = {
        name,
        apexName: apex,
        redirect: redirect || null,
        verified: !needsTxt.has(name),
        verification: needsTxt.has(name)
          ? [{ type: 'TXT', domain: `_vercel.${apex}`, value: `vc-domain-verify=${name},abc123`, reason: 'pending_domain_verification' }]
          : [],
      }
      return { body: project[name] }
    }
    const one = req.path.match(/^\/v9\/projects\/prj_bublr\/domains\/([^/]+)(\/verify)?$/)
    if (one) {
      const name = decodeURIComponent(one[1])
      if (one[2]) {
        if (!project[name]) return { status: 404, body: { error: { message: 'not found' } } }
        if (project[name].verified || txtAdded.has(name)) {
          project[name] = { ...project[name], verified: true, verification: [] }
          return { body: project[name] }
        }
        return { status: 400, body: { error: { message: 'missing TXT record' } } }
      }
      if (req.method === 'GET') return project[name] ? { body: project[name] } : { status: 404, body: { error: { message: 'not found' } } }
      if (req.method === 'DELETE') {
        if (!project[name]) return { status: 404, body: { error: { message: 'not found' } } }
        delete project[name]
        return { body: {} }
      }
    }
    const cfg = req.path.match(/^\/v6\/domains\/([^/]+)\/config$/)
    if (cfg && req.method === 'GET') {
      assert.equal(req.query.projectIdOrName, 'prj_bublr')
      const name = decodeURIComponent(cfg[1])
      return {
        body: {
          misconfigured: !dnsReady.has(name),
          configuredBy: dnsReady.has(name) ? 'CNAME' : null,
          acceptedChallenges: ['http-01'],
          recommendedIPv4: [{ rank: 2, value: ['76.76.21.21'] }, { rank: 1, value: ['216.198.79.1'] }],
          recommendedCNAME: [{ rank: 1, value: 'd1d4fc829fe7bc7c.vercel-dns-017.com.' }],
        },
      }
    }
    return { status: 404, body: { error: { message: `unmocked ${req.method} ${req.path}` } } }
  })
}

beforeEach(() => {
  installTestCerts()
  resetStore()
  project = {}
  elsewhere = new Set()
  dnsReady = new Set()
  needsTxt = new Set()
  txtAdded = new Set()
  planFull = false
  installVercel()
  seed('users', 'alice', { name: 'alice', displayName: 'Alice', posts: ['p1', 'p2'], ...PRO })
  seed('users', 'bob', { name: 'bob', displayName: 'Bob', posts: [], ...PRO })
  seed('posts', 'p1', { author: 'alice', title: 'Hello', slug: 'hello', content: '<p>Hi there</p>', published: true, lastEdited: new Date() })
  seed('posts', 'p2', { author: 'alice', title: 'Draft', slug: 'draft', content: '<p>WIP</p>', published: false, lastEdited: new Date() })
})

const POST = (headers, body) => ({ method: 'POST', headers, body })
const set = (who, domain) => call(setDomain, POST(authHeader(who), { userId: who, domain }))
const vercelWrites = () => calls.filter(c => c.method !== 'GET')

// ---- parsing ----

test('domain input: pasted URLs, ports, case, trailing dots and unicode', () => {
  const ok = {
    'example.com': 'example.com',
    '  Example.COM  ': 'example.com',
    'https://blog.example.com/about?x=1#top': 'blog.example.com',
    'http://example.com:8080': 'example.com',
    'example.com.': 'example.com',
    'www.example.co.uk': 'www.example.co.uk',
    'münchen.de': 'xn--mnchen-3ya.de',
    'my-site.dev': 'my-site.dev',
  }
  for (const [input, expected] of Object.entries(ok)) {
    assert.deepEqual(utils.parseDomainInput(input), { domain: expected }, input)
  }

  const bad = [
    '', '   ', 'localhost', 'example', '127.0.0.1', 'http://10.0.0.1/', '-bad.com', 'bad-.com', 'a..com',
    '*.example.com', 'user@example.com', 'exa mple.com', 'example.123', 'thing.local', 'site.test',
    'bublr.life', 'www.bublr.life', 'alice.bublr.life', 'my-app.vercel.app', 'vercel.com', `${'a'.repeat(64)}.com`,
  ]
  for (const input of bad) {
    assert.ok(utils.parseDomainInput(input).error, `should reject ${JSON.stringify(input)}`)
  }
})

test('platform hosts: ours, previews and local addresses', () => {
  for (const host of ['bublr.life', 'www.bublr.life', 'BUBLR.LIFE:443', 'bublr-git-main.vercel.app', 'localhost:3000', '127.0.0.1:3000', '[::1]:3000', '192.168.1.20', 'devbox', 'thing.local', '']) {
    assert.equal(utils.isPlatformHost(host), true, host)
  }
  for (const host of ['example.com', 'blog.example.com', 'www.example.co.uk', 'bublr.life.evil.com', 'notbublr.life']) {
    assert.equal(utils.isPlatformHost(host), false, host)
  }
})

test('domain helpers: apex, companions and record names', () => {
  assert.equal(utils.normalizeHost('Blog.Example.com.:443'), 'blog.example.com')
  assert.equal(utils.normalizeHost('blog.example.com:8080'), 'blog.example.com')
  assert.equal(utils.normalizeHost('blog.example.com.'), 'blog.example.com')
  assert.equal(utils.apexDomain('a.b.example.co.uk'), 'example.co.uk')
  assert.equal(utils.companionDomain('example.com'), 'www.example.com')
  assert.equal(utils.companionDomain('www.example.com'), 'example.com')
  assert.equal(utils.companionDomain('example.co.uk'), 'www.example.co.uk')
  assert.equal(utils.companionDomain('blog.example.com'), null)
  assert.equal(utils.companionDomain('www.blog.example.com'), null)
  assert.equal(utils.relativeRecordName('_vercel.example.com', 'example.com'), '_vercel')
  assert.equal(utils.relativeRecordName('example.com', 'example.com'), '@')
  assert.equal(utils.relativeRecordName('blog.example.co.uk'), 'blog')
})

test('DNS records use Vercel’s recommended values, with sensible fallbacks', () => {
  const config = {
    recommendedIPv4: [{ rank: 2, value: ['76.76.21.21'] }, { rank: 1, value: ['216.198.79.1', '216.198.79.65'] }],
    recommendedCNAME: [{ rank: 1, value: 'abc.vercel-dns-017.com.' }],
  }
  const apex = domains.buildDnsRecords({ domain: 'example.com', companion: 'www.example.com', config })
  assert.deepEqual(apex[0], { type: 'A', name: '@', value: '216.198.79.1', host: 'example.com', purpose: 'routing', required: true })
  assert.deepEqual(apex[1], { type: 'CNAME', name: 'www', value: 'abc.vercel-dns-017.com', host: 'www.example.com', purpose: 'companion', required: false })

  const sub = domains.buildDnsRecords({
    domain: 'blog.example.co.uk',
    projectDomain: {
      apexName: 'example.co.uk',
      verified: false,
      verification: [{ type: 'TXT', domain: '_vercel.example.co.uk', value: 'vc-domain-verify=blog.example.co.uk,123' }],
    },
  })
  assert.deepEqual(sub.map(r => [r.type, r.name, r.value]), [
    ['CNAME', 'blog', domains.DEFAULT_CNAME_RECORD],
    ['TXT', '_vercel', 'vc-domain-verify=blog.example.co.uk,123'],
  ])
})

// ---- set ----

test('set: needs Pro, and only for yourself', async () => {
  seed('users', 'alice', { name: 'alice', ...LAPSED })
  const lapsed = await set('alice', 'example.com')
  assert.equal(lapsed.statusCode, 403)
  assert.equal(lapsed.body.code, 'PRO_REQUIRED')
  const other = await call(setDomain, POST(authHeader('bob'), { userId: 'alice', domain: 'example.com' }))
  assert.equal(other.statusCode, 403)
  assert.equal(calls.length, 0)
})

test('set: Bublr’s own and invalid domains are refused before touching Vercel', async () => {
  for (const domain of ['bublr.life', 'www.bublr.life', 'bublr-git-x.vercel.app', 'not a domain']) {
    const res = await set('alice', domain)
    assert.equal(res.statusCode, 400, domain)
  }
  assert.equal(calls.length, 0)
})

test('set: an apex domain is attached with its www partner and the right records', async () => {
  const res = await set('alice', 'https://Example.com/')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.domain, 'example.com')
  assert.equal(res.body.companion, 'www.example.com')
  assert.equal(res.body.status, 'pending')
  assert.equal(project['www.example.com'].redirect, 'example.com', 'www redirects to the apex')
  assert.deepEqual(res.body.records.map(r => [r.type, r.name, r.value, r.required]), [
    ['A', '@', '216.198.79.1', true],
    ['CNAME', 'www', 'd1d4fc829fe7bc7c.vercel-dns-017.com', false],
  ])

  const stored = read('users', 'alice').customDomain
  assert.equal(stored.domain, 'example.com')
  assert.equal(stored.status, 'pending')
  assert.ok(stored.addedAt && stored.lastCheckedAt)
})

test('set: a subdomain has no partner; already-working DNS is verified at once', async () => {
  dnsReady.add('blog.example.com')
  const res = await set('alice', 'blog.example.com')
  assert.equal(res.body.status, 'verified')
  assert.equal(res.body.companion, null)
  assert.equal(Object.keys(project).length, 1)
  assert.ok(read('users', 'alice').customDomain.verifiedAt)
})

test('set: a domain already on this project (Vercel 400) is fine; on another project (409) is not', async () => {
  project['blog.example.com'] = { name: 'blog.example.com', apexName: 'example.com', verified: true, verification: [] }
  const reused = await set('alice', 'blog.example.com')
  assert.equal(reused.statusCode, 200)

  elsewhere.add('taken.example.org')
  const taken = await set('bob', 'taken.example.org')
  assert.equal(taken.statusCode, 409)
  assert.equal(taken.body.code, 'DOMAIN_IN_USE_ELSEWHERE')
  assert.equal(read('users', 'bob').customDomain, undefined, 'nothing saved')
})

test('set: Vercel’s plan limit and outages give clear errors', async () => {
  planFull = true
  const full = await set('alice', 'example.com')
  assert.equal(full.statusCode, 503)
  assert.equal(full.body.code, 'DOMAIN_LIMIT')
  assert.equal(read('users', 'alice').customDomain, undefined)
})

test('set: another writer’s domain (or their www partner) can’t be claimed', async () => {
  await set('alice', 'example.com')
  const same = await set('bob', 'example.com')
  assert.equal(same.statusCode, 409)
  assert.equal(same.body.code, 'DOMAIN_TAKEN')
  const partner = await set('bob', 'www.example.com')
  assert.equal(partner.statusCode, 409)
  assert.equal(read('users', 'bob').customDomain, undefined)
})

test('set: the partner is skipped when another writer already owns it', async () => {
  await set('bob', 'www.example.com') // bob: www.example.com, partner example.com
  assert.equal(read('users', 'bob').customDomain.companion, 'example.com')
  const res = await set('alice', 'shop.example.com')
  assert.equal(res.statusCode, 200)
})

test('set: switching domains lets go of the old one and its partner', async () => {
  await set('alice', 'example.com')
  assert.ok(project['example.com'] && project['www.example.com'])
  const res = await set('alice', 'blog.other.org')
  assert.equal(res.statusCode, 200)
  assert.equal(project['example.com'], undefined)
  assert.equal(project['www.example.com'], undefined)
  assert.ok(project['blog.other.org'])
  assert.equal(read('users', 'alice').customDomain.domain, 'blog.other.org')
})

test('set: swapping apex for www keeps both attached the right way round', async () => {
  await set('alice', 'example.com')
  const res = await set('alice', 'www.example.com')
  assert.equal(res.statusCode, 200)
  assert.equal(project['www.example.com'].redirect, null, 'www is now the main domain')
  assert.equal(project['example.com'].redirect, 'www.example.com', 'apex now redirects to www')
  assert.equal(read('users', 'alice').customDomain.companion, 'example.com')
})

test('set: saving the same domain again is idempotent', async () => {
  await set('alice', 'example.com')
  const first = read('users', 'alice').customDomain
  const res = await set('alice', 'example.com')
  assert.equal(res.statusCode, 200)
  const again = read('users', 'alice').customDomain
  assert.equal(again.addedAt, first.addedAt)
  assert.equal(again.companion, 'www.example.com')
  assert.ok(project['example.com'] && project['www.example.com'])
})

test('set: without Vercel credentials the feature says it’s unavailable', async () => {
  const saved = process.env.VERCEL_TOKEN
  delete process.env.VERCEL_TOKEN
  try {
    const res = await set('alice', 'example.com')
    assert.equal(res.statusCode, 503)
    assert.equal(res.body.code, 'DOMAINS_NOT_CONFIGURED')
  } finally {
    process.env.VERCEL_TOKEN = saved
  }
})

// ---- verify ----

test('verify: pending until DNS points at us, then verified', async () => {
  await set('alice', 'blog.example.com')
  const before = await call(verifyDomain, POST(authHeader('alice'), { userId: 'alice' }))
  assert.equal(before.body.verified, false)
  assert.equal(before.body.dnsConfigured, false)
  assert.match(before.body.message, /CNAME/)

  dnsReady.add('blog.example.com')
  const after = await call(verifyDomain, POST(authHeader('alice'), { userId: 'alice' }))
  assert.equal(after.body.verified, true)
  const stored = read('users', 'alice').customDomain
  assert.equal(stored.status, 'verified')
  assert.ok(stored.verifiedAt)
})

test('verify: TXT ownership challenge is shown, then cleared once added', async () => {
  needsTxt.add('blog.example.com')
  dnsReady.add('blog.example.com')
  const added = await set('alice', 'blog.example.com')
  assert.equal(added.body.status, 'pending')
  const txt = added.body.records.find(r => r.type === 'TXT')
  assert.equal(txt.name, '_vercel')
  assert.equal(txt.purpose, 'ownership')

  const still = await call(verifyDomain, POST(authHeader('alice'), { userId: 'alice' }))
  assert.equal(still.body.ownershipVerified, false)
  assert.match(still.body.message, /TXT/)

  txtAdded.add('blog.example.com')
  const done = await call(verifyDomain, POST(authHeader('alice'), { userId: 'alice' }))
  assert.equal(done.body.verified, true)
  assert.equal(done.body.records.some(r => r.type === 'TXT'), false)
})

test('verify: re-attaches a domain someone removed in the Vercel dashboard', async () => {
  await set('alice', 'blog.example.com')
  delete project['blog.example.com']
  dnsReady.add('blog.example.com')
  const res = await call(verifyDomain, POST(authHeader('alice'), { userId: 'alice' }))
  assert.equal(res.body.verified, true)
  assert.ok(project['blog.example.com'])
})

test('verify: nothing to verify, or someone else’s', async () => {
  assert.equal((await call(verifyDomain, POST(authHeader('alice'), { userId: 'alice' }))).statusCode, 400)
  assert.equal((await call(verifyDomain, POST(authHeader('bob'), { userId: 'alice' }))).statusCode, 403)
})

// ---- remove ----

test('remove: detaches the domain and its partner', async () => {
  await set('alice', 'example.com')
  const res = await call(removeDomain, POST(authHeader('alice'), { userId: 'alice' }))
  assert.equal(res.statusCode, 200)
  assert.deepEqual(project, {})
  assert.equal(read('users', 'alice').customDomain, undefined)
})

test('remove: never detaches Bublr’s own domain or another writer’s', async () => {
  // Bad data from before validation existed
  seed('users', 'mallory', { name: 'mallory', ...PRO, customDomain: { domain: 'www.bublr.life', companion: 'bublr.life', status: 'pending' } })
  project['www.bublr.life'] = { name: 'www.bublr.life' }
  project['bublr.life'] = { name: 'bublr.life' }
  const res = await call(removeDomain, POST(authHeader('mallory'), { userId: 'mallory' }))
  assert.equal(res.statusCode, 200)
  assert.ok(project['www.bublr.life'] && project['bublr.life'], 'production domains untouched')
  assert.equal(vercelWrites().filter(c => c.method === 'DELETE').length, 0)

  // Two records claiming one domain: removing one leaves Vercel alone
  await set('alice', 'blog.example.com')
  seed('users', 'bob', { name: 'bob', ...PRO, customDomain: { domain: 'blog.example.com', status: 'pending' } })
  await call(removeDomain, POST(authHeader('bob'), { userId: 'bob' }))
  assert.ok(project['blog.example.com'])
})

// ---- requests on a writer's domain ----

async function liveDomain(user = 'alice', domain = 'example.com', extra = {}) {
  const current = read('users', user)
  seed('users', user, { ...current, customDomain: { domain, companion: `www.${domain}`, status: 'verified' }, ...extra })
}

test('routing: Bublr hosts are left alone', async () => {
  for (const host of ['bublr.life', 'www.bublr.life', 'localhost:3000', 'bublr-git-main.vercel.app']) {
    assert.deepEqual(await routeCustomDomain(host, 'alice'), { kind: 'platform' })
  }
})

test('routing: a live domain serves the profile and clean post URLs', async () => {
  await liveDomain()
  const home = await routeCustomDomain('Example.com:443', null)
  assert.equal(home.kind, 'profile')
  assert.equal(home.owner.name, 'alice')
  assert.equal(home.host, 'example.com')

  const post = await routeCustomDomain('example.com', 'hello')
  assert.equal(post.kind, 'post')
  assert.equal(post.post.title, 'Hello')

  assert.deepEqual(await routeCustomDomain('example.com', 'draft'), { kind: 'not-found' }, 'drafts stay private')
  assert.deepEqual(await routeCustomDomain('example.com', 'bob'), { kind: 'not-found' }, 'no other writers on your domain')
  assert.deepEqual(await routeCustomDomain('example.com', 'alice'), { kind: 'redirect', destination: '/' })
})

test('routing: the www partner forwards to the chosen domain', async () => {
  await liveDomain()
  assert.deepEqual(await routeCustomDomain('www.example.com', 'hello'), { kind: 'redirect', destination: 'https://example.com/hello' })
  assert.deepEqual(await routeCustomDomain('www.example.com', null), { kind: 'redirect', destination: 'https://example.com/' })
})

test('routing: when Pro lapses, readers land on the same page on bublr.life', async () => {
  await liveDomain('alice', 'example.com', LAPSED)
  assert.deepEqual(await routeCustomDomain('example.com', null), { kind: 'redirect', destination: 'https://bublr.life/alice' })
  assert.deepEqual(await routeCustomDomain('example.com', 'hello'), { kind: 'redirect', destination: 'https://bublr.life/alice/hello' })
  assert.deepEqual(await routeCustomDomain('example.com', 'nope'), { kind: 'redirect', destination: 'https://bublr.life/alice' })
})

test('routing: during a cancelled-but-paid period the domain keeps working', async () => {
  await liveDomain('alice', 'example.com', {
    hasCustomDomainAccess: true,
    subscription: { provider: 'dodo', id: 'sub_1', status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: iso(Date.now() + DAY) },
  })
  assert.equal((await routeCustomDomain('example.com', null)).kind, 'profile')
})

test('routing: unknown domains go to bublr.life; pending ones already serve', async () => {
  assert.deepEqual(await routeCustomDomain('random.example.net', 'x'), { kind: 'redirect', destination: 'https://bublr.life/x' })
  await liveDomain('alice', 'example.com', { customDomain: { domain: 'example.com', status: 'pending' } })
  assert.equal((await routeCustomDomain('example.com', null)).kind, 'profile')
})

test('lookup API: public, minimal answer', async () => {
  await liveDomain()
  const res = await call(lookup, { method: 'GET', query: { domain: 'example.com' } })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(Object.keys(res.body).sort(), ['displayName', 'domain', 'userId', 'userName'])
  assert.equal((await call(lookup, { method: 'GET', query: { domain: 'nobody.example.net' } })).statusCode, 404)
})

// ---- page props ----

test('profile props: custom footer and canonical domain follow Pro status', async () => {
  const base = { id: 'alice', name: 'alice', displayName: 'Alice', posts: [], customBranding: { footerText: 'By Alice' }, email: 'a@x.com' }
  const pro = await buildProfilePageProps({ ...base, ...PRO, customDomain: { domain: 'example.com', status: 'verified' } })
  assert.equal(pro.user.customBranding.footerText, 'By Alice')
  assert.equal(pro.user.liveCustomDomain, 'example.com')
  assert.equal(pro.user.subscription, undefined, 'billing never reaches the page')
  assert.equal(pro.user.email, undefined)

  const lapsed = await buildProfilePageProps({ ...base, ...LAPSED, customDomain: { domain: 'example.com', status: 'verified' } })
  assert.equal(lapsed.user.customBranding, null)
  assert.equal(lapsed.user.liveCustomDomain, null)

  const onDomain = await buildProfilePageProps({ ...base, ...PRO }, { customDomain: 'example.com' })
  assert.equal(onDomain.user.isCustomDomain, true)
})

test('post props: canonical URL is the writer’s live domain', async () => {
  const author = { name: 'alice', displayName: 'Alice', photo: '', ...PRO, customDomain: { domain: 'example.com', status: 'verified' } }
  const post = () => ({ id: 'p1', author: 'alice', title: 'Hello', slug: 'hello', content: '<p>Hi</p>', published: true, lastEdited: new Date() })

  const onBublr = await buildPostPageProps(post(), { authorData: author })
  assert.equal(onBublr.seo.canonicalUrl, 'https://example.com/hello')
  assert.equal(onBublr.authorDomain, 'example.com')
  assert.equal(onBublr.onCustomDomain, false)

  const onDomain = await buildPostPageProps(post(), { authorData: author, customDomain: 'example.com' })
  assert.equal(onDomain.onCustomDomain, true)

  const lapsed = await buildPostPageProps(post(), { authorData: { ...author, ...LAPSED } })
  assert.equal(lapsed.seo.canonicalUrl, 'https://bublr.life/alice/hello')
  assert.equal(lapsed.authorDomain, null)
})

test('newsletter emails link to the writer’s live domain', async () => {
  const { notifySubscribersOfPost } = await import('../../src/lib/newsletter-notify.js')
  const { sent, resetSent } = await import('./mocks/resend.mjs')
  resetSent()
  seed('users', 'alice', {
    name: 'alice',
    ...PRO,
    subscribers: [{ email: 'reader@example.com' }],
    customDomain: { domain: 'example.com', status: 'verified' },
  })
  await notifySubscribersOfPost('p1')
  assert.equal(sent[0].postUrl, 'https://example.com/hello')

  // Lapsed Pro: back to bublr.life links (the default inside sendBatchNotifications)
  resetSent()
  seed('posts', 'p1', { author: 'alice', title: 'Hello', slug: 'hello', content: '<p>Hi</p>', published: true })
  seed('users', 'alice', { name: 'alice', ...LAPSED, subscribers: [{ email: 'reader@example.com' }], customDomain: { domain: 'example.com', status: 'verified' } })
  await notifySubscribersOfPost('p1')
  assert.equal(sent[0].postUrl, undefined)
})

// Profile HTML: validation, the template engine, widgets and the document the
// sandboxed frame serves.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'

import {
  moderationText,
  validateProfileCode,
  normalizeCode,
  asksForPassword,
  summarizeProfileCode,
  parseTemplate,
  renderTemplate,
  renderProfileHtml,
  findComponents,
  renderComponent,
  extractFriendNames,
  buildTemplateData,
  buildProfileDocument,
  isFullDocument,
  escapeCss,
  safeUrl,
  frameUrl,
  FRAME_CSP,
  FRAME_SANDBOX,
  PROFILE_CODE_LIMITS,
  COMPONENT_NAMES,
} from '../../src/lib/profile-code.js'
import { toPublicUser } from '../../src/lib/public-user.js'
import { PROFILE_CODE_TEMPLATES } from '../../src/lib/profile-code-templates.js'
import { heightFollower, MAX_HEIGHT } from '../../src/components/profile-code/height.js'

const USER = {
  id: 'alice-uid',
  name: 'alice',
  displayName: 'Alice <Liddell>',
  about: 'Curiouser\nand curiouser',
  photo: 'https://img.example/alice.png',
  banner: 'https://img.example/banner.jpg',
  link: 'alice.example',
  skills: ['tea', 'croquet', '', 42],
  socialLinks: { github: 'alice', twitter: '@alice', email: 'alice@example.com', instagram: '' },
  followerCount: 7,
  followingCount: 3,
  subscriberCount: 2,
  workExperience: [{ title: 'Explorer', organization: 'Wonderland', startDate: '1865', current: true, url: 'wonder.land' }, { title: '', organization: '' }],
  education: [],
  posts: [
    { id: 'p1', title: 'Down the <em>rabbit</em> hole', slug: 'rabbit-hole', published: true, lastEdited: 1700000000000, views: 40, excerpt: '<p>Falling for a long time</p>', dotColor: '#4D96FF' },
    { id: 'p2', title: 'The tea party', slug: 'tea party', published: true, lastEdited: { _seconds: 1710000000 }, views: 2 },
    { id: 'p3', title: 'Secret draft', slug: 'secret', published: false, lastEdited: 1720000000000 },
    null,
  ],
}

const GUESTBOOK = [
  { name: 'Hatter', message: 'Why is a raven like a writing desk?', signaturePath: 'M10 10 L 50 50 C 1 2 3 4 5 6', signatureViewBox: '0 0 300 100', createdAt: '2026-11-01T00:00:00Z' },
  { name: 'Cat', message: 'grin', signaturePath: '<script>alert(1)</script>', signatureViewBox: 'javascript:1' },
]

const FRIENDS = { hatter: { name: 'hatter', displayName: 'The Hatter', photo: 'https://img.example/h.png' }, evil: { name: 'evil', photo: 'javascript:alert(1)' } }

const data = buildTemplateData(USER, { guestbook: GUESTBOOK, friends: FRIENDS, now: Date.UTC(2026, 10, 22) })
const html = (source, d = data) => renderProfileHtml(source, d).output

// ---------------------------------------------------------------------------
// Validation

test('validate: accepts good code and normalises it', () => {
  const r = validateProfileCode({ html: '<h1>Hi</h1>\r\n\u0000', css: 'a{}', js: '', mode: 'page', placement: 'top' })
  assert.equal(r.ok, true)
  assert.deepEqual(r.value, { html: '<h1>Hi</h1>\n', css: 'a{}', js: '', mode: 'page', placement: 'top' })
  assert.equal(normalizeCode(42), '')
  assert.equal(normalizeCode('a\rb'), 'a\nb')
})

test('validate: defaults, types, modes and placement', () => {
  assert.deepEqual(validateProfileCode({}).value, { html: '', css: '', js: '', mode: 'off', placement: 'bottom' })
  assert.equal(validateProfileCode(null).ok, false)
  assert.equal(validateProfileCode('x').ok, false)
  assert.equal(validateProfileCode({ html: 5 }).field, 'html')
  assert.equal(validateProfileCode({ css: {} }).field, 'css')
  assert.equal(validateProfileCode({ js: ['x'] }).field, 'js')
  assert.equal(validateProfileCode({ html: 'x', mode: 'everywhere' }).field, 'mode')
  assert.equal(validateProfileCode({ html: 'x', mode: 'block', placement: 'left' }).field, 'placement')
  // showing nothing on the profile isn't allowed; keeping an empty draft is
  assert.equal(validateProfileCode({ html: '   ', mode: 'block' }).ok, false)
  assert.equal(validateProfileCode({ html: '', mode: 'off' }).ok, true)
})

test('validate: size limits are in bytes, per field and in total', () => {
  assert.equal(validateProfileCode({ html: 'a'.repeat(PROFILE_CODE_LIMITS.html) }).ok, true)
  const big = validateProfileCode({ html: 'a'.repeat(PROFILE_CODE_LIMITS.html + 1) })
  assert.equal(big.ok, false)
  assert.equal(big.field, 'html')
  assert.match(big.error, /limit is 120 KB/)
  // 4-byte characters count four times
  assert.equal(validateProfileCode({ css: '😀'.repeat(PROFILE_CODE_LIMITS.css / 4 + 1) }).field, 'css')
  const total = validateProfileCode({ html: 'a'.repeat(110 * 1024), css: 'b'.repeat(50 * 1024), js: 'c'.repeat(50 * 1024) })
  assert.equal(total.ok, false)
  assert.match(total.error, /in total/)
})

test('validate: password fields are refused (HTML and scripts)', () => {
  const bad = [
    { html: '<input type="password">' },
    { html: "<INPUT name=p TYPE='PASSWORD'>" },
    { html: '<input type=password>' },
    { html: '<div>', js: 'el.type = "password"' },
    { html: '<div>', js: "input.setAttribute('type', 'password')" },
    { html: '<div>', js: 'box.innerHTML = `<input type="password">`' },
  ]
  for (const code of bad) {
    assert.equal(asksForPassword(code), true, JSON.stringify(code))
    assert.equal(validateProfileCode({ ...code, mode: 'page' }).ok, false)
  }
  for (const code of [{ html: '<p>my password is secret</p>' }, { html: '<input type="text">' }, { js: 'const password = 1' }]) {
    assert.equal(asksForPassword(code), false, JSON.stringify(code))
  }
})

test('summary and toPublicUser never ship the code itself', () => {
  assert.equal(summarizeProfileCode(null), null)
  assert.deepEqual(summarizeProfileCode({ html: '<p>x</p>', mode: 'page', placement: 'top', version: 4 }), { mode: 'page', placement: 'top', version: 4 })
  assert.deepEqual(summarizeProfileCode({ html: '  ', mode: 'page', version: 1 }), { mode: 'off', placement: 'bottom', version: 1 })
  assert.deepEqual(summarizeProfileCode({ html: 'x', mode: 'nope', placement: 'nope', version: 'x' }), { mode: 'off', placement: 'bottom', version: 0 })

  const pub = toPublicUser({ ...USER, profileCode: { html: '<p>SECRET-HTML</p>', css: 'x', js: 'alert(1)', mode: 'block', version: 2 } })
  assert.deepEqual(pub.profileCode, { mode: 'block', placement: 'bottom', version: 2 })
  assert.equal(JSON.stringify(pub).includes('SECRET-HTML'), false)
  assert.equal('profileCode' in toPublicUser({ name: 'x' }), false)
})

// ---------------------------------------------------------------------------
// Template data

test('template data: only published posts, newest first, safe links', () => {
  assert.equal(data.posts.length, 2)
  assert.deepEqual(data.posts.map(p => p.slug), ['tea party', 'rabbit-hole'])
  assert.equal(data.posts[0].url, '/alice/tea%20party')
  assert.equal(data.posts[1].title, 'Down the rabbit hole')
  assert.equal(data.posts[1].excerpt, 'Falling for a long time')
  assert.equal(data.posts[1].dotColor, '#4D96FF')
  assert.equal(data.posts[0].index, 1)
  assert.equal(data.postCount, 2)
  assert.equal(data.totalReads, 42)
  assert.equal(data.latestPost.slug, 'tea party')
  assert.ok(!JSON.stringify(data).includes('Secret draft'))
  assert.equal(data.year, 2026)
})

test('template data: socials, website, skills, experience, guest book, friends', () => {
  assert.deepEqual(data.skills, ['tea', 'croquet'])
  assert.deepEqual(
    data.socials.map(s => [s.network, s.url]),
    [
      ['github', 'https://github.com/alice'],
      ['twitter', 'https://twitter.com/alice'],
      ['email', 'mailto:alice@example.com'],
      ['website', 'https://alice.example'],
    ]
  )
  assert.equal(data.link, 'https://alice.example')
  assert.equal(data.work.length, 1)
  assert.equal(data.work[0].dates, '1865 – Present')
  assert.equal(data.work[0].url, 'https://wonder.land')
  assert.equal(data.guestbook.length, 2)
  assert.ok(data.guestbook[0].signature)
  assert.equal(data.guestbook[1].signature, null, 'a signature that isn’t SVG path data is dropped')
  assert.equal(data.friends.hatter.displayName, 'The Hatter')
  assert.equal(data.friends.evil.photo, '', 'javascript: photos are dropped')
  assert.equal(data.followerCount, 7)
  assert.equal(data.hasPosts, true)
  assert.equal(data.hasSkills, true)
  assert.equal(data.hasEducation, false)
})

test('template data: unsafe photo, banner and website links are dropped', () => {
  const d = buildTemplateData({ name: 'x', photo: 'javascript:alert(1)', banner: 'data:text/html,hi', link: 'javascript:alert(1)' })
  assert.equal(d.photo, '')
  assert.equal(d.banner, '')
  // a bare "javascript:alert(1)" becomes https://javascript:alert(1), which is
  // a harmless (broken) https link rather than a script
  assert.ok(d.link === '' || d.link.startsWith('https://'))
  assert.equal(safeUrl('//evil.example'), '')
  assert.equal(safeUrl('/alice/post'), '/alice/post')
  assert.equal(safeUrl(' JAVASCRIPT:alert(1)'), '')
  assert.deepEqual(buildTemplateData(null).posts, [])
})

// ---------------------------------------------------------------------------
// Template engine

test('tags: values are filled in and escaped', () => {
  assert.equal(html('<h1>{{displayName}}</h1>'), '<h1>Alice &lt;Liddell&gt;</h1>')
  assert.equal(html('{{ name }} {{missing}}!'), 'alice !')
  assert.equal(html('{{postCount}}/{{followerCount}}'), '2/7')
  assert.equal(html('{{skills}}'), 'tea, croquet')
  assert.equal(html('{{latestPost.title}}'), 'The tea party')
  assert.equal(html('{{skills.1}}'), 'croquet')
  assert.equal(html('{{hasPosts}}'), '', 'booleans print nothing')
  const evil = buildTemplateData({ name: 'x', displayName: '"><script>alert(1)</script>' })
  assert.equal(html('<a title="{{displayName}}">', evil), '<a title="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">')
})

test('tags: sections, inverted sections, {{.}} and comments', () => {
  assert.equal(html('{{#posts}}[{{title}}]{{/posts}}'), '[The tea party][Down the rabbit hole]')
  assert.equal(html('{{#skills}}<b>{{.}}</b>{{/skills}}'), '<b>tea</b><b>croquet</b>')
  assert.equal(html('{{^education}}none{{/education}}'), 'none')
  assert.equal(html('{{^posts}}none{{/posts}}'), '')
  assert.equal(html('{{#about}}<p>{{about}}</p>{{/about}}'), '<p>Curiouser\nand curiouser</p>')
  assert.equal(html('{{#hasGuestbook}}yes{{/hasGuestbook}}{{#hasEducation}}no{{/hasEducation}}'), 'yes')
  assert.equal(html('{{#latestPost}}{{title}} by {{displayName}}{{/latestPost}}'), 'The tea party by Alice &lt;Liddell&gt;')
  assert.equal(html('a{{! a note }}b'), 'ab')
  assert.equal(html('{{#posts}}{{#skills}}{{.}}{{/skills}};{{/posts}}'), 'teacroquet;teacroquet;')
})

test('tags: things that aren’t tags are left alone; prototype keys are empty', () => {
  assert.equal(html('{{ a + b }} {{ 1 }} {{foo bar}}'), '{{ a + b }} {{ 1 }} {{foo bar}}')
  assert.equal(html('{{constructor}}{{__proto__}}{{toString}}{{name.length}}'), '')
  assert.equal(html('{{posts.length}}'), '2', 'a list’s length is its own property, and handy')
  assert.equal(html('{{#constructor}}x{{/constructor}}'), '')
})

test('tags: broken nesting warns but keeps the text', () => {
  const unclosed = renderTemplate('a {{#posts}}b {{title}}', data)
  assert.equal(unclosed.output, 'a {{#posts}}b ')
  assert.match(unclosed.warnings[0], /never closed/)
  const stray = renderTemplate('x{{/posts}}y', data)
  assert.equal(stray.output, 'x{{/posts}}y')
  assert.match(stray.warnings[0], /no matching/)
  const crossed = renderTemplate('{{#posts}}{{#skills}}{{/posts}}', data)
  assert.equal(crossed.warnings.length, 1)
  assert.equal(parseTemplate('{{#a}}{{#b}}{{/a}}').warnings.length, 1)
})

test('tags: deeply nested loops are cut off quickly instead of hanging the server', () => {
  const many = buildTemplateData({ name: 'x', posts: Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, slug: `s${i}`, title: 'T', published: true })) })
  const source = '{{#posts}}{{#posts}}{{#posts}}{{#posts}}{{#posts}}{{title}}{{/posts}}{{/posts}}{{/posts}}{{/posts}}{{/posts}}'
  const started = Date.now()
  const r = renderProfileHtml(source, many)
  assert.ok(Date.now() - started < 2000, 'finished in under 2s')
  assert.ok(r.warnings.some(w => /too much repetition/.test(w)))
  assert.ok(r.output.length < 2000000)
})

test('tags: <!-- bublr:no-tags --> and inline scripts keep their braces', () => {
  assert.equal(html('<!-- bublr:no-tags -->{{name}}<bublr-name></bublr-name>'), '<!-- bublr:no-tags -->{{name}}<span class="bublr-name">Alice &lt;Liddell&gt;</span>')
  assert.equal(html('{{name}}<script>const t = "{{name}}"</script>'), 'alice<script>const t = "{{name}}"</script>')
})

test('tags in CSS use CSS escaping', () => {
  const r = renderTemplate('body{background:url({{banner}})} .x::after{content:"{{displayName}}"}', data, { escape: escapeCss })
  assert.equal(r.output, 'body{background:url(https://img.example/banner.jpg)} .x::after{content:"Alice \\3c Liddell\\3e "}')
  assert.equal(escapeCss('a"b}c;d'), 'a\\22 b\\7d c\\3b d')
})

// ---------------------------------------------------------------------------
// Widgets

test('widgets: found in all three forms, attributes decoded', () => {
  const found = findComponents('<bublr-avatar size="40"/> <bublr-posts limit=2 layout=\'cards\'>{{title}}</bublr-posts> <bublr-music title="Rock &amp; Roll">')
  assert.deepEqual(found.map(c => c.name), ['avatar', 'posts', 'music'])
  assert.deepEqual(found[1].attrs, { limit: '2', layout: 'cards' })
  assert.equal(found[1].inner, '{{title}}')
  assert.equal(found[2].attrs.title, 'Rock & Roll')
  // a lone open tag followed by another of the same widget doesn't swallow it
  assert.equal(findComponents('<bublr-posts> x <bublr-posts></bublr-posts>').length, 2)
  assert.equal(findComponents('<bublr-x>'.repeat(1000)).length, 300)
})

test('widgets: posts', () => {
  const list = html('<bublr-posts></bublr-posts>')
  assert.match(list, /^<ul class="bublr-posts bublr-posts--list">/)
  assert.equal((list.match(/<li class="bublr-post"/g) || []).length, 2)
  assert.match(list, /href="\/alice\/rabbit-hole"/)
  assert.match(list, /bublr-post__excerpt/)
  assert.doesNotMatch(html('<bublr-posts excerpt="false" date="false">'), /excerpt|<time/)
  assert.equal((html('<bublr-posts limit="1">').match(/<li/g) || []).length, 1)
  assert.match(html('<bublr-posts layout="bogus">'), /bublr-posts--list/)
  assert.match(html('<bublr-posts layout="grid">'), /bublr-posts--grid/)
  assert.equal(html('<bublr-posts limit="1"><i>{{title}}</i></bublr-posts>'), '<i>The tea party</i>')
  const none = buildTemplateData({ name: 'x' })
  assert.equal(html('<bublr-posts empty="Soon!"></bublr-posts>', none), '<p class="bublr-empty">Soon!</p>')
  assert.equal(html('<bublr-latest-post><b>{{title}}</b></bublr-latest-post>'), '<b>The tea party</b>')
})

test('widgets: data that looks like a tag is never re-read as one', () => {
  const tricky = buildTemplateData({ name: 'x', about: 'secret', posts: [{ id: '1', slug: 's', title: '{{about}} <b>', published: true }] })
  assert.equal(html('<bublr-posts limit="1" excerpt="false" date="false"></bublr-posts>', tricky).includes('secret'), false)
  assert.equal(html('{{#posts}}{{title}}{{/posts}}', tricky), '{{about}}')
})

test('widgets: avatar, name, bio, counter, stats, skills, socials', () => {
  assert.equal(
    html('<bublr-avatar size="9999" shape="square">'),
    '<img class="bublr-avatar bublr-avatar--square" src="https://img.example/alice.png" alt="Alice &lt;Liddell&gt;" width="512" height="512">'
  )
  assert.equal(html('<bublr-bio>'), '<p class="bublr-bio">Curiouser<br>and curiouser</p>')
  assert.equal(html('<bublr-username>'), '<span class="bublr-username">@alice</span>')
  const counter = html('<bublr-counter digits="4" label="">')
  assert.equal((counter.match(/bublr-counter__digit/g) || []).length, 4)
  assert.match(counter, />0<\/span><span class="bublr-counter__digit">0<\/span><span class="bublr-counter__digit">4<\/span><span class="bublr-counter__digit">2</)
  assert.match(html('<bublr-stats show="posts,reads">'), /Posts.*Reads/)
  assert.doesNotMatch(html('<bublr-stats show="posts">'), /Followers/)
  assert.equal((html('<bublr-skills>').match(/bublr-skill"/g) || []).length, 2)
  const socials = html('<bublr-socials>')
  assert.match(socials, /href="https:\/\/github.com\/alice" target="_blank" rel="noopener noreferrer me"/)
  assert.match(socials, /href="mailto:alice@example.com">Email/)
  assert.equal(html('<bublr-year>'), '2026')
})

test('widgets: guest book draws only real signatures', () => {
  const out = html('<bublr-guestbook>')
  assert.equal((out.match(/<svg/g) || []).length, 1)
  assert.match(out, /Why is a raven like a writing desk\?/)
  assert.doesNotMatch(out, /<script>/)
  assert.match(html('<bublr-guestbook limit="1">{{name}}</bublr-guestbook>'), /^Hatter$/)
})

test('widgets: Top 8 friends', () => {
  // Usernames match exactly, like profile URLs (new accounts get mixed-case uids as usernames)
  assert.deepEqual(extractFriendNames('<bublr-friends users="hatter, @cat  queen,bad!name,hatter"><bublr-friends users="rabbit kQ3xT9aB7mN2pL5vR8wY1zC4dE6f">'), ['hatter', 'cat', 'queen', 'rabbit', 'kQ3xT9aB7mN2pL5vR8wY1zC4dE6f'])
  assert.deepEqual(extractFriendNames('<bublr-friends users="Hatter hatter __proto__">'), ['Hatter', 'hatter'])
  const mixed = buildTemplateData(USER, { friends: { kQ3xT9: { name: 'kQ3xT9', displayName: 'Mixed Case' } } })
  assert.match(renderProfileHtml('<bublr-friends users="kQ3xT9 toString constructor">', mixed).output, /Mixed Case[\s\S]*href="\/kQ3xT9"|href="\/kQ3xT9"[\s\S]*Mixed Case/)
  assert.equal((renderProfileHtml('<bublr-friends users="kQ3xT9 toString constructor">', mixed).output.match(/bublr-friend"/g) || []).length, 1, 'object built-ins are not friends')
  assert.equal(extractFriendNames(`<bublr-friends users="${Array.from({ length: 20 }, (_, i) => `u${i}`).join(',')}">`).length, 12)
  const out = html('<bublr-friends users="hatter, ghost, evil" title="Top 8">')
  assert.match(out, /<h2 class="bublr-friends__title">Top 8<\/h2>/)
  assert.match(out, /href="\/hatter"/)
  assert.doesNotMatch(out, /ghost|javascript/)
  // nothing to show visitors; the editor shows the writer what's missing
  assert.equal(html('<bublr-friends users="">'), '')
  assert.ok(renderProfileHtml('<bublr-friends users="">', data).warnings.some(w => /needs users=/.test(w)))
  assert.match(html('<bublr-friends users="" empty="No friends yet">'), /No friends yet/)
})

test('widgets: music only plays http(s) links', () => {
  assert.match(html('<bublr-music src="https://cdn.example/song.mp3" title="Song" loop>'), /<audio class="bublr-music__player" controls preload="none" loop src="https:\/\/cdn.example\/song.mp3">/)
  for (const src of ['javascript:alert(1)', '/local.mp3', '', 'data:audio/mp3,xx']) {
    assert.equal(html(`<bublr-music src="${src}">`), '', src)
    assert.ok(renderProfileHtml(`<bublr-music src="${src}">`, data).warnings.some(w => /needs src=/.test(w)))
  }
})

test('widgets: unknown ones warn; every documented widget renders', () => {
  const r = renderProfileHtml('<bublr-nope></bublr-nope>', data)
  assert.match(r.output, /unknown widget/)
  assert.ok(r.warnings.some(w => /isn’t a Bublr widget/.test(w)))
  for (const name of COMPONENT_NAMES) {
    assert.equal(typeof renderComponent({ name, attrs: {}, inner: '' }, data), 'string', name)
  }
})

// ---------------------------------------------------------------------------
// The document

test('document: a fragment is wrapped with the runtime, data and styles', () => {
  const { html: doc, warnings } = buildProfileDocument({ code: { html: '<h1>{{name}}</h1>', css: 'h1{color:red}', js: 'console.log(1)' }, data })
  assert.deepEqual(warnings, [])
  assert.match(doc, /^<!doctype html><html lang="en" class="bublr-page"><head>/)
  // Links are handled by the runtime, not <base target> (which also sent #anchors to the top window)
  assert.doesNotMatch(doc, /<base\b/)
  assert.match(doc, /PREVIEW=false/)
  assert.match(buildProfileDocument({ code: { html: 'x' }, data, preview: true }).html, /PREVIEW=true/)
  assert.match(doc, /window\.bublr=\{/)
  assert.match(doc, /bublr:height/)
  assert.match(doc, /<style id="bublr-base">/)
  assert.match(doc, /<title>Alice &lt;Liddell&gt; \(@alice\)<\/title>/)
  assert.match(doc, /<style id="bublr-css">h1\{color:red\}<\/style><\/head><body><h1>alice<\/h1><script id="bublr-js">console\.log\(1\)<\/script><\/body><\/html>$/)
  assert.match(buildProfileDocument({ code: { html: 'x' }, data, embed: 'block' }).html, /class="bublr-block"/)
  assert.doesNotMatch(buildProfileDocument({ code: { html: 'x' }, data }).html, /bublr-css|bublr-js/)
})

// Runs the frame's runtime script against a stubbed browser and clicks a link.
function runFrame({ preview = false, embed = 'page', frameUrl: at = 'https://www.bublr.life/api/profile-frame/alice?embed=page&v=3' } = {}) {
  const { html: doc } = buildProfileDocument({ code: { html: 'x' }, data, preview, embed })
  const runtime = [...doc.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('PREVIEW='))
  const listeners = {}
  const opened = []
  const posted = []
  const top = { location: { href: 'https://www.bublr.life/alice' } }
  const win = {
    addEventListener: (type, fn) => (listeners[type] = listeners[type] || []).push(fn),
    dispatchEvent() {},
    open: (url, name) => opened.push([url, name]),
    parent: { postMessage: m => posted.push(m) },
    top,
    scrollY: 0,
  }
  const context = {
    window: win,
    document: {
      documentElement: {
        setAttribute() {},
        style: {},
        getBoundingClientRect: () => ({ height: 100 }),
        classList: { contains: c => c === (embed === 'block' ? 'bublr-block' : 'bublr-page') },
      },
      readyState: 'complete',
      body: null,
      addEventListener() {},
      getElementById: id => (id === 'guestbook' ? { getBoundingClientRect: () => ({ top: 300 }) } : null),
      getElementsByName: () => [],
    },
    location: { href: at },
    URL,
    CustomEvent: class {
      constructor(type, init) {
        this.type = type
        this.detail = init && init.detail
      }
    },
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({}),
    setInterval: () => 0,
    clearInterval() {},
  }
  win.matchMedia = context.matchMedia
  vm.runInNewContext(runtime, context)
  const fire = (type, event) => {
    for (const fn of listeners[type] || []) fn(event)
    return event
  }
  const click = (href, { target = '', button = 0, metaKey = false, already = false, type = 'click' } = {}) => {
    const a = {
      nodeType: 1,
      closest: () => a,
      hasAttribute: () => false,
      getAttribute: name => (name === 'href' ? href : name === 'target' ? target : null),
    }
    const event = {
      target: a,
      button,
      metaKey,
      ctrlKey: false,
      shiftKey: false,
      defaultPrevented: already,
      preventDefault() {
        this.defaultPrevented = true
      },
    }
    return fire(type, event)
  }
  const hello = path => fire('message', { source: win.parent, data: { type: 'bublr:hello', path } })
  return { click, fire, hello, opened, posted, top }
}

test('frame links: relative links go to the profile, in the visitor’s tab', () => {
  const f = runFrame()
  const e = f.click('?classic=1')
  assert.equal(e.defaultPrevented, true)
  assert.equal(f.top.location.href, 'https://www.bublr.life/alice?classic=1')
  f.click('/alice/tea-party')
  assert.equal(f.top.location.href, 'https://www.bublr.life/alice/tea-party')
  assert.deepEqual(f.opened, [])
})

test('frame links: #anchors scroll the page itself; new-tab links open a new tab', () => {
  const f = runFrame()
  assert.equal(f.click('#guestbook').defaultPrevented, false, 'the browser scrolls inside the frame')
  assert.equal(f.click('javascript:void(0)').defaultPrevented, false)
  assert.equal(f.click('https://example.com', { already: true }).defaultPrevented, true)
  assert.deepEqual(f.opened, [], 'a link the page handled itself is left alone')
  f.click('https://example.com/x', { target: '_blank' })
  f.click('?classic=1', { metaKey: true })
  f.click('/explore', { type: 'auxclick', button: 1 })
  assert.deepEqual(f.opened, [
    ['https://example.com/x', '_blank'],
    ['https://www.bublr.life/alice?classic=1', '_blank'],
    ['https://www.bublr.life/explore', '_blank'],
  ])
  assert.equal(f.top.location.href, 'https://www.bublr.life/alice', 'the visitor’s tab didn’t move')
})

test('frame links: in the editor preview every link opens a new tab, and ⌘S saves', () => {
  const f = runFrame({ preview: true, frameUrl: 'https://www.bublr.life/api/profile-preview' })
  f.click('?classic=1')
  f.click('/alice/tea-party')
  assert.deepEqual(f.opened, [
    ['https://www.bublr.life/alice?classic=1', '_blank'],
    ['https://www.bublr.life/alice/tea-party', '_blank'],
  ])
  assert.equal(f.top.location.href, 'https://www.bublr.life/alice', 'the editor is never navigated away')
  const key = f.fire('keydown', {
    metaKey: true,
    key: 's',
    preventDefault() {
      this.saved = true
    },
  })
  assert.equal(key.saved, true)
  assert.ok(f.posted.some(m => m.type === 'bublr:save'))

  const live = runFrame()
  live.fire('keydown', { metaKey: true, key: 's', preventDefault() {} })
  assert.equal(live.posted.some(m => m.type === 'bublr:save'), false, 'only the preview listens for ⌘S')
})

test('frame links: only web, mail and phone links are followed; the page says where the profile lives', () => {
  const f = runFrame()
  for (const href of ['java\tscript:alert(1)', ' JAVASCRIPT:alert(1)', 'data:text/html,hi', 'vbscript:x']) {
    assert.equal(f.click(href).defaultPrevented, false, href)
  }
  assert.equal(f.top.location.href, 'https://www.bublr.life/alice', 'nothing reached the visitor’s tab')
  f.click('mailto:alice@example.com')
  assert.equal(f.top.location.href, 'mailto:alice@example.com')
  // On a custom domain the profile lives at "/": the page tells the frame
  const custom = runFrame({ frameUrl: 'https://alice.example/api/profile-frame/alice?embed=page&v=3' })
  custom.hello('//evil.example/x')
  custom.click('?classic=1')
  assert.equal(custom.top.location.href, 'https://alice.example/alice?classic=1', 'a protocol-relative path is ignored')
  custom.hello('/')
  custom.click('?classic=1')
  assert.equal(custom.top.location.href, 'https://alice.example/?classic=1')
})

test('frame links: in a section, #anchors scroll the profile (the frame can’t scroll)', () => {
  const f = runFrame({ embed: 'block' })
  assert.equal(f.click('#guestbook').defaultPrevented, true)
  // (messages come from the script's own realm, so compare them as JSON)
  assert.equal(JSON.stringify(f.posted.filter(m => m.type === 'bublr:scroll')), JSON.stringify([{ type: 'bublr:scroll', top: 300 }]))
  assert.equal(f.click('#nowhere').defaultPrevented, false, 'an anchor with no target is left to the browser')
  const page = runFrame()
  assert.equal(page.click('#guestbook').defaultPrevented, false, 'a whole page scrolls itself')
})

test('section heights: a page that grows with its frame is stopped, not followed forever', () => {
  let t = 0
  const follow = heightFollower({ now: () => t })
  assert.equal(follow(10), 40, 'never smaller than 40px')
  assert.equal(follow(1e9), MAX_HEIGHT)
  const fresh = heightFollower({ now: () => t })
  let h = 200
  let last = null
  for (let i = 0; i < 100; i++) {
    const next = fresh(h + 20) // "100vh plus a margin": always 20px taller than the frame
    if (next === null) break
    last = next
    h = next
  }
  assert.ok(last < 200 + 26 * 20, `stopped at ${last}`)
  assert.equal(fresh(h + 20), null, 'still stopped')
  assert.equal(fresh(300), 300, 'shrinking is always followed, and resets the guard')
  t += 5000
  assert.equal(fresh(320), 320, 'normal growth works again')
})

test('document: “JS off” pauses scripts in the HTML too', () => {
  const code = { html: '<p>hi</p><script>bad()</script><SCRIPT src="https://x.example/a.js"></SCRIPT><scripted>', js: 'alsoBad()' }
  const on = buildProfileDocument({ code, data, preview: true }).html
  assert.match(on, /<script>bad\(\)<\/script>/)
  assert.match(on, /alsoBad\(\)/)
  const off = buildProfileDocument({ code, data, preview: true, scripts: false }).html
  assert.doesNotMatch(off, /alsoBad/)
  assert.match(off, /<script type="text\/x-bublr-paused">bad\(\)<\/script>/)
  assert.match(off, /<script type="text\/x-bublr-paused" src="https:\/\/x\.example\/a\.js">/)
  assert.match(off, /<scripted>/, 'other tags are untouched')
  assert.match(off, /PREVIEW=true/, 'Bublr’s own runtime still runs')
  // Inline handlers and javascript: links: a policy that only allows Bublr's two scripts
  const nonce = off.match(/<meta http-equiv="Content-Security-Policy" content="script-src 'nonce-([a-z0-9]+)'">/)[1]
  assert.equal((off.match(new RegExp(`<script nonce="${nonce}">`, 'g')) || []).length, 2)
  assert.ok(off.indexOf('Content-Security-Policy') < off.indexOf('<script'), 'the policy comes before any script')
  assert.doesNotMatch(on, /Content-Security-Policy|nonce=/)
})

test('template data: counts cover every post, lists show the newest 50', () => {
  const many = Array.from({ length: 120 }, (_, i) => ({ title: `P${i}`, slug: `p${i}`, published: true, views: 10, lastEdited: { seconds: 1700000000 + i } }))
  const d = buildTemplateData({ name: 'busy', posts: [...many, { title: 'draft', published: false, views: 99 }] })
  assert.equal(d.posts.length, 50)
  assert.equal(d.posts[0].title, 'P119')
  assert.equal(d.postCount, 120)
  assert.equal(d.totalReads, 1200)
})

test('widgets: empty="" hides a list’s empty message', () => {
  const none = buildTemplateData({ name: 'new', posts: [] })
  assert.match(renderProfileHtml('<bublr-posts></bublr-posts>', none).output, /No posts yet/)
  assert.equal(renderProfileHtml('<bublr-posts empty=""></bublr-posts>', none).output, '')
  assert.match(renderProfileHtml('<bublr-posts empty="Soon!"></bublr-posts>', none).output, /Soon!/)
  assert.equal(renderProfileHtml('<bublr-guestbook empty=""></bublr-guestbook>', none).output, '')
  assert.equal(renderProfileHtml('<bublr-latest-post empty=""></bublr-latest-post>', none).output, '')
  const terminal = PROFILE_CODE_TEMPLATES.find(t => t.id === 'terminal')
  const out = renderProfileHtml(terminal.html, none).output
  assert.doesNotMatch(out, /No posts yet/)
  assert.match(out, /total 0/)
})

test('document: the writer’s CSS and JS can’t close their own elements early', () => {
  const { html: doc } = buildProfileDocument({ code: { html: 'x', css: 'a{}</style><b>', js: 'var s = "</script><i>"; <!--' }, data })
  assert.match(doc, /a\{\}<\\\/style><b>/)
  assert.match(doc, /"<\\\/script><i>"; <\\!--/)
  assert.equal((doc.match(/<\/style>/g) || []).length, 2)
})

test('document: profile data can’t break out of window.bublr', () => {
  const evil = buildTemplateData({ name: 'x', about: '</script><script>alert(1)</script>' })
  const { html: doc } = buildProfileDocument({ code: { html: 'hi' }, data: evil })
  assert.equal(doc.includes('</script><script>alert(1)'), false)
  assert.match(doc, /\\u003c\/script\\u003e/)
})

test('document: a pasted full page keeps its own structure', () => {
  const page = '<!DOCTYPE html>\n<html lang="fr" class="mine"><head><title>Mine</title></head><body><header>top</header><p>{{name}}</p></body></html>'
  assert.equal(isFullDocument(page), true)
  assert.equal(isFullDocument('<!-- hi --><html>'), true)
  assert.equal(isFullDocument('<p><html></p>'), false)
  const { html: doc } = buildProfileDocument({ code: { html: page, css: 'p{}', js: 'x()' }, data })
  assert.match(doc, /<html class="bublr-page mine" lang="fr">|<html lang="fr" class="bublr-page mine">/)
  assert.match(doc, /<head><meta charset="utf-8">/)
  assert.equal((doc.match(/<title>/g) || []).length, 1, 'their title wins')
  assert.match(doc, /<header>top<\/header>/, '<header> is not mistaken for <head>')
  assert.match(doc, /<style id="bublr-css">p\{\}<\/style><\/head>/)
  assert.match(doc, /<p>alice<\/p><script id="bublr-js">x\(\)<\/script><\/body>/)
  const bare = buildProfileDocument({ code: { html: '<html><body>hi</body></html>' }, data }).html
  assert.match(bare, /<html class="bublr-page"><head><meta charset="utf-8">/)
})

test('frame sandbox: scripts yes; same-origin, forms and dialogs no', () => {
  assert.doesNotMatch(FRAME_SANDBOX, /allow-same-origin|allow-forms|allow-modals|allow-top-navigation(?!-by-user-activation)/)
  assert.match(FRAME_SANDBOX, /allow-scripts/)
  assert.match(FRAME_CSP, /^sandbox allow-scripts/)
  assert.match(FRAME_CSP, /frame-ancestors 'self'/)
  assert.match(FRAME_CSP, /form-action 'none'/)
  assert.match(FRAME_CSP, /base-uri 'none'/)
  assert.equal(frameUrl('a b', { embed: 'block', version: 3 }), '/api/profile-frame/a%20b?embed=block&v=3')
  assert.equal(frameUrl('x', { embed: 'nope' }), '/api/profile-frame/x?embed=page&v=0')
})

test('every starter template renders cleanly and passes validation', () => {
  const empty = buildTemplateData({ name: 'newbie' })
  for (const t of PROFILE_CODE_TEMPLATES) {
    for (const d of [data, empty]) {
      const r = buildProfileDocument({ code: t, data: d, embed: t.mode === 'block' ? 'block' : 'page' })
      // only "fill this in" hints for the song and Top 8 placeholders
      const real = r.warnings.filter(w => !/^<bublr-(music|friends)> needs /.test(w))
      assert.deepEqual(real, [], `${t.id} has warnings: ${real.join('; ')}`)
      assert.doesNotMatch(r.html, /\{\{[#^/]?\s*[A-Za-z]/, `${t.id} left a tag unfilled`)
    }
    const v = validateProfileCode({ ...t, mode: t.mode })
    assert.equal(v.ok, true, `${t.id}: ${v.error}`)
  }
  assert.equal(new Set(PROFILE_CODE_TEMPLATES.map(t => t.id)).size, PROFILE_CODE_TEMPLATES.length)
})

// ---------------------------------------------------------------------------
// Hostile input (from the security review): every case must stay fast, because
// the frame renders on our server for every request.

const timed = (label, fn, limitMs = 500) => {
  const started = performance.now()
  const result = fn()
  const took = performance.now() - started
  assert.ok(took < limitMs, `${label} took ${Math.round(took)} ms`)
  return result
}

test('hostile input: no slow paths in parsing or validation', () => {
  const K = 120 * 1024
  const cases = {
    'comments before a doctype': '<!---->'.repeat(5000) + 'x',
    'unclosed {{ with spaces': '{{' + ' '.repeat(K - 2),
    'many {{ ': '{{ '.repeat(K / 3),
    'widget name with no >': '<bublr-' + 'a-'.repeat(60000),
    'widget attributes with no >': '<bublr-posts ' + 'a="b" '.repeat(20000),
    'many unclosed widgets': '<bublr-posts '.repeat(9000),
    'password-ish spaces': '<input type=' + ' '.repeat(K - 12),
    'deep sections': '{{#year}}'.repeat(12000),
    'unclosed sections': '{{#posts}}x'.repeat(10000),
    'stray closes': '{{/posts}}'.repeat(12000),
    'unclosed scripts': '<script>'.repeat(14000),
    'scripts with no close tag': '<script>{{name}}'.repeat(7000),
    'quotes in attributes': '<bublr-music title="' + 'a'.repeat(K - 30),
  }
  for (const [label, html] of Object.entries(cases)) {
    timed(`validate: ${label}`, () => validateProfileCode({ html, js: html.slice(0, 60000), mode: 'off' }))
    const r = timed(`render: ${label}`, () => buildProfileDocument({ code: { html, css: html.slice(0, 60000) }, data }), 1500)
    assert.equal(typeof r.html, 'string')
  }
  timed('full document check', () => isFullDocument('<!---->'.repeat(30) + 'x'), 50)
  timed('script strings for moderation', () => moderationText({ js: '"' + 'a'.repeat(60000) + "'".repeat(30000) }))
})

test('hostile input: deep nesting is cut at 64 levels instead of crashing', () => {
  const r = renderTemplate('{{#year}}'.repeat(5000) + 'x' + '{{/year}}'.repeat(5000), data)
  assert.ok(r.warnings.some(w => /nested more than 64/.test(w)))
  const ok = renderTemplate('{{#year}}'.repeat(10) + 'deep' + '{{/year}}'.repeat(10), data)
  assert.equal(ok.output, 'deep')
})

test('hostile input: NUL characters in profile data can’t pull in other output', () => {
  const sneaky = buildTemplateData({
    name: 'x',
    about: 'hi \u00000\u0000 \u0000k0\u0000',
    posts: [{ id: '1', slug: 's', title: 'T\u00000\u0000', published: true }],
  })
  assert.equal(sneaky.about.includes('\u0000'), false)
  const out = renderProfileHtml('<script>secret()</script>{{about}}<bublr-name>{{#posts}}{{title}}{{/posts}}', sneaky).output
  assert.equal((out.match(/secret\(\)/g) || []).length, 1)
  assert.equal((out.match(/bublr-name/g) || []).length, 1)
})

test('the writer’s $-patterns survive in full documents', () => {
  const css = "a::after{content:'$& $` $\\' $1'}"
  const js = "const esc = s => s.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')"
  const doc = buildProfileDocument({ code: { html: '<html><head></head><body>x</body></html>', css, js }, data }).html
  assert.ok(doc.includes(css), 'css intact')
  assert.ok(doc.includes(js), 'js intact')
  const twoBodies = buildProfileDocument({ code: { html: '<html><body>a</body><!-- </body> --></html>', js: 'go()' }, data }).html
  assert.match(twoBodies, /<!-- <script id="bublr-js">go\(\)<\/script><\/body> -->/)
})

test('password speed bump: encoded and masked variants', () => {
  for (const code of [
    { html: '<input type="pass&#119;ord">' },
    { html: '<input type="&#x70;assword">' },
    { html: '<input style="-webkit-text-security: disc">' },
    { css: 'input { -webkit-text-security:circle }' },
    { js: "document.createElement('input', { type: 'password' })" },
  ]) {
    assert.equal(asksForPassword(code), true, JSON.stringify(code))
  }
  assert.equal(asksForPassword({ html: '<p>Please type your password reset code</p>' }), false)
})

test('moderation reads script text as well as HTML', () => {
  assert.equal(moderationText({ html: '<p>hi</p>' }), '<p>hi</p>')
  const text = moderationText({ html: '<div></div>', js: 'el.textContent = "Buy followers now"; const x = `<b>tpl</b>`; let y = \'no\'' })
  assert.match(text, /Buy followers now/)
  assert.match(text, /&lt;b&gt;tpl&lt;\/b&gt;/, 'script strings are escaped, not parsed as HTML')
  assert.doesNotMatch(text, / no$/, 'very short strings are skipped')
})

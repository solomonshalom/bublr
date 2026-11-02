import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseDocument } from 'htmlparser2'

import { domToMarkdown } from '../../src/lib/html-to-markdown.js'
import { createZip } from '../../src/lib/zip.js'
import { buildExportFiles } from '../../src/lib/export-posts.js'

// Make htmlparser2's tree look like the browser DOM the converter expects
function adapt(node) {
  if (node.type === 'text') {
    return { nodeType: 3, nodeName: '#text', textContent: node.data, childNodes: [] }
  }
  const childNodes = (node.children || []).map(adapt)
  const textContent = () => childNodes.map(c => (typeof c.textContent === 'function' ? c.textContent() : c.textContent)).join('')
  return {
    nodeType: node.type === 'root' ? 9 : 1,
    nodeName: (node.name || '#document').toUpperCase(),
    childNodes,
    getAttribute: key => (node.attribs && key in node.attribs ? node.attribs[key] : null),
    get textContent() {
      return textContent()
    },
  }
}
const parse = html => adapt(parseDocument(html || '', { decodeEntities: true }))
const md = html => domToMarkdown(parse(html), { parse })
const text = html => parse(html).textContent

test('paragraphs, headings and inline marks', () => {
  assert.equal(
    md('<h1>Title</h1><p>Hello <strong>bold</strong>, <em>italic</em>, <s>gone</s>, <u>under</u> and <code>x()</code>.</p><h2>Two</h2>'),
    '# Title\n\nHello **bold**, *italic*, ~~gone~~, <u>under</u> and `x()`.\n\n## Two\n'
  )
})

test('links, images and escaping', () => {
  assert.equal(
    md('<p>See <a href="https://bublr.life">Bublr</a> and snake_case *stars*</p><img src="https://x/y.png" alt="A pic">'),
    'See [Bublr](https://bublr.life) and snake\\_case \\*stars\\*\n\n![A pic](https://x/y.png)\n'
  )
})

test('nested lists and task lists', () => {
  assert.equal(
    md('<ul><li><p>One</p><ul><li><p>Inner</p></li></ul></li><li><p>Two</p></li></ul><ol><li><p>First</p></li><li><p>Second</p></li></ol>'),
    '- One\n  - Inner\n- Two\n\n1. First\n2. Second\n'
  )
  assert.equal(
    md('<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Done</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Todo</p></div></li></ul>'),
    '- [x] Done\n- [ ] Todo\n'
  )
})

test('quotes, code blocks and rules', () => {
  assert.equal(
    md('<blockquote><p>Quoted</p><p>Twice</p></blockquote><pre><code class="language-js">const a = 1\nconsole.log(a)</code></pre><hr><p>After</p>'),
    '> Quoted\n>\n> Twice\n\n```js\nconst a = 1\nconsole.log(a)\n```\n\n---\n\nAfter\n'
  )
})

test('callouts become quoted notes with their pop-up body', () => {
  const html = `<p>Before</p><span data-type="callout" data-title="Note" data-content="&lt;p&gt;Hidden &lt;strong&gt;bit&lt;/strong&gt;&lt;/p&gt;"><button class="callout-trigger"><span class="callout-title">Note</span></button></span><p>After</p>`
  assert.equal(md(html), 'Before\n\n> **Note**\n>\n> Hidden **bit**\n\nAfter\n')
})

test('empty content', () => {
  assert.equal(md(''), '\n')
})

test('createZip makes a valid archive (checked by unzip and Python)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bublr-zip-'))
  const file = path.join(dir, 'out.zip')
  const bytes = createZip([
    { name: 'folder/hello.md', data: '# Hello ✨\n' },
    { name: 'folder/data.json', data: JSON.stringify({ a: 1 }) },
    { name: 'folder/bin', data: new Uint8Array([0, 1, 2, 255]) },
  ])
  fs.writeFileSync(file, bytes)

  const listing = execFileSync('unzip', ['-l', file]).toString()
  assert.match(listing, /folder\/hello\.md/)
  assert.match(listing, /3 files/)
  execFileSync('unzip', ['-tq', file]) // throws on CRC errors

  const py = execFileSync('python3', [
    '-c',
    'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(z.read("folder/hello.md").decode())',
    file,
  ]).toString()
  assert.equal(py, '# Hello ✨\n\n')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('buildExportFiles writes Markdown with front matter, a README and a JSON copy', () => {
  const now = new Date('2026-11-02T10:00:00Z')
  const posts = [
    { id: 'p1', title: 'Hello &amp; welcome', slug: 'hello', published: true, excerpt: '<b>Short</b>', content: '<p>Body</p>', lastEdited: { toDate: () => new Date('2026-10-01T00:00:00Z') } },
    { id: 'p2', title: '', slug: 'hello', published: false, content: '<p>Draft</p>', lastEdited: { seconds: 1767225600 } },
    { id: 'p3', title: 'Weird / slug', slug: '', published: false, content: '' },
  ]
  const { folder, files } = buildExportFiles({ user: { name: 'ada', displayName: 'Ada' }, posts, toMarkdown: md, toText: text, now })

  assert.equal(folder, 'bublr-ada-2026-11-02')
  const names = files.map(f => f.name)
  assert.deepEqual(names, [
    'bublr-ada-2026-11-02/README.md',
    'bublr-ada-2026-11-02/posts/hello.md',
    'bublr-ada-2026-11-02/posts/hello-2.md',
    'bublr-ada-2026-11-02/posts/p3.md',
    'bublr-ada-2026-11-02/bublr-export.json',
  ])

  const published = files.find(f => f.name.endsWith('/posts/hello.md')).data
  assert.match(published, /^---\ntitle: "Hello & welcome"\ndate: 2026-10-01T00:00:00.000Z\nslug: "hello"\ndraft: false\ndescription: "Short"\ncanonical_url: https:\/\/bublr.life\/ada\/hello\n---\n\nBody\n$/)

  const draft = files.find(f => f.name.endsWith('/posts/hello-2.md')).data
  assert.match(draft, /title: "Untitled"/)
  assert.match(draft, /draft: true/)
  assert.doesNotMatch(draft, /canonical_url/)

  const json = JSON.parse(files.at(-1).data)
  assert.equal(json.posts.length, 3)
  assert.equal(json.posts.find(p => p.id === 'p1').html, '<p>Body</p>')
  assert.equal(json.profile.url, 'https://bublr.life/ada')
  assert.match(files[0].data, /3 posts \(1 published, 2 drafts\)/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseChangelog, parseInline } from '../../src/lib/changelog.js'

test('parses entries newest first with title, date, headings, bullets', () => {
  const md = '# A (1 Jan)\nintro text\nmore\n\n## Added\n- one\n- **two**\n\n# B (2 Feb)\nhi\n'
  const e = parseChangelog(md)
  assert.deepEqual(e.map(x => x.title), ['B', 'A'])
  assert.equal(e[1].date, '1 Jan')
  assert.deepEqual(e[1].blocks[0], { type: 'p', text: 'intro text more' })
  assert.deepEqual(e[1].blocks[1], { type: 'h', text: 'Added' })
  assert.deepEqual(e[1].blocks[2].items, ['one', '**two**'])
})

test('every release in changelog.md is parsed', () => {
  const md = fs.readFileSync(new URL('../../changelog.md', import.meta.url), 'utf8')
  const headings = md.split('\n').filter(l => /^# /.test(l)).length
  assert.equal(parseChangelog(md).length, headings)
})

test('unsafe links are rendered as plain text', () => {
  const t = parseInline('[x](javascript:alert(1)) [ok](/docs) [y](https://a.b)')
  assert.ok(!t.some(k => k.type === 'link' && k.href.startsWith('javascript')))
  assert.equal(t.filter(k => k.type === 'link').length, 2)
})

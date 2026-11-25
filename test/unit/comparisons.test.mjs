// The comparison pages are public claims about other companies: every one
// must be complete, dated, sourced and search-friendly.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { PLATFORMS, ROWS, BUBLR, KINDS, COMPARE_UPDATED, faqsFor } = await import('../../src/lib/comparisons.js')
const { isReservedUsername } = await import('../../src/lib/reserved-usernames.js')

test('compare: every platform fills every row, with a known verdict', () => {
  const verdicts = new Set(['yes', 'partial', 'no', 'na'])
  for (const row of ROWS) assert.ok(BUBLR[row.key]?.text, `Bublr ${row.key}`)
  for (const p of PLATFORMS) {
    for (const row of ROWS) {
      const value = p.values[row.key]
      assert.ok(value?.text, `${p.slug} is missing ${row.key}`)
      assert.ok(verdicts.has(value.verdict), `${p.slug} ${row.key} verdict`)
    }
  }
})

test('compare: pages are unique, sourced and fit search snippets', () => {
  const slugs = new Set()
  for (const p of PLATFORMS) {
    assert.match(p.slug, /^[a-z0-9-]+$/)
    assert.ok(!slugs.has(p.slug), `duplicate ${p.slug}`)
    slugs.add(p.slug)
    assert.ok(KINDS.includes(p.kind), `${p.slug} kind`)
    assert.ok(p.metaDescription.length <= 160, `${p.slug} meta description is ${p.metaDescription.length} chars`)
    assert.ok(p.sources.length >= 1 && p.sources.every(s => /^https:\/\//.test(s.url)), `${p.slug} sources`)
    assert.ok(p.whyBublr.length >= 3 && p.whenThem && p.moving && p.faqAlternative, `${p.slug} copy`)
    assert.ok(faqsFor(p).every(f => f.q && f.a), `${p.slug} faqs`)
  }
  assert.ok(PLATFORMS.length >= 18)
  assert.match(COMPARE_UPDATED, /^\d{4}-\d{2}-\d{2}$/)
})

test('compare: the page path is reserved', () => {
  assert.equal(isReservedUsername('compare'), true)
})

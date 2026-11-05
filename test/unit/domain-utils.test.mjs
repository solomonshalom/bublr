import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSubdomain, subdomainLabel } from '../../src/lib/domain-utils.js'

test('root domains need an A record, including two-part endings', () => {
  for (const d of ['example.com', 'example.co.uk', 'Example.com.au.', 'bublr.life']) {
    assert.equal(isSubdomain(d), false, d)
    assert.equal(subdomainLabel(d), '', d)
  }
})

test('subdomains need a CNAME and keep every extra label', () => {
  assert.equal(isSubdomain('blog.example.com'), true)
  assert.equal(subdomainLabel('blog.example.com'), 'blog')
  assert.equal(isSubdomain('blog.example.co.uk'), true)
  assert.equal(subdomainLabel('blog.example.co.uk'), 'blog')
  assert.equal(subdomainLabel('a.b.example.com'), 'a.b')
})

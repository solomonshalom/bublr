import test from 'node:test'
import assert from 'node:assert/strict'
import { htmlToText } from '../../src/lib/html-to-text.js'

test('turns post HTML into plain text', () => {
  assert.equal(htmlToText('<p>Hi <b>there</b></p>', { wordwrap: false }), 'Hi there')
  assert.equal(htmlToText('<h2>Title</h2><p>Body</p>', { wordwrap: false }), 'TITLE\n\nBody')
})

test('a post field that is not a string never throws', () => {
  // Real posts have these: a missing excerpt, a title saved as a number through
  // the API. The package itself throws on anything but a string.
  assert.equal(htmlToText(undefined), '')
  assert.equal(htmlToText(null), '')
  assert.equal(htmlToText(''), '')
  assert.equal(htmlToText(0), '')
  assert.equal(htmlToText(2026), '2026')
  assert.equal(htmlToText(true), 'true')
  assert.equal(htmlToText(['<p>a</p>']), 'a')
  assert.equal(typeof htmlToText({ seconds: 1 }), 'string')
  assert.equal(typeof htmlToText(new Date(0)), 'string')
})

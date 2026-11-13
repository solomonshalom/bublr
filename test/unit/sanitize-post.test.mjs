import { test } from 'node:test'
import assert from 'node:assert/strict'

import { sanitizePostHtml } from '../../src/lib/sanitize-post.js'

// HTML exactly as the TipTap editor produces it
const CALLOUT = `<span data-dot-color="#4D96FF" data-title="Heads up" data-content="&lt;p&gt;Hidden &lt;strong&gt;detail&lt;/strong&gt;&lt;/p&gt;" data-type="callout" class="tiptap-callout"><button class="callout-trigger"><span class="callout-dot" style="background-color: #4D96FF"></span><span class="callout-title">Heads up</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="callout-icon"><path d="M18 13v6a2 2 0 0 1-2 2H5"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></button></span>`
const TASKS = `<ul data-type="taskList" class="tiptap-task-list"><li data-checked="true" data-type="taskItem" class="tiptap-task-item"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Done</p></div></li><li data-checked="false" data-type="taskItem" class="tiptap-task-item"><label><input type="checkbox"><span></span></label><div><p>Todo</p></div></li></ul>`

test('keeps pop-up callouts working (attributes, trigger class, icon)', () => {
  const out = sanitizePostHtml(CALLOUT)
  assert.match(out, /data-type="callout"/)
  assert.match(out, /data-title="Heads up"/)
  assert.match(out, /data-dot-color="#4D96FF"/)
  assert.match(out, /class="callout-trigger"/)
  assert.match(out, /<button type="button" class="callout-trigger">/)
  assert.match(out, /style="background-color:#4D96FF"/)
  assert.match(out, /viewBox="0 0 24 24"/)
  assert.match(out, /data-content="&lt;p&gt;Hidden &lt;strong&gt;detail&lt;\/strong&gt;&lt;\/p&gt;"/)
})

test('keeps task lists with read-only checkboxes', () => {
  const out = sanitizePostHtml(TASKS)
  assert.match(out, /data-type="taskList"/)
  assert.match(out, /data-checked="true"/)
  assert.match(out, /<input type="checkbox" disabled="disabled" checked="checked" \/>/)
  assert.match(out, /<input type="checkbox" disabled="disabled" \/>/)
})

test('keeps highlight colours, code languages and editor classes', () => {
  const out = sanitizePostHtml(
    '<p><mark data-color="#fef08a" style="background-color: #fef08a; color: inherit" class="tiptap-highlight">hi</mark></p>' +
      '<pre><code class="language-js">let a = 1</code></pre><img class="tiptap-image" src="https://res.cloudinary.com/x/y.png" alt="A">'
  )
  assert.match(out, /style="background-color:#fef08a;color:inherit"/)
  assert.match(out, /class="language-js"/)
  assert.match(out, /<img class="tiptap-image" src="https:\/\/res.cloudinary.com\/x\/y.png" alt="A" \/>/)
})

test('strips scripts, event handlers and javascript: links', () => {
  const out = sanitizePostHtml(
    '<script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a>' +
      '<p onclick="alert(1)">p</p><iframe src="https://evil.example"></iframe><svg onload="alert(1)"><path d="M0 0"></path></svg>' +
      '<p ONCLICK="alert(1)" STYLE="color:red">caps</p>'
  )
  assert.doesNotMatch(out, /script|onerror|onclick|onload|javascript:|iframe/i)
  assert.doesNotMatch(out, /STYLE|ONCLICK/)
})

test('sanitizes HTML hidden inside a callout body', () => {
  const evil = `<span data-type="callout" data-title="x" data-content="&lt;img src=x onerror=alert(1)&gt;&lt;script&gt;alert(2)&lt;/script&gt;&lt;p&gt;ok&lt;/p&gt;"></span>`
  const out = sanitizePostHtml(evil)
  assert.doesNotMatch(out, /onerror|script/i)
  assert.match(out, /&lt;p&gt;ok&lt;\/p&gt;/)
})

test('drops unsafe callout colours and dangerous styles', () => {
  const out = sanitizePostHtml(
    '<span data-type="callout" data-dot-color="red;background:url(javascript:x)"></span>' +
      '<mark style="background-image:url(javascript:alert(1))">x</mark>' +
      '<span style="position:fixed;top:0">overlay</span>'
  )
  assert.doesNotMatch(out, /javascript|position|background-image/)
  assert.doesNotMatch(out, /data-dot-color/)
})

test('keeps the callout dot colour however the editor wrote it', () => {
  const dot = style => `<span data-type="callout" data-dot-color="#cf52f2" class="tiptap-callout"><button class="callout-trigger"><span class="callout-dot" style="${style}"></span></button></span>`

  // Tiptap 2 saved the hex it was given; Tiptap 3 saves the browser's version
  assert.match(sanitizePostHtml(dot('background-color: #cf52f2')), /class="callout-dot" style="background-color:#cf52f2"/)
  assert.match(sanitizePostHtml(dot('background-color: rgb(207, 82, 242);')), /class="callout-dot" style="background-color:rgb\(207, 82, 242\)"/)
  assert.match(sanitizePostHtml(dot('background-color: rgba(207, 82, 242, 0.5);')), /style="background-color:rgba\(207, 82, 242, 0\.5\)"/)

  // ...and still nothing that isn't a plain colour
  for (const style of [
    'background-color: rgb(1, 2, 3) url(javascript:alert(1))',
    'background-color: rgb(1, 2, expression(alert(1)))',
    'background-color: red',
    'background: rgb(1, 2, 3)',
    'background-color: rgb(1, 2, 3); position: fixed',
  ]) {
    const out = sanitizePostHtml(dot(style))
    assert.doesNotMatch(out, /javascript|expression|position|red|background:/, style)
  }
})

test('only checkbox inputs survive, and never as form controls', () => {
  const out = sanitizePostHtml('<input type="text" value="phish"><input type="password"><input type="checkbox" checked>')
  assert.doesNotMatch(out, /text|password|phish/)
  assert.match(out, /type="checkbox" disabled="disabled" checked="checked"/)
})

test('links opening a new tab get noopener', () => {
  const out = sanitizePostHtml('<a href="https://example.com" target="_blank" rel="nofollow">x</a>')
  assert.match(out, /rel="nofollow ugc noopener noreferrer"/)
})

test('every post link is marked nofollow ugc (no SEO payoff for spam)', () => {
  const out = sanitizePostHtml('<p><a href="https://casino.example">cheap</a> <a href="https://x.example" rel="dofollow">y</a></p>')
  assert.equal((out.match(/rel="[^"]*nofollow[^"]*ugc[^"]*"/g) || []).length, 2)
})

test('plain spans and divs lose callout-only attributes', () => {
  const out = sanitizePostHtml('<span data-content="&lt;b&gt;x&lt;/b&gt;" data-title="t">a</span><div data-dot-color="#fff">b</div>')
  assert.doesNotMatch(out, /data-content|data-title|data-dot-color/)
})

test('handles empty input', () => {
  assert.equal(sanitizePostHtml(''), '')
  assert.equal(sanitizePostHtml(null), '')
  assert.equal(sanitizePostHtml(undefined), '')
})

test('gives headings unique ids and a share link; ignores writer-supplied ids', () => {
  const out = sanitizePostHtml('<h2 id="evil">Why I write</h2><h2>Why I write</h2><h3>Café &amp; Tea</h3><h2>!!!</h2><p>text</p>')
  assert.match(out, /<h2 id="why-i-write">Why I write<a class="heading-anchor" href="#why-i-write"/)
  assert.match(out, /<h2 id="why-i-write-2">/)
  assert.match(out, /<h3 id="cafe-tea">/)
  assert.doesNotMatch(out, /evil/)
  assert.match(out, /<h2>!!!<\/h2>/)
})

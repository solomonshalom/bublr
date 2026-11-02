// Small escaping helpers for the places where we build HTML or inline
// <script> content by hand.

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Escape text for use inside HTML element content or a quoted attribute. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch])
}

/**
 * Serialize structured data for <script type="application/ld+json">.
 * JSON.stringify leaves `<` alone, so a post containing "</script>" could
 * close the tag early and inject markup. Escaping <, > and & as \u sequences
 * keeps the JSON identical for parsers while making it inert in HTML.
 */
export function safeJsonLd(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

// Tells apart "example.com" (needs an A record) from "blog.example.com"
// (needs a CNAME). Counting dots isn't enough: "example.co.uk" has three
// labels but is still a root domain. We avoid a full public-suffix dependency
// and list the common two-part endings instead.

const TWO_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk', 'ltd.uk', 'plc.uk', 'net.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'id.au',
  'co.nz', 'org.nz', 'net.nz', 'ac.nz',
  'co.in', 'net.in', 'org.in', 'firm.in', 'gen.in', 'ind.in', 'ac.in',
  'co.za', 'org.za', 'net.za', 'web.za',
  'co.jp', 'or.jp', 'ne.jp', 'ac.jp',
  'co.kr', 'or.kr', 'ne.kr',
  'com.br', 'net.br', 'org.br',
  'com.mx', 'org.mx', 'com.ar', 'com.co', 'com.pe', 'com.ve',
  'com.cn', 'net.cn', 'org.cn',
  'com.hk', 'com.tw', 'com.sg', 'com.my', 'com.ph', 'com.vn',
  'com.tr', 'com.ua', 'com.pl', 'com.ng', 'com.eg', 'com.pk', 'com.bd',
  'co.id', 'co.il', 'co.th', 'co.ke', 'co.ug', 'co.tz', 'co.zw',
])

export function normalizeDomain(domain) {
  return String(domain || '').trim().toLowerCase().replace(/\.$/, '')
}

// Number of labels that make up the registrable domain: 3 for example.co.uk, 2 for example.com.
function registrableLabelCount(labels) {
  const lastTwo = labels.slice(-2).join('.')
  return TWO_PART_SUFFIXES.has(lastTwo) ? 3 : 2
}

export function isSubdomain(domain) {
  const labels = normalizeDomain(domain).split('.').filter(Boolean)
  return labels.length > registrableLabelCount(labels)
}

// "blog.example.com" -> "blog", "a.b.example.co.uk" -> "a.b", "example.com" -> ""
export function subdomainLabel(domain) {
  const labels = normalizeDomain(domain).split('.').filter(Boolean)
  return labels.slice(0, Math.max(0, labels.length - registrableLabelCount(labels))).join('.')
}

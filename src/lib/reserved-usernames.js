// Usernames that would collide with Bublr's own pages. A profile lives at
// bublr.life/<username>, so a writer called "explore" or "about" could never
// be reached: Next.js serves the built-in page first. Only "dashboard" used to
// be blocked.
export const RESERVED_USERNAMES = new Set([
  // existing top-level routes
  'about',
  'api',
  'atom',
  'changelog',
  'comeback',
  'dashboard',
  'docs',
  'explore',
  'feed',
  'for-sale',
  'privacy',
  'signup',
  'sitemap',
  'terms',
  '404',
  '500',
  // static asset folders and likely future pages
  'images',
  'static',
  'public',
  'admin',
  'login',
  'logout',
  'settings',
  'help',
  'support',
  'blog',
  'bublr',
  'new',
  'write',
])

export function isReservedUsername(name) {
  return RESERVED_USERNAMES.has(String(name || '').trim().toLowerCase())
}

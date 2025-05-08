/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://bublr.life',
  generateRobotsTxt: false, // We have a custom robots.txt
  exclude: ['/dashboard', '/dashboard/*'],
  generateIndexSitemap: false,
  outDir: 'public',
}
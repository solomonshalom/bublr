// Platform configurations for content import
// Each platform defines how to fetch and parse content via RSS or API

export const PLATFORMS = {
  medium: {
    id: 'medium',
    name: 'Medium',
    color: '#000000',
    description: 'Import your Medium articles',
    placeholder: '@username',
    getRssUrl: (username) => {
      const cleanUsername = username.replace(/^@/, '').trim()
      return `https://medium.com/feed/@${cleanUsername}`
    },
    validateInput: (input) => {
      const cleaned = input.replace(/^@/, '').trim()
      return cleaned.length > 0 && /^[a-zA-Z0-9._-]+$/.test(cleaned)
    },
    parseUsername: (input) => input.replace(/^@/, '').trim(),
  },

  substack: {
    id: 'substack',
    name: 'Substack',
    color: '#FF6719',
    description: 'Import your Substack newsletter posts',
    placeholder: 'newsletter-name (from newsletter-name.substack.com)',
    getRssUrl: (username) => {
      const cleaned = username.replace(/\.substack\.com.*$/, '').trim()
      return `https://${cleaned}.substack.com/feed`
    },
    validateInput: (input) => {
      const cleaned = input.replace(/\.substack\.com.*$/, '').trim()
      return cleaned.length > 0 && /^[a-zA-Z0-9-]+$/.test(cleaned)
    },
    parseUsername: (input) => input.replace(/\.substack\.com.*$/, '').trim(),
  },

  blogger: {
    id: 'blogger',
    name: 'Blogger',
    color: '#FF5722',
    description: 'Import your Blogger/Blogspot posts',
    placeholder: 'blogname (from blogname.blogspot.com)',
    getRssUrl: (username) => {
      // Support both blogname.blogspot.com and full URLs
      let cleaned = username.trim()
      cleaned = cleaned.replace(/^https?:\/\//, '')
      cleaned = cleaned.replace(/\.blogspot\.com.*$/, '')
      cleaned = cleaned.replace(/\/$/, '')
      return `https://${cleaned}.blogspot.com/feeds/posts/default?alt=rss&max-results=50`
    },
    validateInput: (input) => {
      let cleaned = input.trim()
      cleaned = cleaned.replace(/^https?:\/\//, '')
      cleaned = cleaned.replace(/\.blogspot\.com.*$/, '')
      return cleaned.length > 0 && /^[a-zA-Z0-9-]+$/.test(cleaned)
    },
    parseUsername: (input) => {
      let cleaned = input.trim()
      cleaned = cleaned.replace(/^https?:\/\//, '')
      cleaned = cleaned.replace(/\.blogspot\.com.*$/, '')
      return cleaned
    },
  },

  hashnode: {
    id: 'hashnode',
    name: 'Hashnode',
    color: '#2962FF',
    description: 'Import your Hashnode blog posts',
    placeholder: 'username (from username.hashnode.dev)',
    getRssUrl: (username) => {
      const cleaned = username.replace(/\.hashnode\.dev.*$/, '').trim()
      return `https://${cleaned}.hashnode.dev/rss.xml`
    },
    validateInput: (input) => {
      const cleaned = input.replace(/\.hashnode\.dev.*$/, '').trim()
      return cleaned.length > 0 && /^[a-zA-Z0-9-]+$/.test(cleaned)
    },
    parseUsername: (input) => input.replace(/\.hashnode\.dev.*$/, '').trim(),
  },

  wordpress: {
    id: 'wordpress',
    name: 'WordPress',
    color: '#21759B',
    description: 'Import from WordPress.com blogs',
    placeholder: 'blogname (from blogname.wordpress.com)',
    getRssUrl: (username) => {
      let cleaned = username.trim()
      cleaned = cleaned.replace(/^https?:\/\//, '')
      cleaned = cleaned.replace(/\.wordpress\.com.*$/, '')
      return `https://${cleaned}.wordpress.com/feed/`
    },
    validateInput: (input) => {
      let cleaned = input.trim()
      cleaned = cleaned.replace(/^https?:\/\//, '')
      cleaned = cleaned.replace(/\.wordpress\.com.*$/, '')
      return cleaned.length > 0 && /^[a-zA-Z0-9-]+$/.test(cleaned)
    },
    parseUsername: (input) => {
      let cleaned = input.trim()
      cleaned = cleaned.replace(/^https?:\/\//, '')
      cleaned = cleaned.replace(/\.wordpress\.com.*$/, '')
      return cleaned
    },
  },

  ghost: {
    id: 'ghost',
    name: 'Ghost',
    color: '#15171A',
    description: 'Import from Ghost blogs (requires full URL)',
    placeholder: 'Full blog URL (e.g., blog.example.com)',
    getRssUrl: (url) => {
      let cleaned = url.trim()
      cleaned = cleaned.replace(/^https?:\/\//, '')
      cleaned = cleaned.replace(/\/$/, '')
      return `https://${cleaned}/rss/`
    },
    validateInput: (input) => {
      const cleaned = input.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
      return cleaned.length > 0 && cleaned.includes('.')
    },
    parseUsername: (input) => input.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
  },

  devto: {
    id: 'devto',
    name: 'DEV.to',
    color: '#0A0A0A',
    description: 'Import your DEV.to articles',
    placeholder: 'username',
    getRssUrl: (username) => {
      const cleaned = username.replace(/^@/, '').trim()
      return `https://dev.to/feed/${cleaned}`
    },
    validateInput: (input) => {
      const cleaned = input.replace(/^@/, '').trim()
      return cleaned.length > 0 && /^[a-zA-Z0-9_]+$/.test(cleaned)
    },
    parseUsername: (input) => input.replace(/^@/, '').trim(),
  },
}

// Get platform by ID
export function getPlatform(platformId) {
  return PLATFORMS[platformId] || null
}

// Get all platform IDs
export function getAllPlatformIds() {
  return Object.keys(PLATFORMS)
}

// Get platforms as array for UI
export function getPlatformsArray() {
  return Object.values(PLATFORMS)
}

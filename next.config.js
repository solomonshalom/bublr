const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
})

module.exports = withPWA({
  async redirects() {
    return [
      {
        source: '/@:username',
        destination: '/:username',
        permanent: true,
      },
    ]
  },
  reactStrictMode: true,
})

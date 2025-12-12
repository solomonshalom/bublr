module.exports = {
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
  // Enable features for improved SEO and performance
  experimental: {
    optimizeFonts: true
  },
  // Configure image optimization
  images: {
    domains: ['lh3.googleusercontent.com', 'avatars.githubusercontent.com', 'api.dicebear.com']
  },
  // Enable compression for better performance
  compress: true,
  // Add poweredByHeader false to remove X-Powered-By header for security
  poweredByHeader: false,
  // Configure headers for better SEO and security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          // Content Security Policy - E-E-A-T security signal
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cloud.umami.is https://fonts.googleapis.com https://fonts.bunny.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.bunny.net",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' https://fonts.gstatic.com https://fonts.bunny.net",
              "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com https://api.dicebear.com https://cloud.umami.is https://api.imgbb.com https://api.groq.com https://api.resend.com https://api.polar.sh https://api.vercel.com",
              "frame-src 'self' https://*.firebaseapp.com",
              "media-src 'self' https:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests"
            ].join('; ')
          },
          // Permissions Policy - limit browser features for security
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          // Strict Transport Security - force HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
        ],
      },
    ]
  },
  // Custom domain support
  trailingSlash: false,
}
module.exports = {
  async redirects() {
    return [
      {
        source: '/@:username',
        destination: '/:username',
        permanent: true,
      },
      // Old links land on the relaunch announcement
      {
        source: '/for-sale',
        destination: '/comeback',
        permanent: false,
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
    // Shared by every response, including the Profile HTML frame
    const baseSecurity = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
    ]
    return [
      // Writers' Profile HTML (/api/profile-frame/*) and its editor preview
      // (/api/profile-preview) are framed by the profile page and carry their
      // own sandboxing CSP (lib/profile-code.js). The site-wide policy below
      // would forbid framing them, and two CSP headers both apply, so those
      // two paths are left out of it.
      {
        source: '/api/profile-frame/:path*',
        headers: [...baseSecurity, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      {
        source: '/api/profile-preview',
        headers: [...baseSecurity, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      {
        source: '/((?!api/profile-frame/|api/profile-preview$).*)',
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cloud.umami.is https://fonts.googleapis.com https://fonts.bunny.net https://apis.google.com https://accounts.google.com https://*.firebaseapp.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.bunny.net",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' https://fonts.gstatic.com https://fonts.bunny.net",
              // api.cloudinary.com: direct image uploads from the editor/profile
              // *.umami.is: the analytics script reports to gateway.umami.is
              "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com https://api.dicebear.com https://cloud.umami.is https://*.umami.is https://api.cloudinary.com https://api.imgbb.com https://api.groq.com https://api.resend.com https://api.vercel.com",
              "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
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
            // microphone=(self): the editor's voice input records on our own pages
            value: 'camera=(), microphone=(self), geolocation=(), interest-cohort=()'
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
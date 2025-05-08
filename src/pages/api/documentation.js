export default function handler(req, res) {
  res.status(200).json({
    title: 'Bublr API Documentation',
    version: 'v1',
    description: 'API for accessing and publishing content on Bublr',
    baseUrl: 'https://bublr.life/api',
    endpoints: [
      {
        path: '/posts',
        method: 'GET',
        description: 'Get a list of posts (no API key required)',
        parameters: [
          { name: 'limit', type: 'number', description: 'Number of posts to return (default: 10)' },
          { name: 'offset', type: 'number', description: 'Number of posts to skip (default: 0)' },
          { name: 'published', type: 'boolean', description: 'Filter by published status (default: true)' }
        ],
        exampleUrl: 'https://bublr.life/api/posts?limit=5&offset=0&published=true',
        response: {
          posts: 'Array of post objects',
          pagination: {
            limit: 'Number of posts requested',
            offset: 'Number of posts skipped',
            total: 'Total number of posts returned'
          }
        }
      },
      {
        path: '/posts/:id',
        method: 'GET',
        description: 'Get a specific post by ID (no API key required)',
        parameters: [
          { name: 'id', type: 'string', description: 'Post ID' }
        ],
        exampleUrl: 'https://bublr.life/api/posts/abc123',
        response: 'Post object'
      },
      {
        path: '/profiles',
        method: 'GET',
        description: 'Get a list of user profiles (no API key required)',
        parameters: [
          { name: 'limit', type: 'number', description: 'Number of profiles to return (default: 10)' },
          { name: 'offset', type: 'number', description: 'Number of profiles to skip (default: 0)' }
        ],
        exampleUrl: 'https://bublr.life/api/profiles?limit=5&offset=0',
        response: {
          profiles: 'Array of profile objects',
          pagination: {
            limit: 'Number of profiles requested',
            offset: 'Number of profiles skipped',
            total: 'Total number of profiles returned'
          }
        }
      },
      {
        path: '/profiles/:id',
        method: 'GET',
        description: 'Get a specific user profile by ID (no API key required)',
        parameters: [
          { name: 'id', type: 'string', description: 'User ID' }
        ],
        exampleUrl: 'https://bublr.life/api/profiles/user123',
        response: 'Profile object with posts'
      },
      {
        path: '/user/:username',
        method: 'GET',
        description: 'Get a user profile by username',
        parameters: [
          { name: 'username', type: 'string', description: 'Username' }
        ],
        response: 'User profile object with posts'
      },
      {
        path: '/publish',
        method: 'POST',
        description: 'Publish a new post',
        authentication: 'Bearer token (API key) or query parameter (apiKey)',
        requestBody: {
          title: 'Post title (required)',
          content: 'Post content (required)',
          excerpt: 'Post excerpt (optional)',
          tags: 'Array of tags (optional)',
          published: 'Boolean, whether the post is published (default: true)',
          slug: 'Custom URL slug (optional, defaults to post ID)'
        },
        response: 'Created post object'
      },
      {
        path: '/auth/create-api-key',
        method: 'POST',
        description: 'Create a new API key for a user',
        requestBody: {
          userId: 'User ID (required)'
        },
        response: {
          apiKey: 'Generated API key'
        }
      }
    ]
  })
}
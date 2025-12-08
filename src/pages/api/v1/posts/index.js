import { authenticateApiKey, API_ERROR_CODES } from '../../../../lib/api-auth'
import firebase, { firestore } from '../../../../lib/firebase'

// Content size limits (in characters)
const LIMITS = {
  TITLE_MAX: 200,
  EXCERPT_MAX: 500,
  CONTENT_MAX: 500000, // ~500KB - generous but prevents abuse
  SLUG_MAX: 100
}

export default async function handler(req, res) {
  // Set CORS headers for API access
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Authenticate API key
  const auth = await authenticateApiKey(req.headers.authorization)

  if (!auth.success) {
    return res.status(401).json({
      error: auth.error,
      code: auth.code
    })
  }

  if (req.method === 'GET') {
    return handleGetPosts(req, res, auth)
  } else if (req.method === 'POST') {
    return handleCreatePost(req, res, auth)
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

// GET /api/v1/posts - List user's posts
async function handleGetPosts(req, res, auth) {
  try {
    const { published, limit = 50, offset = 0 } = req.query
    const parsedLimit = Math.min(parseInt(limit) || 50, 100) // Max 100 posts per request
    const parsedOffset = parseInt(offset) || 0

    // Get user's post IDs
    const userDoc = await firestore.collection('users').doc(auth.userId).get()
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userData = userDoc.data()
    const postIds = userData.posts || []

    if (postIds.length === 0) {
      return res.status(200).json({ posts: [], total: 0 })
    }

    // Fetch all posts
    const postPromises = postIds.map(id =>
      firestore.collection('posts').doc(id).get()
    )
    const postDocs = await Promise.all(postPromises)

    let posts = postDocs
      .filter(doc => doc.exists)
      .map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          slug: data.slug,
          title: data.title || '',
          excerpt: data.excerpt || '',
          published: data.published || false,
          lastEdited: data.lastEdited?._seconds
            ? new Date(data.lastEdited._seconds * 1000).toISOString()
            : data.lastEdited || null,
          createdAt: data.createdAt || null,
          dotColor: data.dotColor || null
        }
      })

    // Filter by published status if specified
    if (published !== undefined) {
      const publishedFilter = published === 'true'
      posts = posts.filter(p => p.published === publishedFilter)
    }

    // Sort by lastEdited (most recent first)
    posts.sort((a, b) => {
      const dateA = a.lastEdited ? new Date(a.lastEdited) : new Date(0)
      const dateB = b.lastEdited ? new Date(b.lastEdited) : new Date(0)
      return dateB - dateA
    })

    const total = posts.length

    // Apply pagination
    posts = posts.slice(parsedOffset, parsedOffset + parsedLimit)

    return res.status(200).json({
      posts,
      total,
      limit: parsedLimit,
      offset: parsedOffset
    })
  } catch (error) {
    console.error('API v1 posts list error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /api/v1/posts - Create a new post
async function handleCreatePost(req, res, auth) {
  try {
    const { title, excerpt, content, slug, published = false, dotColor } = req.body

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        error: 'Title is required',
        code: API_ERROR_CODES.INVALID_INPUT
      })
    }

    if (title.length > LIMITS.TITLE_MAX) {
      return res.status(400).json({
        error: `Title must be ${LIMITS.TITLE_MAX} characters or less`,
        code: API_ERROR_CODES.INVALID_INPUT
      })
    }

    if (excerpt && excerpt.length > LIMITS.EXCERPT_MAX) {
      return res.status(400).json({
        error: `Excerpt must be ${LIMITS.EXCERPT_MAX} characters or less`,
        code: API_ERROR_CODES.INVALID_INPUT
      })
    }

    // Content size limit to prevent abuse
    if (content && content.length > LIMITS.CONTENT_MAX) {
      return res.status(400).json({
        error: `Content exceeds maximum size of ${LIMITS.CONTENT_MAX} characters`,
        code: API_ERROR_CODES.INVALID_INPUT
      })
    }

    // Validate slug if provided
    let postSlug = slug
    if (postSlug) {
      if (postSlug.length > LIMITS.SLUG_MAX) {
        return res.status(400).json({
          error: `Slug must be ${LIMITS.SLUG_MAX} characters or less`,
          code: API_ERROR_CODES.INVALID_INPUT
        })
      }

      if (!/^[a-z0-9-]+$/i.test(postSlug)) {
        return res.status(400).json({
          error: 'Slug can only contain letters, numbers, and hyphens',
          code: API_ERROR_CODES.INVALID_INPUT
        })
      }

      // Check if slug already exists for this user
      const userDoc = await firestore.collection('users').doc(auth.userId).get()
      const userData = userDoc.data()
      const existingPostIds = userData.posts || []

      for (const postId of existingPostIds) {
        const existingPost = await firestore.collection('posts').doc(postId).get()
        if (existingPost.exists && existingPost.data().slug === postSlug) {
          return res.status(400).json({ error: 'A post with this slug already exists' })
        }
      }
    }

    // Validate dotColor if provided
    if (dotColor && !/^#[0-9A-Fa-f]{6}$/.test(dotColor)) {
      return res.status(400).json({ error: 'dotColor must be a valid hex color (e.g., #4D96FF)' })
    }

    // Create the post
    const now = new Date()
    const postData = {
      title: title.trim(),
      excerpt: excerpt?.trim() || '',
      content: content || '',
      author: auth.userId,
      published: Boolean(published),
      lastEdited: {
        _seconds: Math.floor(now.getTime() / 1000),
        _nanoseconds: 0
      },
      createdAt: now.getTime()
    }

    if (dotColor) {
      postData.dotColor = dotColor
    }

    // Add the post to Firestore
    const postRef = await firestore.collection('posts').add(postData)
    const postId = postRef.id

    // Set slug (use postId if not provided)
    postSlug = postSlug || postId
    await firestore.collection('posts').doc(postId).update({ slug: postSlug })

    // Add post ID to user's posts array
    await firestore.collection('users').doc(auth.userId).update({
      posts: firebase.firestore.FieldValue.arrayUnion(postId)
    })

    // If publishing, run moderation (similar to dashboard publish flow)
    if (published) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life'
        const moderationRes = await fetch(`${baseUrl}/api/posts/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId, publish: true })
        })
        const moderationResult = await moderationRes.json()

        if (moderationResult.moderated) {
          return res.status(200).json({
            success: true,
            post: {
              id: postId,
              slug: postSlug,
              published: false,
              moderated: true,
              moderationReason: moderationResult.reason
            },
            message: 'Post created but not published due to content moderation'
          })
        }
      } catch (moderationError) {
        console.error('Moderation error:', moderationError)
        // Continue without moderation if it fails
      }
    }

    return res.status(201).json({
      success: true,
      post: {
        id: postId,
        slug: postSlug,
        title: postData.title,
        excerpt: postData.excerpt,
        published: postData.published,
        createdAt: postData.createdAt
      },
      message: published ? 'Post created and published' : 'Post created as draft'
    })
  } catch (error) {
    console.error('API v1 create post error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

import { authenticateApiKey, API_ERROR_CODES } from '../../../../lib/api-auth'
import { firestore } from '../../../../lib/firebase'

// Content size limits (in characters)
const LIMITS = {
  TITLE_MAX: 200,
  EXCERPT_MAX: 500,
  CONTENT_MAX: 500000,
  SLUG_MAX: 100
}

export default async function handler(req, res) {
  // Set CORS headers for API access
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS')
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

  const { slug } = req.query

  if (!slug) {
    return res.status(400).json({ error: 'Missing slug parameter' })
  }

  if (req.method === 'GET') {
    return handleGetPost(req, res, auth, slug)
  } else if (req.method === 'PUT') {
    return handleUpdatePost(req, res, auth, slug)
  } else if (req.method === 'DELETE') {
    return handleDeletePost(req, res, auth, slug)
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

// Find post by slug for the authenticated user
async function findPostBySlug(userId, slug) {
  const userDoc = await firestore.collection('users').doc(userId).get()
  if (!userDoc.exists) {
    return null
  }

  const userData = userDoc.data()
  const postIds = userData.posts || []

  for (const postId of postIds) {
    const postDoc = await firestore.collection('posts').doc(postId).get()
    if (postDoc.exists && postDoc.data().slug === slug) {
      return { id: postDoc.id, ...postDoc.data() }
    }
  }

  return null
}

// GET /api/v1/posts/[slug] - Get a single post by slug
async function handleGetPost(req, res, auth, slug) {
  try {
    const post = await findPostBySlug(auth.userId, slug)

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    // Format the response
    const response = {
      id: post.id,
      slug: post.slug,
      title: post.title || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      published: post.published || false,
      lastEdited: post.lastEdited?._seconds
        ? new Date(post.lastEdited._seconds * 1000).toISOString()
        : post.lastEdited || null,
      createdAt: post.createdAt || null,
      dotColor: post.dotColor || null
    }

    return res.status(200).json({ post: response })
  } catch (error) {
    console.error('API v1 get post error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/v1/posts/[slug] - Update a post
async function handleUpdatePost(req, res, auth, slug) {
  try {
    const post = await findPostBySlug(auth.userId, slug)

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const { title, excerpt, content, published, dotColor, newSlug } = req.body
    const updateData = {}

    // Validate and set fields that are provided
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Title cannot be empty' })
      }
      if (title.length > 200) {
        return res.status(400).json({ error: 'Title must be 200 characters or less' })
      }
      updateData.title = title.trim()
    }

    if (excerpt !== undefined) {
      if (excerpt && excerpt.length > 500) {
        return res.status(400).json({ error: 'Excerpt must be 500 characters or less' })
      }
      updateData.excerpt = excerpt?.trim() || ''
    }

    if (content !== undefined) {
      updateData.content = content
    }

    if (dotColor !== undefined) {
      if (dotColor !== null && !/^#[0-9A-Fa-f]{6}$/.test(dotColor)) {
        return res.status(400).json({ error: 'dotColor must be a valid hex color (e.g., #4D96FF)' })
      }
      updateData.dotColor = dotColor
    }

    // Handle slug change
    if (newSlug !== undefined && newSlug !== slug) {
      if (!/^[a-z0-9-]+$/i.test(newSlug)) {
        return res.status(400).json({
          error: 'Slug can only contain letters, numbers, and hyphens'
        })
      }

      // Check if new slug already exists for this user
      const existingPost = await findPostBySlug(auth.userId, newSlug)
      if (existingPost && existingPost.id !== post.id) {
        return res.status(400).json({ error: 'A post with this slug already exists' })
      }

      updateData.slug = newSlug
    }

    // Handle publish state
    if (published !== undefined) {
      if (published && !post.published) {
        // Publishing for the first time - run moderation
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life'
          const moderationRes = await fetch(`${baseUrl}/api/posts/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId: post.id, publish: true })
          })
          const moderationResult = await moderationRes.json()

          if (moderationResult.moderated) {
            return res.status(200).json({
              success: true,
              post: { id: post.id, slug: updateData.slug || slug, published: false },
              moderated: true,
              moderationReason: moderationResult.reason,
              message: 'Post update saved but not published due to content moderation'
            })
          }
        } catch (moderationError) {
          console.error('Moderation error:', moderationError)
        }
      } else {
        updateData.published = Boolean(published)
      }
    }

    // Update lastEdited timestamp
    updateData.lastEdited = {
      _seconds: Math.floor(Date.now() / 1000),
      _nanoseconds: 0
    }

    // Apply updates
    if (Object.keys(updateData).length > 0) {
      await firestore.collection('posts').doc(post.id).update(updateData)
    }

    return res.status(200).json({
      success: true,
      post: {
        id: post.id,
        slug: updateData.slug || slug,
        title: updateData.title || post.title,
        excerpt: updateData.excerpt !== undefined ? updateData.excerpt : post.excerpt,
        published: updateData.published !== undefined ? updateData.published : post.published
      },
      message: 'Post updated successfully'
    })
  } catch (error) {
    console.error('API v1 update post error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /api/v1/posts/[slug] - Delete a post
async function handleDeletePost(req, res, auth, slug) {
  try {
    const post = await findPostBySlug(auth.userId, slug)

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    // Import firebase for FieldValue
    const firebase = (await import('../../../../lib/firebase')).default

    // Remove post from posts collection
    await firestore.collection('posts').doc(post.id).delete()

    // Remove post ID from user's posts array
    await firestore.collection('users').doc(auth.userId).update({
      posts: firebase.firestore.FieldValue.arrayRemove(post.id)
    })

    return res.status(200).json({
      success: true,
      message: 'Post deleted successfully'
    })
  } catch (error) {
    console.error('API v1 delete post error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

import Groq from 'groq-sdk'
import { htmlToText } from './html-to-text'
import { firestore } from './firebase'
import { notifySubscribersOfPost } from './newsletter-notify'

/**
 * Publishing a post, shared by the dashboard (/api/posts/publish) and the
 * public API (/api/v1/posts). Callers decide who may publish; this runs
 * moderation, flips `published`, and on the first successful publish tells
 * followers and emails newsletter subscribers.
 *
 * The public API used to reach this through an HTTP call to
 * /api/posts/publish. Calling it directly keeps API-published posts
 * moderated now that the dashboard route requires a signed-in writer.
 */

let groq = null
function groqClient() {
  // Created on first use so a missing key can't crash the route at import
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return groq
}

// Moderate content using Groq AI
export async function moderateContent(title, content) {
  // If no API key, skip moderation
  if (!process.env.GROQ_API_KEY) {
    console.warn('GROQ_API_KEY not set, skipping moderation')
    return { shouldUnpublish: false, reason: '', category: 'none' }
  }

  const textContent = htmlToText(content || '')
  const textTitle = htmlToText(title || '')

  // Skip moderation for very short content (likely drafts)
  if (textContent.length < 50 && textTitle.length < 10) {
    return { shouldUnpublish: false, reason: '', category: 'none' }
  }

  const prompt = `You are a content moderator for a writing platform. Analyze the following post and determine if it should be unpublished.

Title: ${textTitle}

Content: ${textContent.substring(0, 3000)}

Evaluate for:
1. Spam content (promotional, repetitive, meaningless text, excessive links)
2. NSFW content (explicit sexual content, graphic violence)
3. Hate speech or harassment
4. Scams or phishing attempts

Respond with ONLY a JSON object in this exact format:
{
  "shouldUnpublish": true/false,
  "reason": "brief explanation if shouldUnpublish is true, otherwise empty string",
  "category": "spam" | "nsfw" | "hate" | "scam" | "none"
}

Be strict about spam and NSFW content. Regular articles, stories, opinions (even controversial ones), and personal blogs should NOT be unpublished. Only unpublish genuinely problematic content.`

  try {
    const chatCompletion = await groqClient().chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.1,
      max_tokens: 200,
    })

    const response = chatCompletion.choices[0]?.message?.content || ''

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    return { shouldUnpublish: false, reason: '', category: 'none' }
  } catch (error) {
    console.error('Groq API error:', error)
    // On error, don't block publishing - fail open
    return { shouldUnpublish: false, reason: 'moderation_error', category: 'none' }
  }
}

async function notifyFollowers(postId, post) {
  const authorDoc = await firestore.collection('users').doc(post.author).get()
  if (!authorDoc.exists) return
  const authorData = authorDoc.data()
  const followers = authorData.followers || []
  if (followers.length === 0) return

  const notificationData = {
    type: 'new_post',
    actorId: post.author,
    actorName: authorData.displayName || authorData.name,
    actorPhoto: authorData.photo || `https://api.dicebear.com/7.x/initials/svg?seed=${authorData.name}`,
    postId,
    postTitle: post.title ? htmlToText(post.title).substring(0, 100) : 'Untitled',
    postSlug: post.slug,
    postAuthorName: authorData.name,
    message: `${authorData.displayName || authorData.name} published a new post`,
    metadata: {},
    read: false,
    createdAt: new Date(),
  }

  // Batched writes (max 500 per batch)
  const BATCH_SIZE = 500
  for (let i = 0; i < followers.length; i += BATCH_SIZE) {
    const batch = firestore.batch()
    followers.slice(i, i + BATCH_SIZE).forEach(followerId => {
      batch.set(firestore.collection('notifications').doc(), { ...notificationData, recipientId: followerId })
    })
    await batch.commit()
  }
}

/**
 * Publish (with moderation) or unpublish a post.
 * @param {{ postId: string, publish: boolean }} params
 * @returns {Promise<object>} the JSON body routes send back (always HTTP 200)
 */
export async function setPostPublished({ postId, publish }) {
  const postRef = firestore.collection('posts').doc(postId)
  const postDoc = await postRef.get()
  if (!postDoc.exists) {
    const error = new Error('Post not found')
    error.status = 404
    throw error
  }
  const post = postDoc.data()

  if (!publish) {
    await postRef.update({ published: false })
    return { success: true, published: false, message: 'Post unpublished' }
  }

  const moderationResult = await moderateContent(post.title, post.content)

  if (moderationResult.shouldUnpublish) {
    await postRef.update({
      published: false,
      moderationReason: moderationResult.reason,
      moderationCategory: moderationResult.category,
      moderatedAt: new Date().toISOString(),
    })
    return {
      success: false,
      published: false,
      moderated: true,
      reason: moderationResult.reason,
      category: moderationResult.category,
      message: `Post was not published due to content policy violation: ${moderationResult.reason}`,
    }
  }

  // Was it already announced? A successful publish before this one left
  // moderatedAt + category 'none'.
  const alreadyAnnounced =
    Boolean(post.announcedAt) || (Boolean(post.moderatedAt) && post.moderationCategory === 'none')

  await postRef.update({
    published: true,
    moderatedAt: new Date().toISOString(),
    moderationCategory: 'none',
  })

  if (!alreadyAnnounced) {
    try {
      await postRef.update({ announcedAt: new Date().toISOString() })
    } catch (markError) {
      console.error('Could not mark post as announced:', markError)
    }

    try {
      await notifyFollowers(postId, post)
    } catch (followerError) {
      // Don't fail the publish if follower notification fails
      console.error('Follower notification error:', followerError)
    }

    try {
      await notifySubscribersOfPost(postId)
    } catch (newsletterError) {
      // Don't fail the publish if the newsletter fails
      console.error('Newsletter notification error:', newsletterError)
    }
  }

  return { success: true, published: true, message: 'Post published successfully' }
}

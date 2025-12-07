import Groq from 'groq-sdk'
import { firestore } from '../../../lib/firebase'
import { htmlToText } from 'html-to-text'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

// Moderate content using Groq AI
async function moderateContent(title, content) {
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
    const chatCompletion = await groq.chat.completions.create({
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const { postId, publish } = req.body

  if (!postId) {
    return res.status(400).json({ error: { message: 'Missing postId' } })
  }

  try {
    const postRef = firestore.collection('posts').doc(postId)
    const postDoc = await postRef.get()

    if (!postDoc.exists) {
      return res.status(404).json({ error: { message: 'Post not found' } })
    }

    const post = postDoc.data()

    // If unpublishing (making draft), just do it directly
    if (!publish) {
      await postRef.update({ published: false })
      return res.status(200).json({
        success: true,
        published: false,
        message: 'Post unpublished',
      })
    }

    // If publishing, run moderation first
    const moderationResult = await moderateContent(post.title, post.content)

    if (moderationResult.shouldUnpublish) {
      // Don't publish, flag the content
      await postRef.update({
        published: false,
        moderationReason: moderationResult.reason,
        moderationCategory: moderationResult.category,
        moderatedAt: new Date().toISOString(),
      })

      return res.status(200).json({
        success: false,
        published: false,
        moderated: true,
        reason: moderationResult.reason,
        category: moderationResult.category,
        message: `Post was not published due to content policy violation: ${moderationResult.reason}`,
      })
    }

    // Content passed moderation, publish it
    await postRef.update({
      published: true,
      moderatedAt: new Date().toISOString(),
      moderationCategory: 'none',
    })

    // Send newsletter notifications to subscribers (fire and forget)
    // Only notify if this is a fresh publish (not re-publishing a draft)
    try {
      const authorId = post.author
      // Use absolute URL for the API call
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life'
      fetch(`${baseUrl}/api/newsletter/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, authorId }),
      }).catch(err => console.error('Newsletter notification error:', err))
    } catch (notifyError) {
      // Don't fail the publish if notification fails
      console.error('Newsletter notification setup error:', notifyError)
    }

    return res.status(200).json({
      success: true,
      published: true,
      message: 'Post published successfully',
    })
  } catch (error) {
    console.error('Publish error:', error)
    return res.status(500).json({ error: { message: 'Internal server error' } })
  }
}

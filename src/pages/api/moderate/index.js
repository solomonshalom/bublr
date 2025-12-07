import Groq from 'groq-sdk'
import { firestore } from '../../../lib/firebase'
import { htmlToText } from 'html-to-text'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

// Moderate content using Groq AI
async function moderateContent(title, content) {
  const textContent = htmlToText(content || '')
  const textTitle = htmlToText(title || '')

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
    // On error, don't unpublish - fail safe
    return { shouldUnpublish: false, reason: 'moderation_error', category: 'none' }
  }
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  // Verify secret key (set this in your environment variables)
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.MODERATION_SECRET_KEY}`) {
    return res.status(401).json({ error: { message: 'Unauthorized' } })
  }

  const { postId } = req.body

  if (!postId) {
    return res.status(400).json({ error: { message: 'Missing postId' } })
  }

  try {
    // Get the post
    const postRef = firestore.collection('posts').doc(postId)
    const postDoc = await postRef.get()

    if (!postDoc.exists) {
      return res.status(404).json({ error: { message: 'Post not found' } })
    }

    const post = postDoc.data()

    // Only moderate published posts
    if (!post.published) {
      return res.status(200).json({
        message: 'Post is not published, skipping moderation',
        moderated: false
      })
    }

    // Moderate the content
    const result = await moderateContent(post.title, post.content)

    if (result.shouldUnpublish) {
      // Unpublish the post (don't delete)
      await postRef.update({
        published: false,
        moderationReason: result.reason,
        moderationCategory: result.category,
        moderatedAt: new Date().toISOString(),
      })

      return res.status(200).json({
        message: 'Post unpublished due to content policy violation',
        moderated: true,
        reason: result.reason,
        category: result.category,
      })
    }

    return res.status(200).json({
      message: 'Post passed moderation',
      moderated: false,
      category: result.category,
    })
  } catch (error) {
    console.error('Moderation error:', error)
    return res.status(500).json({ error: { message: 'Internal server error' } })
  }
}

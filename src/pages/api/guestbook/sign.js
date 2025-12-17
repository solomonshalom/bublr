import Groq from 'groq-sdk'
import firebase from '../../../lib/firebase'
import { firestore } from '../../../lib/firebase'

// Only initialize Groq if API key is available
let groq = null
if (process.env.GROQ_API_KEY) {
  groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  })
}

// Rate limiting: Simple in-memory store (in production, use Redis)
const rateLimitStore = new Map()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5

function isRateLimited(ip) {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW

  // Clean old entries
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.timestamp < windowStart) {
      rateLimitStore.delete(key)
    }
  }

  const data = rateLimitStore.get(ip)
  if (!data) {
    rateLimitStore.set(ip, { count: 1, timestamp: now })
    return false
  }

  if (data.timestamp < windowStart) {
    rateLimitStore.set(ip, { count: 1, timestamp: now })
    return false
  }

  if (data.count >= MAX_REQUESTS_PER_WINDOW) {
    return true
  }

  data.count++
  return false
}

// Moderate message using Groq AI
async function moderateMessage(name, message) {
  // If no message, skip moderation
  if (!message || message.trim().length === 0) {
    return { isAppropriate: true, reason: '', category: 'none' }
  }

  // If Groq is not configured, allow the message (fail open)
  if (!groq) {
    console.warn('Groq not configured - skipping moderation')
    return { isAppropriate: true, reason: 'moderation_disabled', category: 'none' }
  }

  const prompt = `You are a content moderator for a guest book on a personal blog. Analyze the following guest book entry and determine if it should be rejected.

Name: ${name}
Message: ${message}

Evaluate for:
1. NSFW content (explicit sexual content, graphic descriptions)
2. Hate speech, slurs, or harassment
3. Spam or promotional content
4. Personal attacks or threats
5. Inappropriate language for a public guest book

Respond with ONLY a JSON object in this exact format:
{
  "isAppropriate": true/false,
  "reason": "brief explanation if inappropriate, otherwise empty string",
  "category": "nsfw" | "hate" | "spam" | "harassment" | "inappropriate" | "none"
}

Be reasonable - friendly messages, jokes, compliments, and normal conversation should be allowed. Only reject genuinely problematic content.`

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

    // Default to allowing if parsing fails
    return { isAppropriate: true, reason: '', category: 'none' }
  } catch (error) {
    console.error('Groq moderation error:', error)
    // On error, allow the message (fail open)
    return { isAppropriate: true, reason: 'moderation_error', category: 'none' }
  }
}

// Validate signature data
function validateSignature(signature) {
  if (!signature || typeof signature !== 'object') {
    return { valid: false, error: 'Signature data is required' }
  }

  const { path, viewBox, name: signerName } = signature

  if (!path || typeof path !== 'string') {
    return { valid: false, error: 'Signature path is required' }
  }

  // Basic SVG path validation
  if (path.length < 20 || !path.startsWith('M')) {
    return { valid: false, error: 'Invalid signature - please draw a proper signature' }
  }

  if (path.length > 50000) {
    return { valid: false, error: 'Signature data too large' }
  }

  if (!viewBox || typeof viewBox !== 'string') {
    return { valid: false, error: 'Signature viewBox is required' }
  }

  if (!signerName || typeof signerName !== 'string' || signerName.trim().length === 0) {
    return { valid: false, error: 'Name is required' }
  }

  if (signerName.length > 50) {
    return { valid: false, error: 'Name is too long (max 50 characters)' }
  }

  return { valid: true }
}

// Sanitize input
function sanitizeInput(str, maxLength = 200) {
  if (!str || typeof str !== 'string') return ''
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '') // Remove angle brackets
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment before signing again.'
    })
  }

  const { authorUsername, signature } = req.body

  // Validate author username
  if (!authorUsername || typeof authorUsername !== 'string') {
    return res.status(400).json({ error: 'Author username is required' })
  }

  // Validate signature
  const validationResult = validateSignature(signature)
  if (!validationResult.valid) {
    return res.status(400).json({ error: validationResult.error })
  }

  // Sanitize inputs
  const sanitizedName = sanitizeInput(signature.name, 50)
  const sanitizedMessage = sanitizeInput(signature.message, 200)

  try {
    // Find the author by username
    const usersSnapshot = await firestore
      .collection('users')
      .where('name', '==', authorUsername)
      .limit(1)
      .get()

    if (usersSnapshot.empty) {
      return res.status(404).json({ error: 'Author not found' })
    }

    const authorDoc = usersSnapshot.docs[0]
    const authorId = authorDoc.id

    // Check for duplicate signatures (same name in last 24 hours)
    // Note: This query may fail without a composite index, so we handle that gracefully
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const existingEntries = await firestore
        .collection('users')
        .doc(authorId)
        .collection('guestbook')
        .where('name', '==', sanitizedName)
        .limit(10)
        .get()

      // Filter by date in memory to avoid needing composite index
      const recentDuplicate = existingEntries.docs.some(doc => {
        const data = doc.data()
        const createdAt = data.createdAt?.toDate?.()
        return createdAt && createdAt > oneDayAgo
      })

      if (recentDuplicate) {
        return res.status(400).json({
          error: 'You have already signed this guest book recently. Please try again later.'
        })
      }
    } catch (duplicateCheckError) {
      // Log but don't fail - duplicate check is not critical
      console.warn('Duplicate check failed (may need index):', duplicateCheckError.message)
    }

    // Moderate the message
    const moderationResult = await moderateMessage(sanitizedName, sanitizedMessage)

    if (!moderationResult.isAppropriate) {
      return res.status(400).json({
        error: 'Your message could not be posted. Please keep it appropriate.',
        category: moderationResult.category
      })
    }

    // Create guestbook entry
    const guestbookEntry = {
      name: sanitizedName,
      message: sanitizedMessage,
      signaturePath: signature.path,
      signatureViewBox: signature.viewBox,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      moderationStatus: 'approved',
      moderationCategory: moderationResult.category,
    }

    // Add to guestbook subcollection
    const docRef = await firestore
      .collection('users')
      .doc(authorId)
      .collection('guestbook')
      .add(guestbookEntry)

    // Optionally create notification for author
    try {
      await firestore.collection('notifications').add({
        recipientId: authorId,
        type: 'guestbook_signature',
        actorId: null,
        actorName: sanitizedName,
        actorPhoto: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(sanitizedName)}`,
        postId: null,
        postTitle: null,
        postSlug: null,
        postAuthorName: null,
        message: `${sanitizedName} signed your guest book${sanitizedMessage ? ': "' + sanitizedMessage.slice(0, 50) + (sanitizedMessage.length > 50 ? '...' : '') + '"' : ''}`,
        metadata: {
          guestbookEntryId: docRef.id,
        },
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    } catch (notifError) {
      console.error('Failed to create guestbook notification:', notifError)
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully signed the guest book!',
      entryId: docRef.id,
    })
  } catch (error) {
    console.error('Guestbook sign error:', error.message, error.stack)
    return res.status(500).json({
      error: 'Failed to sign the guest book. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

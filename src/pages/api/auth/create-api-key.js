import firebase, { firestore } from '../../../lib/firebase'
import { v4 as uuidv4 } from 'uuid'

// This is a protected endpoint that should only be accessible to authenticated users
export default async function handler(req, res) {
  // Set CORS headers to allow cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // In a real implementation, you would verify the user's session/authentication
    // For now, we'll assume the userId is passed in the request body
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    // Generate a unique API key
    const apiKey = uuidv4()

    // Store the API key in Firestore
    await firestore.collection('api_keys').add({
      key: apiKey,
      userId,
      createdAt: firebase.firestore.Timestamp.now()
    })

    // Return the API key to the user
    res.status(201).json({ apiKey })
  } catch (error) {
    console.error('Error creating API key:', error)
    res.status(500).json({ error: 'Failed to create API key', message: error.message })
  }
}
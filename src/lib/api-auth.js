import crypto from 'crypto'
import { firestore } from './firebase'

// Error codes for API responses
export const API_ERROR_CODES = {
  INVALID_KEY_FORMAT: 'INVALID_KEY_FORMAT',
  INVALID_KEY: 'INVALID_KEY',
  KEY_REVOKED: 'KEY_REVOKED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  MISSING_AUTH: 'MISSING_AUTH',
  MAX_KEYS_REACHED: 'MAX_KEYS_REACHED',
  KEY_NOT_FOUND: 'KEY_NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
}

// Generate a cryptographically secure API key
// Format: bublr_sk_{32 bytes of random hex} = 73 chars total
// Entropy: 256 bits - secure against brute force
export function generateApiKey() {
  const randomBytes = crypto.randomBytes(32)
  return `bublr_sk_${randomBytes.toString('hex')}`
}

// Hash an API key for secure storage
// Using SHA-256 - we never store the raw key
export function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex')
}

// Extract the prefix for display (first 12 chars after bublr_sk_)
export function getKeyPrefix(key) {
  if (!key || !key.startsWith('bublr_sk_')) {
    return ''
  }
  return key.substring(0, 20) + '...'
}

// Validate API key format
export function isValidKeyFormat(key) {
  if (!key || typeof key !== 'string') {
    return false
  }
  // bublr_sk_ + 64 hex chars = 73 total chars
  return /^bublr_sk_[a-f0-9]{64}$/.test(key)
}

// Authenticate an API request using the API key
// Returns { success: true, userId, userName } or { success: false, error, code }
export async function authenticateApiKey(authHeader) {
  if (!authHeader) {
    return {
      success: false,
      error: 'Missing Authorization header. Use: Authorization: Bearer <your_api_key>',
      code: API_ERROR_CODES.MISSING_AUTH
    }
  }

  // Support both "Bearer <key>" and just "<key>"
  let key = authHeader.trim()
  if (key.startsWith('Bearer ')) {
    key = key.substring(7).trim()
  }

  // Validate key format before any database operations
  if (!isValidKeyFormat(key)) {
    return {
      success: false,
      error: 'Invalid API key format. Keys should start with bublr_sk_',
      code: API_ERROR_CODES.INVALID_KEY_FORMAT
    }
  }

  const keyHash = hashApiKey(key)

  try {
    // Use a separate collection for O(1) key lookup
    // This is more efficient and scalable than querying user documents
    const keyDoc = await firestore.collection('apiKeyLookup').doc(keyHash).get()

    if (!keyDoc.exists) {
      // Use constant-time comparison behavior to prevent timing attacks
      // The hash lookup already provides this, but we want consistent response times
      return {
        success: false,
        error: 'Invalid API key',
        code: API_ERROR_CODES.INVALID_KEY
      }
    }

    const keyData = keyDoc.data()
    const userId = keyData.userId

    // Verify the key hasn't been revoked by checking if it still exists in user's apiKeys
    const userDoc = await firestore.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      // Clean up orphaned key lookup
      await firestore.collection('apiKeyLookup').doc(keyHash).delete().catch(() => {})
      return {
        success: false,
        error: 'User not found',
        code: API_ERROR_CODES.USER_NOT_FOUND
      }
    }

    const userData = userDoc.data()

    // Verify key still exists in user's apiKeys (belt and suspenders)
    const userKeys = userData.apiKeys || []
    const keyStillValid = userKeys.some(k => k.keyHash === keyHash)
    if (!keyStillValid) {
      // Key was revoked - clean up lookup document
      await firestore.collection('apiKeyLookup').doc(keyHash).delete().catch(() => {})
      return {
        success: false,
        error: 'API key has been revoked',
        code: API_ERROR_CODES.KEY_REVOKED
      }
    }

    // Update last used timestamp (fire and forget, non-blocking)
    const now = new Date().toISOString()
    Promise.all([
      firestore.collection('apiKeyLookup').doc(keyHash).update({ lastUsedAt: now }),
      // Also update in user's apiKeys array for UI display
      firestore.collection('users').doc(userId).update({
        apiKeys: userKeys.map(k =>
          k.keyHash === keyHash ? { ...k, lastUsedAt: now } : k
        )
      })
    ]).catch(() => {}) // Non-critical, don't block on this

    return {
      success: true,
      userId,
      userName: userData.name,
      displayName: userData.displayName,
      keyId: keyData.keyId
    }
  } catch (error) {
    console.error('API key authentication error:', error)
    return {
      success: false,
      error: 'Authentication failed',
      code: API_ERROR_CODES.INTERNAL_ERROR
    }
  }
}

// Create a new API key for a user
// Returns the raw key (only time it's available) and key metadata
export async function createApiKeyForUser(userId, keyName) {
  const rawKey = generateApiKey()
  const keyHash = hashApiKey(rawKey)
  const keyPrefix = getKeyPrefix(rawKey)
  const keyId = crypto.randomBytes(8).toString('hex')
  const createdAt = new Date().toISOString()

  const keyMetadata = {
    id: keyId,
    keyHash,
    keyPrefix,
    name: keyName || 'Unnamed Key',
    createdAt,
    lastUsedAt: null
  }

  try {
    // Add to user's apiKeys array
    const userRef = firestore.collection('users').doc(userId)
    const userDoc = await userRef.get()

    if (!userDoc.exists) {
      throw new Error('User not found')
    }

    const userData = userDoc.data()
    const existingKeys = userData.apiKeys || []

    // Limit to 5 API keys per user
    if (existingKeys.length >= 5) {
      throw new Error('Maximum of 5 API keys allowed per user')
    }

    // Add key metadata to user document
    await userRef.update({
      apiKeys: [...existingKeys, keyMetadata]
    })

    // Create lookup document for fast authentication
    await firestore.collection('apiKeyLookup').doc(keyHash).set({
      userId,
      keyId,
      createdAt
    })

    return {
      success: true,
      key: rawKey, // Only returned once!
      metadata: {
        id: keyId,
        keyPrefix,
        name: keyMetadata.name,
        createdAt
      }
    }
  } catch (error) {
    console.error('Create API key error:', error)
    throw error
  }
}

// Revoke an API key
export async function revokeApiKey(userId, keyId) {
  try {
    const userRef = firestore.collection('users').doc(userId)
    const userDoc = await userRef.get()

    if (!userDoc.exists) {
      throw new Error('User not found')
    }

    const userData = userDoc.data()
    const existingKeys = userData.apiKeys || []

    const keyToRevoke = existingKeys.find(k => k.id === keyId)
    if (!keyToRevoke) {
      throw new Error('API key not found')
    }

    // Remove from user's apiKeys array
    const updatedKeys = existingKeys.filter(k => k.id !== keyId)
    await userRef.update({
      apiKeys: updatedKeys
    })

    // Remove lookup document
    await firestore.collection('apiKeyLookup').doc(keyToRevoke.keyHash).delete()

    return { success: true }
  } catch (error) {
    console.error('Revoke API key error:', error)
    throw error
  }
}

// List API keys for a user (without revealing the actual keys)
export async function listApiKeysForUser(userId) {
  try {
    const userDoc = await firestore.collection('users').doc(userId).get()

    if (!userDoc.exists) {
      throw new Error('User not found')
    }

    const userData = userDoc.data()
    const keys = userData.apiKeys || []

    // Return only safe metadata (no keyHash)
    return keys.map(k => ({
      id: k.id,
      keyPrefix: k.keyPrefix,
      name: k.name,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt
    }))
  } catch (error) {
    console.error('List API keys error:', error)
    throw error
  }
}

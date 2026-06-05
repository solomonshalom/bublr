import crypto from 'crypto'

/**
 * Generates a short-lived signature for direct (client-side) uploads to
 * Cloudinary. The API secret stays server-side and is never sent to the
 * browser; the client uses { signature, timestamp, apiKey, cloudName, folder }
 * to perform the actual upload against Cloudinary's API.
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } })
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({
      error: { message: 'Cloudinary is not configured', code: 'CONFIG_ERROR' },
    })
  }

  try {
    const timestamp = Math.round(Date.now() / 1000)
    const folder = 'bublr'

    // Cloudinary signature: take every parameter that will be sent (except
    // file, cloud_name, resource_type and api_key), sort alphabetically, join
    // as key=value pairs, append the API secret, then SHA-1 hash the result.
    // The signed params here MUST exactly match what the client sends.
    const paramsToSign = { folder, timestamp }
    const signatureBase = Object.keys(paramsToSign)
      .sort()
      .map(key => `${key}=${paramsToSign[key]}`)
      .join('&')
    const signature = crypto
      .createHash('sha1')
      .update(signatureBase + apiSecret)
      .digest('hex')

    return res.status(200).json({ signature, timestamp, apiKey, cloudName, folder })
  } catch (error) {
    console.error('Cloudinary signing error:', error)
    return res.status(500).json({
      error: { message: 'Failed to sign upload', code: 'INTERNAL_ERROR' },
    })
  }
}

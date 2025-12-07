import formidable from 'formidable'
import fs from 'fs'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } })
  }

  const groqApiKey = process.env.GROQ_API_KEY

  if (!groqApiKey) {
    return res.status(500).json({
      error: { message: 'Groq API key not configured', code: 'CONFIG_ERROR' },
    })
  }

  try {
    // Parse the multipart form data
    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB max
    })

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        resolve([fields, files])
      })
    })

    const audioFile = files.audio?.[0] || files.audio

    if (!audioFile) {
      return res.status(400).json({
        error: { message: 'No audio file provided', code: 'NO_AUDIO' },
      })
    }

    // Read the file
    const fileBuffer = fs.readFileSync(audioFile.filepath)
    const blob = new Blob([fileBuffer], { type: audioFile.mimetype || 'audio/webm' })

    // Create form data for Groq API
    const formData = new FormData()
    formData.append('file', blob, audioFile.originalFilename || 'audio.webm')
    formData.append('model', 'whisper-large-v3')
    formData.append('response_format', 'json')
    formData.append('language', 'en')

    // Call Groq Whisper API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: formData,
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error('Groq API error:', errorText)
      return res.status(500).json({
        error: { message: 'Transcription failed', code: 'TRANSCRIPTION_ERROR' },
      })
    }

    const result = await groqResponse.json()

    // Clean up temp file
    fs.unlinkSync(audioFile.filepath)

    return res.status(200).json({
      text: result.text,
    })
  } catch (error) {
    console.error('Transcription error:', error)
    return res.status(500).json({
      error: { message: 'Failed to transcribe audio', code: 'INTERNAL_ERROR' },
    })
  }
}

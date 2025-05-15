import { ElevenLabsClient } from "elevenlabs";

export const config = {
  api: {
    responseLimit: '10mb',
    bodyParser: {
      sizeLimit: '10kb',
    },
  },
};

// Cache for TTS responses to reduce API calls
const ttsCache = new Map();
const CACHE_MAX_SIZE = 20; // Limit cache size
const CACHE_TTL = 3600000; // 1 hour in milliseconds

// Function to clean old cache entries
function cleanCache() {
  if (ttsCache.size > CACHE_MAX_SIZE) {
    // Sort entries by timestamp and remove oldest
    const entries = Array.from(ttsCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, Math.ceil(entries.length / 2));
    toRemove.forEach(([key]) => ttsCache.delete(key));
  }
  
  // Remove expired entries
  const now = Date.now();
  for (const [key, value] of ttsCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      ttsCache.delete(key);
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Set timeout for the API request
    res.setTimeout(30000); // 30 seconds timeout
    
    const { text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: "No text provided." });
    }

    // Trim and normalize the text
    const trimmedText = text.trim().substring(0, 5000);

    // Check cache for this text
    const cacheKey = Buffer.from(trimmedText).toString('base64');
    if (ttsCache.has(cacheKey)) {
      console.log("TTS cache hit for text:", trimmedText.substring(0, 30) + "...");
      const cachedData = ttsCache.get(cacheKey);
      
      // Update timestamp to keep this entry fresh
      cachedData.timestamp = Date.now();
      
      // Set the appropriate content type for audio
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', cachedData.buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      // Send the cached audio data
      return res.status(200).send(cachedData.buffer);
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY is not defined in environment variables");
      return res.status(500).json({ error: "API key configuration error" });
    }

    try {
      console.log(`Processing TTS request for text (${trimmedText.length} chars): ${trimmedText.substring(0, 50)}...`);
      
      const client = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY,
        baseUrl: "https://api.elevenlabs.io/v1",
      });

      // Set voice as "Adam" which is a preset voice in ElevenLabs
      const voiceId = "pNInz6obpgDQGcFmaJgB"; // Adam voice ID

      // Add retry logic for resilience
      let attempts = 0;
      const maxAttempts = 2;
      let audioBuffer = null;
      let lastError = null;
      
      while (attempts < maxAttempts && !audioBuffer) {
        attempts++;
        try {
          console.log(`TTS attempt ${attempts} for text: ${trimmedText.substring(0, 30)}...`);
          
          // Generate speech using ElevenLabs API
          const audioStream = await client.textToSpeech.convert({
            voice_id: voiceId,
            text: trimmedText,
            model_id: "eleven_multilingual_v2",
            output_format: "mp3",
            // Additional options for better quality
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.5,
              use_speaker_boost: true
            }
          });
          
          // Convert the response to a buffer
          const chunks = [];
          for await (const chunk of audioStream) {
            chunks.push(chunk);
          }
          audioBuffer = Buffer.concat(chunks);
          
          if (audioBuffer.length === 0) {
            throw new Error("Received empty audio data");
          }
          
          console.log(`TTS successful on attempt ${attempts}, received ${audioBuffer.length} bytes`);
        } catch (error) {
          console.error(`TTS attempt ${attempts} failed:`, error);
          lastError = error;
          
          // If this isn't our last attempt, wait before retrying
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (!audioBuffer) {
        throw new Error(lastError?.message || "Failed to generate speech after multiple attempts");
      }

      // Cache the result
      ttsCache.set(cacheKey, {
        buffer: audioBuffer,
        timestamp: Date.now()
      });
      
      // Clean cache periodically
      cleanCache();

      // Set the appropriate content type for audio
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      // Send the audio data
      return res.status(200).send(audioBuffer);
    } catch (elevenLabsError) {
      console.error("ElevenLabs API error:", elevenLabsError);
      return res.status(500).json({ 
        error: `Text-to-speech service error: ${elevenLabsError.message}`,
        details: JSON.stringify(elevenLabsError)
      });
    }
  } catch (error) {
    console.error("Error processing text-to-speech request:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
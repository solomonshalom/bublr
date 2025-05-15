import { ElevenLabsClient } from "elevenlabs";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Set timeout for the API request
    res.setTimeout(30000); // 30 seconds timeout
    
    const data = await req.formData();
    const audio = data.get("audio");

    if (!audio || !(audio instanceof Blob)) {
      return res.status(400).json({ error: "No audio file found in form data." });
    }

    if (audio.size === 0) {
      return res.status(400).json({ error: "Audio file is empty." });
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY is not defined in environment variables");
      return res.status(500).json({ error: "API key configuration error" });
    }

    try {
      // Log the audio details for debugging
      console.log(`Processing audio file: type=${audio.type}, size=${audio.size} bytes`);
      
      const client = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY,
        baseUrl: "https://api.elevenlabs.io/v1",
      });

      // Convert the Blob to ArrayBuffer
      const arrayBuffer = await audio.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Make sure we have a valid buffer to send
      if (!buffer || buffer.length === 0) {
        return res.status(400).json({ error: "Failed to process audio file" });
      }
      
      console.log(`Sending ${buffer.length} bytes to ElevenLabs API`);
      
      // Add retry logic for resilience
      let attempts = 0;
      const maxAttempts = 2;
      let transcription = null;
      let lastError = null;
      
      while (attempts < maxAttempts && !transcription) {
        attempts++;
        try {
          transcription = await client.speechToText.convert({
            model_id: "whisper-1",
            file: buffer,
            // Adding additional options for better results
            options: {
              language_detection: true,
              speaker_labels: true
            }
          });
          
          // Validate the response
          if (!transcription || !transcription.text) {
            throw new Error("Invalid response format from speech-to-text service");
          }
          
          console.log("Transcription successful on attempt", attempts);
        } catch (error) {
          console.error(`Attempt ${attempts} failed:`, error);
          lastError = error;
          
          // If this isn't our last attempt, wait before retrying
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (!transcription) {
        throw new Error(lastError?.message || "Failed to transcribe after multiple attempts");
      }

      console.log("Transcription complete:", transcription.text.substring(0, 50) + "...");
      
      return res.status(200).json({ text: transcription.text });
    } catch (elevenLabsError) {
      console.error("ElevenLabs API error:", elevenLabsError);
      return res.status(500).json({ 
        error: `Speech-to-text service error: ${elevenLabsError.message}`,
        details: JSON.stringify(elevenLabsError)
      });
    }
  } catch (error) {
    console.error("Error processing transcription request:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
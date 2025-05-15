import { ElevenLabsClient } from "elevenlabs";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "No text provided." });
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY is not defined in environment variables");
      return res.status(500).json({ error: "API key configuration error" });
    }

    try {
      const client = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY,
      });

      // Set voice as "Adam" which is a preset voice in ElevenLabs
      const voiceId = "pNInz6obpgDQGcFmaJgB"; // Adam voice ID

      // Add debug logging
      console.log("Sending text to ElevenLabs API");
      
      // Limit text to 5000 characters to prevent overflow
      const trimmedText = text.substring(0, 5000);

      // Generate speech using ElevenLabs API
      const audioStream = await client.textToSpeech.convert({
        voice_id: voiceId,
        text: trimmedText,
        model_id: "eleven_multilingual_v2",
        output_format: "mp3",
      });
      
      // Convert the response to a buffer
      const chunks = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);

      // Set the appropriate content type for audio
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length);
      
      // Send the audio data
      res.status(200).send(audioBuffer);
    } catch (elevenLabsError) {
      console.error("ElevenLabs API error:", elevenLabsError);
      return res.status(500).json({ error: `Text-to-speech service error: ${elevenLabsError.message}` });
    }
  } catch (error) {
    console.error("Error processing text-to-speech request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
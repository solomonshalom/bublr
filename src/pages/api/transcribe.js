import { ElevenLabsClient } from "elevenlabs";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = await req.formData();
    const audio = data.get("audio");

    if (!audio || !(audio instanceof Blob)) {
      return res.status(400).json({ error: "No audio file found in form data." });
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY is not defined in environment variables");
      return res.status(500).json({ error: "API key configuration error" });
    }

    try {
      const client = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY,
      });

      // Add debug logging
      console.log("Sending audio to ElevenLabs API");
      
      const transcription = await client.speechToText.convert({
        model_id: "whisper-1",  // Changed to use whisper-1 which is more commonly available
        file: audio,
      });

      console.log("Received transcription response:", transcription);
      
      if (!transcription || !transcription.text) {
        console.error("Invalid transcription response:", transcription);
        return res.status(500).json({ error: "Invalid response from speech-to-text service" });
      }

      return res.status(200).json({ text: transcription.text });
    } catch (elevenLabsError) {
      console.error("ElevenLabs API error:", elevenLabsError);
      return res.status(500).json({ error: `Speech-to-text service error: ${elevenLabsError.message}` });
    }
  } catch (error) {
    console.error("Error processing transcription request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
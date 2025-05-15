import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "No text provided." });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not defined in environment variables");
      return res.status(500).json({ error: "API key configuration error" });
    }

    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Use tts-1 model which is the standard model available in OpenAI API
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: text.substring(0, 4096), // Limit text to 4096 characters to prevent overflow
        response_format: "mp3",
      });

      // Get the audio data from the response
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      // Set the appropriate content type for audio
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length);
      
      // Send the audio data
      res.status(200).send(audioBuffer);
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError);
      return res.status(500).json({ error: `Text-to-speech service error: ${openaiError.message}` });
    }
  } catch (error) {
    console.error("Error processing text-to-speech request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
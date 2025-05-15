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

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: text,
      instructions: "Speak in a natural, engaging tone.",
      response_format: "mp3",
    });

    // Get the audio data from the response
    const audioBuffer = Buffer.from(await response.arrayBuffer());

    // Set the appropriate content type for audio
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    
    // Send the audio data
    res.status(200).send(audioBuffer);
  } catch (error) {
    console.error("Error processing text-to-speech request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
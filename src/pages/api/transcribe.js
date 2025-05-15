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

    const client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });

    const transcription = await client.speechToText.convert({
      model_id: "scribe_v1",
      file: audio,
    });

    return res.status(200).json({ text: transcription.text });
  } catch (error) {
    console.error("Error processing transcription request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
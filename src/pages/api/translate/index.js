import Groq from 'groq-sdk'
import { htmlToText } from 'html-to-text'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

// Supported languages with their native names
const SUPPORTED_LANGUAGES = {
  en: { name: 'English', native: 'English' },
  es: { name: 'Spanish', native: 'Español' },
  fr: { name: 'French', native: 'Français' },
  de: { name: 'German', native: 'Deutsch' },
  it: { name: 'Italian', native: 'Italiano' },
  pt: { name: 'Portuguese', native: 'Português' },
  hi: { name: 'Hindi', native: 'हिन्दी' },
  th: { name: 'Thai', native: 'ไทย' },
  zh: { name: 'Chinese', native: '中文' },
  ja: { name: 'Japanese', native: '日本語' },
  ko: { name: 'Korean', native: '한국어' },
  ar: { name: 'Arabic', native: 'العربية' },
  ru: { name: 'Russian', native: 'Русский' },
  nl: { name: 'Dutch', native: 'Nederlands' },
  pl: { name: 'Polish', native: 'Polski' },
  tr: { name: 'Turkish', native: 'Türkçe' },
  vi: { name: 'Vietnamese', native: 'Tiếng Việt' },
  id: { name: 'Indonesian', native: 'Bahasa Indonesia' },
  sv: { name: 'Swedish', native: 'Svenska' },
  da: { name: 'Danish', native: 'Dansk' },
}

// Translate content using Groq AI (LLaMA 3.3 70B Versatile)
async function translateContent(title, content, targetLang) {
  const targetLanguage = SUPPORTED_LANGUAGES[targetLang]?.name || 'English'

  // Convert HTML to plain text for translation
  const textContent = htmlToText(content || '', {
    wordwrap: false,
    preserveNewlines: true,
  })
  const textTitle = htmlToText(title || '')

  // Limit content length to avoid token limits (roughly 12000 chars = ~3000 tokens)
  const truncatedContent = textContent.substring(0, 12000)
  const isTruncated = textContent.length > 12000

  const prompt = `You are a professional translator with expertise in maintaining natural grammar, idioms, and cultural nuances. Translate the following blog post from its original language to ${targetLanguage}.

IMPORTANT TRANSLATION GUIDELINES:
1. Preserve the original meaning, tone, and style
2. Use natural, fluent ${targetLanguage} - not literal word-for-word translation
3. Adapt idioms and cultural references appropriately
4. Maintain paragraph structure and formatting
5. Keep proper nouns, brand names, and technical terms as appropriate
6. Ensure grammatical correctness in the target language

---
TITLE: ${textTitle}

CONTENT:
${truncatedContent}
---

Respond with ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "translatedTitle": "translated title here",
  "translatedContent": "translated content here with preserved paragraph breaks using \\n\\n"
}`

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Always respond with valid JSON only, no markdown formatting or code blocks. Your translations should be natural and fluent in ${targetLanguage}, preserving the original meaning and style.`
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3, // Lower temperature for more consistent translations
      max_tokens: 8000,
    })

    const response = chatCompletion.choices[0]?.message?.content || ''

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        success: true,
        translatedTitle: parsed.translatedTitle,
        translatedContent: parsed.translatedContent,
        isTruncated,
        targetLanguage: targetLanguage,
      }
    }

    return {
      success: false,
      error: 'Failed to parse translation response'
    }
  } catch (error) {
    console.error('Translation error:', error)
    return {
      success: false,
      error: error.message || 'Translation failed'
    }
  }
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const { title, content, targetLang } = req.body

  // Validate inputs
  if (!content) {
    return res.status(400).json({ error: { message: 'Missing content' } })
  }

  if (!targetLang) {
    return res.status(400).json({ error: { message: 'Missing target language' } })
  }

  if (!SUPPORTED_LANGUAGES[targetLang]) {
    return res.status(400).json({
      error: { message: 'Unsupported language' },
      supportedLanguages: Object.keys(SUPPORTED_LANGUAGES)
    })
  }

  try {
    const result = await translateContent(title, content, targetLang)

    if (result.success) {
      return res.status(200).json({
        success: true,
        translatedTitle: result.translatedTitle,
        translatedContent: result.translatedContent,
        targetLanguage: result.targetLanguage,
        isTruncated: result.isTruncated,
      })
    } else {
      return res.status(500).json({
        success: false,
        error: { message: result.error }
      })
    }
  } catch (error) {
    console.error('Translation handler error:', error)
    return res.status(500).json({
      error: { message: 'Internal server error' }
    })
  }
}

// Export supported languages for client-side use
export { SUPPORTED_LANGUAGES }

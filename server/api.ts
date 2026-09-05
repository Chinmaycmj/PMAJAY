import { GoogleGenAI } from '@google/genai';
import { BeneficiaryProfile, SupportedLanguage } from '../src/types/pmajay';

// Lazy client initialization to avoid startup crashes if key is missing
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export interface ProcessAnswerPayload {
  questionId: number;
  questionKey: keyof BeneficiaryProfile;
  userAnswer: string;
  language: SupportedLanguage;
  currentProfile: BeneficiaryProfile;
}

export async function handleProcessAnswer(payload: ProcessAnswerPayload) {
  const { questionId, questionKey, userAnswer, language, currentProfile } = payload;

  const client = getAiClient();

  if (client) {
    try {
      const prompt = `You are the AI Voice Assistant for the PM-AJAY (Pradhan Mantri Anusuchit Jaati Abhyuday Yojana) scheme in India.
The beneficiary just answered question #${questionId} (${questionKey}) in ${
        language === 'kn' ? 'Kannada' : language === 'hi' ? 'Hindi' : 'English'
      }.
User Answer: "${userAnswer}"
Current beneficiary profile: ${JSON.stringify(currentProfile)}

Task:
1. Extract the clean, canonical value for "${questionKey}".
2. Generate a warm, reassuring, single-sentence spoken feedback in the same language (${
        language === 'kn' ? 'Kannada' : language === 'hi' ? 'Hindi' : 'English'
      }) confirming that their information has been noted and encouraging them for the next question.

Return strictly valid JSON with this exact schema:
{
  "extractedValue": "string containing the extracted answer",
  "aiFeedback": "single short sentence spoken feedback in the user's language"
}`;

      const response = await client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const responseText = response.text?.trim() || '{}';
      const parsed = JSON.parse(responseText);

      const isComplete = questionId >= 9;
      const nextQuestionId = questionId + 1;

      return {
        success: true,
        extractedValue: parsed.extractedValue || userAnswer,
        slotKey: questionKey,
        aiFeedback: parsed.aiFeedback || getDefaultFeedback(language, parsed.extractedValue || userAnswer, questionKey),
        nextQuestionId,
        isComplete,
      };
    } catch (err) {
      console.warn('Gemini API call fallback to heuristic extraction:', err);
    }
  }

  // Fallback heuristic extraction
  const cleanVal = extractHeuristicValue(questionKey, userAnswer, language);
  const feedback = getDefaultFeedback(language, cleanVal, questionKey);
  const isComplete = questionId >= 9;

  return {
    success: true,
    extractedValue: cleanVal,
    slotKey: questionKey,
    aiFeedback: feedback,
    nextQuestionId: questionId + 1,
    isComplete,
  };
}

function extractHeuristicValue(key: keyof BeneficiaryProfile, raw: string, _lang: SupportedLanguage): string {
  const trimmed = raw.trim();
  if (key === 'incomeLessThan2point5Lakh') {
    const lower = trimmed.toLowerCase();
    if (lower.includes('yes') || lower.includes('हाँ') || lower.includes('हा') || lower.includes('ಹೌದು')) {
      return 'Yes (< ₹2.5 Lakh)';
    }
    if (lower.includes('no') || lower.includes('नहीं') || lower.includes('ಇಲ್ಲ')) {
      return 'No (≥ ₹2.5 Lakh)';
    }
    return trimmed;
  }
  if (key === 'careerPreference') {
    const lower = trimmed.toLowerCase();
    if (lower.includes('business') || lower.includes('ವ್ಯವಹಾರ') || lower.includes('ಉದ್ಯಮ') || lower.includes('व्यवसाय') || lower.includes('स्वरोजगार')) {
      return 'Self-Employed / Business';
    }
    if (lower.includes('job') || lower.includes('ನೌಕರಿ') || lower.includes('ಉದ್ಯೋಗ') || lower.includes('नौकरी')) {
      return 'Wage Job in Company';
    }
  }
  return trimmed;
}

function getDefaultFeedback(lang: SupportedLanguage, value: string, key: keyof BeneficiaryProfile): string {
  if (lang === 'kn') {
    if (key === 'name') return `ಧನ್ಯವಾದಗಳು ${value}, ನಿಮ್ಮ ಹೆಸರನ್ನು ದಾಖಲಿಸಲಾಗಿದೆ.`;
    return 'ಧನ್ಯವಾದಗಳು, ನಿಮ್ಮ ಮಾಹಿತಿಯನ್ನು ನಮೂದಿಸಲಾಗಿದೆ.';
  }
  if (lang === 'hi') {
    if (key === 'name') return `धन्यवाद ${value}, आपका नाम दर्ज कर लिया गया है।`;
    return 'धन्यवाद, आपकी जानकारी दर्ज कर ली गई है।';
  }
  if (key === 'name') return `Thank you ${value}, your name is recorded.`;
  return 'Thank you, your response has been recorded.';
}

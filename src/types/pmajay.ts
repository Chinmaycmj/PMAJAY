export type SupportedLanguage = 'en' | 'hi' | 'kn';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  localeTag: string; // 'en-IN', 'hi-IN', 'kn-IN'
  flag: string;
}

export type ConversationState =
  | 'STATE_IDLE'
  | 'STATE_AI_SPEAKING'
  | 'STATE_LISTENING'
  | 'STATE_PROCESSING';

export interface QuestionDefinition {
  id: number;
  key: keyof BeneficiaryProfile;
  titleKey: string;
  category: string;
  pictorialIcons?: string[];
  suggestedAnswers: {
    en: string[];
    hi: string[];
    kn: string[];
  };
}

export interface BeneficiaryProfile {
  name: string;
  location: string; // District or 6-digit Pincode
  incomeLessThan2point5Lakh: string; // 'Yes' | 'No' | 'ಹೌದು' | 'ಇಲ್ಲ' | 'हाँ' | 'नहीं'
  education: string;
  traditionalWork: string;
  currentWork: string;
  toolsSkills: string;
  mobilityRadiusKm: string;
  careerPreference: string; // 'Wage Job' | 'Self-Employed / Business'
  videoRecorded?: boolean;
  videoBlobUrl?: string;
  registeredAt?: string;
  registrationId?: string;
}

export interface ProcessingResult {
  success: boolean;
  extractedValue: string;
  slotKey: keyof BeneficiaryProfile;
  aiFeedback: string;
  nextQuestionId: number;
  isComplete: boolean;
}

export type ActiveScreen = 'home' | 'call' | 'voice_assistant' | 'mute_assisted' | 'summary';

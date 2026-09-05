import React from 'react';
import { SupportedLanguage } from '../types/pmajay';
import { UI_TRANSLATIONS } from '../data/translations';
import { Phone, Mic, Video, Volume2, ShieldCheck, Sparkles, HelpCircle, ArrowRight, HandHeart } from 'lucide-react';
import { HalfDuplexVoiceEngine } from '../utils/speech';

interface HomeScreenProps {
  currentLanguage: SupportedLanguage;
  onSelectCall: () => void;
  onSelectVoiceAssistant: () => void;
  onSelectMuteAssisted: () => void;
  onOpenCodeHub: () => void;
  speechEngine: HalfDuplexVoiceEngine;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentLanguage,
  onSelectCall,
  onSelectVoiceAssistant,
  onSelectMuteAssisted,
  onOpenCodeHub,
  speechEngine,
}) => {
  const t = UI_TRANSLATIONS[currentLanguage];

  const handleSpeakIntroduction = () => {
    let introText = "";
    if (currentLanguage === 'kn') {
      introText = "ಪಿಎಂ-ಅಜಯ್ ಜೀವನೋಪಾಯ ಸಹಾಯಕಕ್ಕೆ ಸುಸ್ವಾಗತ. ನೀವು ಟೋಲ್-ಫ್ರೀ ಕರೆ ಮೂಲಕ, ಧ್ವನಿ ಸಹಾಯಕದೊಂದಿಗೆ ಮಾತನಾಡಿ ಅಥವಾ ಮೂಕ ವಿಶೇಷ ಮೋಡ್ ಆಯ್ಕೆ ಮಾಡುವ ಮೂಲಕ ನೋಂದಾಯಿಸಿಕೊಳ್ಳಬಹುದು.";
    } else if (currentLanguage === 'hi') {
      introText = "पीएम-अजय आजीविका सहायक में आपका स्वागत है। आप टोल-फ्री कॉल द्वारा, बोलकर वॉयस असिस्टेंट के साथ, या मूक विशेष मोड का उपयोग करके पंजीकरण कर सकते हैं।";
    } else {
      introText = "Welcome to PM-AJAY Livelihood Assistant. You can register via toll-free call, speak directly with the Voice Assistant, or use the accessible Mute mode.";
    }
    speechEngine.speakPrompt(introText, false);
  };

  return (
    <div id="home-screen-container" className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-8 flex flex-col gap-6">
      {/* Banner / Header Card */}
      <div
        id="home-hero-banner"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/90 via-slate-850 to-slate-900 border border-slate-700/80 p-5 sm:p-7 shadow-xl"
      >
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                {t.govTitle}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {t.schemeSubtitle}
            </h2>
            <p className="mt-1 text-sm text-slate-300 max-w-2xl leading-relaxed">
              {currentLanguage === 'kn'
                ? 'ಕೌಶಲ್ಯ ತರಬೇತಿ ಮತ್ತು ₹50,000 ವರೆಗಿನ ವ್ಯವಹಾರ ಅನುದಾನಕ್ಕಾಗಿ ಧ್ವನಿ ಆಧಾರಿತ ಸುಲಭ ನೋಂದಣಿ.'
                : currentLanguage === 'hi'
                ? 'कौशल प्रशिक्षण और ₹50,000 तक के व्यावसायिक अनुदान हेतु आसान वॉयस पंजीकरण।'
                : 'Accessible voice-first registration for skill training, livelihood grants, and enterprise assistance.'}
            </p>
          </div>

          {/* Audio read-aloud button for low-literacy beneficiaries */}
          <button
            id="read-instructions-aloud-btn"
            onClick={handleSpeakIntroduction}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 shrink-0"
            title="Listen to instructions in audio"
          >
            <Volume2 className="w-4 h-4 animate-bounce" />
            <span>
              {currentLanguage === 'kn' ? 'ಧ್ವನಿಯಲ್ಲಿ ಆಲಿಸಿ' : currentLanguage === 'hi' ? 'आवाज़ में सुनें' : 'Listen in Audio'}
            </span>
          </button>
        </div>
      </div>

      {/* Main 3 Options Grid */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 px-1">
          {currentLanguage === 'kn'
            ? 'ಸಂಪರ್ಕ ವಿಧಾನವನ್ನು ಆಯ್ಕೆಮಾಡಿ (3 ಆಯ್ಕೆಗಳು)'
            : currentLanguage === 'hi'
            ? 'संपर्क का माध्यम चुनें (3 विकल्प)'
            : 'Choose Your Preferred Interaction Mode'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {/* Card 1: Toll-Free Call (1800-111-222) */}
          <div
            id="card-toll-free-call"
            onClick={onSelectCall}
            className="group relative cursor-pointer flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-750 hover:to-slate-800 border-2 border-slate-700/90 hover:border-emerald-500/80 transition-all duration-200 shadow-lg hover:shadow-emerald-500/10 active:scale-[0.98]"
          >
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all duration-200 shadow-md">
                <Phone className="w-7 h-7" />
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                1800-111-222
              </span>
            </div>

            <div className="mt-5">
              <h4 className="text-lg sm:text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                {t.callTollFree}
              </h4>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-normal">
                {t.callTollFreeDesc}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs font-semibold text-emerald-400">
              <span>{currentLanguage === 'kn' ? 'ಕರೆ ಪ್ರಾರಂಭಿಸಿ' : currentLanguage === 'hi' ? 'कॉल करें' : 'Start IVR Call'}</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: Voice Assistant (In-App Voice with Video Answer Option) */}
          <div
            id="card-voice-assistant"
            onClick={onSelectVoiceAssistant}
            className="group relative cursor-pointer flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-750 hover:to-slate-800 border-2 border-amber-500/70 hover:border-amber-400 transition-all duration-200 shadow-lg hover:shadow-amber-500/10 active:scale-[0.98]"
          >
            <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow">
              Recommended
            </div>

            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition-all duration-200 shadow-md">
                <Mic className="w-7 h-7" />
              </div>
              <div className="flex items-center gap-1 text-[11px] font-medium text-amber-300/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                <Video className="w-3 h-3" />
                <span>Audio & Video</span>
              </div>
            </div>

            <div className="mt-5">
              <h4 className="text-lg sm:text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                {t.voiceAssistant}
              </h4>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-normal">
                {t.voiceAssistantDesc}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs font-semibold text-amber-400">
              <span>{currentLanguage === 'kn' ? 'ಮಾತನಾಡಲು ಪ್ರಾರಂಭಿಸಿ' : currentLanguage === 'hi' ? 'बातचीत शुरू करें' : 'Launch Assistant'}</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: Mute & Non-Verbal Assisted Mode */}
          <div
            id="card-mute-assistant"
            onClick={onSelectMuteAssisted}
            className="group relative cursor-pointer flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-750 hover:to-slate-800 border-2 border-slate-700/90 hover:border-purple-500/80 transition-all duration-200 shadow-lg hover:shadow-purple-500/10 active:scale-[0.98]"
          >
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-slate-950 transition-all duration-200 shadow-md">
                <HandHeart className="w-7 h-7" />
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                Sign / Visual
              </span>
            </div>

            <div className="mt-5">
              <h4 className="text-lg sm:text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
                {t.muteAssistant}
              </h4>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-normal">
                {t.muteAssistantDesc}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs font-semibold text-purple-400">
              <span>{currentLanguage === 'kn' ? 'ಮೂಕ ಮೋಡ್ ತೆರೆಯಿರಿ' : currentLanguage === 'hi' ? 'मूक मोड खोलें' : 'Open Mute Mode'}</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Feature & Inclusion Assurance Bar */}
      <div className="bg-slate-850/80 border border-slate-750 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">
              {currentLanguage === 'kn' ? 'ತ್ರಿಭಾಷಾ ಎಐ ಮತ್ತು ಆಂಡ್ರಾಯ್ಡ್ ಹೊಂದಾಣಿಕೆ' : currentLanguage === 'hi' ? 'त्रिभाषी एआई एवं एंड्रॉइड अनुकूलता' : 'Trilingual Indic AI & Android Native Compliance'}
            </div>
            <div className="text-[11px] text-slate-400">
              Kannada (kn-IN) • Hindi (hi-IN) • English (en-IN) • Google Speech Services
            </div>
          </div>
        </div>

        <button
          id="home-open-android-code"
          onClick={onOpenCodeHub}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
        >
          <span>View Kotlin Engine Specs & Fixes</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

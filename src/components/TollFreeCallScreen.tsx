import React, { useState, useEffect, useRef } from 'react';
import { SupportedLanguage } from '../types/pmajay';
import { UI_TRANSLATIONS, QUESTION_DEFINITIONS } from '../data/translations';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Grid, ArrowLeft, Smartphone, Radio } from 'lucide-react';
import { audioFx } from '../utils/audio';
import { HalfDuplexVoiceEngine } from '../utils/speech';

interface TollFreeCallScreenProps {
  currentLanguage: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onBackToHome: () => void;
  speechEngine: HalfDuplexVoiceEngine;
  onCompleteProfile: (profileData: Record<string, string>) => void;
}

type CallStatus = 'dialing' | 'ringing' | 'connected' | 'ended';

export const TollFreeCallScreen: React.FC<TollFreeCallScreenProps> = ({
  currentLanguage,
  onLanguageChange,
  onBackToHome,
  speechEngine,
  onCompleteProfile,
}) => {
  const t = UI_TRANSLATIONS[currentLanguage];

  const [callStatus, setCallStatus] = useState<CallStatus>('dialing');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [showKeypad, setShowKeypad] = useState(false);
  const [pressedDigits, setPressedDigits] = useState<string>('');
  const [ivrStep, setIvrStep] = useState<'language_selection' | 'questionnaire' | 'completed'>('language_selection');
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [liveCallTranscript, setLiveCallTranscript] = useState('');

  const stopRingbackRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<number | null>(null);

  // Start outgoing call simulation
  useEffect(() => {
    // Phase 1: Dialing for 1.2 seconds
    const dialTimer = setTimeout(() => {
      setCallStatus('ringing');
      // Phase 2: Ringing tone for 3.5 seconds
      stopRingbackRef.current = audioFx.playRingbackTone();

      const connectTimer = setTimeout(() => {
        if (stopRingbackRef.current) {
          stopRingbackRef.current();
          stopRingbackRef.current = null;
        }
        setCallStatus('connected');
        playIvrGreeting();
      }, 3500);

      return () => clearTimeout(connectTimer);
    }, 1200);

    return () => {
      clearTimeout(dialTimer);
      if (stopRingbackRef.current) {
        stopRingbackRef.current();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      speechEngine.stopSpeaking();
    };
  }, []);

  // Call duration counter
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = window.setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // Format call duration MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const playIvrGreeting = () => {
    const greeting =
      "Welcome to PM-AJAY Toll-Free IVR Service. For English, press 1. हिंदी के लिए 2 दबाएं. ಕನ್ನಡಕ್ಕಾಗಿ 3 ಒತ್ತಿರಿ.";
    speechEngine.speakPrompt(greeting, false);
  };

  const handleKeyPress = (digit: string) => {
    audioFx.playDtmfTone(digit);
    setPressedDigits((prev) => prev + digit);

    // IVR Menu routing by keypad
    if (ivrStep === 'language_selection') {
      if (digit === '1') {
        onLanguageChange('en');
        startIvrQuestions('en');
      } else if (digit === '2') {
        onLanguageChange('hi');
        startIvrQuestions('hi');
      } else if (digit === '3') {
        onLanguageChange('kn');
        startIvrQuestions('kn');
      }
    } else if (ivrStep === 'questionnaire') {
      // If pressing digits during questions (e.g. 1 for yes, 2 for no on income)
      if (currentQIndex === 2) {
        // Income question
        const val = digit === '1' ? 'Yes (< ₹2.5 Lakh)' : 'No (≥ ₹2.5 Lakh)';
        recordAnswerAndAdvance(val);
      } else if (currentQIndex === 8) {
        // Career preference question
        const val = digit === '1' ? 'Wage Job in Company' : 'Start Own Business';
        recordAnswerAndAdvance(val);
      }
    }
  };

  const startIvrQuestions = (lang: SupportedLanguage) => {
    setIvrStep('questionnaire');
    setCurrentQIndex(0);
    const q1 = QUESTION_DEFINITIONS[0].prompts[lang];
    setTimeout(() => {
      speechEngine.speakPrompt(q1, true);
    }, 500);
  };

  const recordAnswerAndAdvance = (answer: string) => {
    const q = QUESTION_DEFINITIONS[currentQIndex];
    const newAnswers = { ...answers, [q.key]: answer };
    setAnswers(newAnswers);
    setLiveCallTranscript(answer);

    const nextIdx = currentQIndex + 1;
    if (nextIdx < QUESTION_DEFINITIONS.length) {
      setCurrentQIndex(nextIdx);
      const nextQ = QUESTION_DEFINITIONS[nextIdx];
      let promptText = nextQ.prompts[currentLanguage];
      if (nextQ.id === 2 && newAnswers.name) {
        promptText = promptText.replace('{Name}', newAnswers.name);
      }
      setTimeout(() => {
        speechEngine.speakPrompt(promptText, true);
      }, 400);
    } else {
      setIvrStep('completed');
      const name = newAnswers.name || (currentLanguage === 'kn' ? 'ಫಲಾನುಭವಿ' : currentLanguage === 'hi' ? 'लाभार्थी' : 'Beneficiary');
      let closing = "";
      if (currentLanguage === 'kn') {
        closing = `ಧನ್ಯವಾದಗಳು ${name}. ನಿಮ್ಮ ಪಿಎಂ-ಅಜಯ್ ಅರ್ಜಿಯನ್ನು ಟೋಲ್-ಫ್ರೀ ಕರೆ ಮೂಲಕ ಸ್ವೀಕರಿಸಲಾಗಿದೆ.`;
      } else if (currentLanguage === 'hi') {
        closing = `धन्यवाद ${name}। आपका पीएम-अजय आवेदन टोल-फ्री कॉल द्वारा दर्ज कर लिया गया है।`;
      } else {
        closing = `Thank you ${name}. Your PM-AJAY application has been successfully received via Toll-Free Call.`;
      }
      speechEngine.speakPrompt(closing, false);
      setTimeout(() => {
        onCompleteProfile(newAnswers);
      }, 2500);
    }
  };

  // Wire speech transcript during call
  useEffect(() => {
    if (callStatus === 'connected' && ivrStep === 'questionnaire') {
      speechEngine.onTranscript = (transcript: string, isFinal: boolean) => {
        setLiveCallTranscript(transcript);
        if (isFinal && transcript.trim()) {
          recordAnswerAndAdvance(transcript);
        }
      };
    }
  }, [callStatus, ivrStep, currentQIndex, answers, currentLanguage]);

  const handleEndCall = () => {
    if (stopRingbackRef.current) {
      stopRingbackRef.current();
    }
    speechEngine.stopSpeaking();
    audioFx.playCallEndedTone();
    setCallStatus('ended');
    setTimeout(() => {
      onBackToHome();
    }, 1200);
  };

  // Android Native Dial intent trigger
  const handleLaunchNativeDialer = () => {
    window.location.href = 'tel:1800111222';
  };

  return (
    <div id="toll-free-call-screen" className="w-full max-w-lg mx-auto px-4 py-4 sm:py-6 flex flex-col items-center">
      {/* Back button */}
      <div className="w-full flex items-center justify-between mb-4">
        <button
          onClick={handleEndCall}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.backToHome}</span>
        </button>

        <button
          onClick={handleLaunchNativeDialer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-semibold"
          title="Android Intent(Intent.ACTION_DIAL, tel:1800111222)"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>{t.androidDialerButton}</span>
        </button>
      </div>

      {/* Simulated Phone Call Container */}
      <div className="w-full bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col items-center shadow-2xl relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -right-20 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"></div>

        {/* Top Call Info */}
        <div className="flex flex-col items-center text-center mt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-emerald-400 mb-3">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>HD Voice • PM-AJAY IVR</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-wide">
            1800-111-222
          </h2>
          <p className="text-sm font-medium text-amber-400 mt-0.5">
            PM-AJAY National Livelihood Helpline
          </p>

          {/* Status Label / Timer */}
          <div className="mt-3 text-sm font-mono tracking-wider">
            {callStatus === 'dialing' && (
              <span className="text-slate-400 animate-pulse">Dialing...</span>
            )}
            {callStatus === 'ringing' && (
              <span className="text-amber-400 animate-pulse">Ringing...</span>
            )}
            {callStatus === 'connected' && (
              <span className="text-emerald-400 font-bold">{formatTime(callDuration)}</span>
            )}
            {callStatus === 'ended' && (
              <span className="text-rose-400">Call Ended</span>
            )}
          </div>
        </div>

        {/* Call Visualizer / Avatar */}
        <div className="my-7 flex items-center justify-center relative">
          {callStatus === 'connected' ? (
            <div className="relative flex items-center justify-center">
              <div className="w-28 h-28 rounded-full bg-emerald-500/15 animate-ping absolute"></div>
              <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center shadow-lg relative z-10">
                <Phone className="w-10 h-10 text-emerald-400" />
              </div>
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
              <Phone className="w-10 h-10 text-slate-400 animate-bounce" />
            </div>
          )}
        </div>

        {/* IVR Spoken Context / In-Call Guidance */}
        {callStatus === 'connected' && (
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 mb-6 text-center">
            {ivrStep === 'language_selection' ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-amber-300">
                  IVR Voice Prompt:
                </p>
                <p className="text-xs text-slate-200 leading-relaxed">
                  "For English, press 1. हिंदी के लिए 2 दबाएं. ಕನ್ನಡಕ್ಕಾಗಿ 3 ಒತ್ತಿರಿ."
                </p>
                <div className="flex justify-center gap-2 mt-2">
                  <button
                    onClick={() => handleKeyPress('1')}
                    className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 font-medium"
                  >
                    1. English
                  </button>
                  <button
                    onClick={() => handleKeyPress('2')}
                    className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 font-medium"
                  >
                    2. हिंदी
                  </button>
                  <button
                    onClick={() => handleKeyPress('3')}
                    className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 font-medium"
                  >
                    3. ಕನ್ನಡ
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Question {currentQIndex + 1} of 9</span>
                  <span className="text-emerald-400 font-medium">IVR Active</span>
                </div>
                <p className="text-sm font-semibold text-white leading-snug">
                  {QUESTION_DEFINITIONS[currentQIndex].prompts[currentLanguage].replace('{Name}', answers.name || 'Beneficiary')}
                </p>
                {liveCallTranscript && (
                  <p className="text-xs text-amber-300 mt-1 italic">
                    Heard: "{liveCallTranscript}"
                  </p>
                )}
                {/* Quick spoken/keypad hints */}
                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                  {QUESTION_DEFINITIONS[currentQIndex].suggestedAnswers[currentLanguage].slice(0, 3).map((hint, i) => (
                    <button
                      key={i}
                      onClick={() => recordAnswerAndAdvance(hint)}
                      className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DTMF Keypad View (collapsible) */}
        {showKeypad && (
          <div className="w-full max-w-xs mb-6 bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-center font-mono text-lg font-bold text-amber-400 mb-3 h-7 tracking-widest">
              {pressedDigits || ' '}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { d: '1', sub: '' },
                { d: '2', sub: 'ABC' },
                { d: '3', sub: 'DEF' },
                { d: '4', sub: 'GHI' },
                { d: '5', sub: 'JKL' },
                { d: '6', sub: 'MNO' },
                { d: '7', sub: 'PQRS' },
                { d: '8', sub: 'TUV' },
                { d: '9', sub: 'WXYZ' },
                { d: '*', sub: '' },
                { d: '0', sub: '+' },
                { d: '#', sub: '' },
              ].map(({ d, sub }) => (
                <button
                  key={d}
                  onClick={() => handleKeyPress(d)}
                  className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white font-bold text-lg flex flex-col items-center justify-center transition-all border border-slate-750"
                >
                  <span className="leading-tight">{d}</span>
                  {sub && <span className="text-[8px] font-normal text-slate-400 -mt-0.5">{sub}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* In-Call Action Bar: Mute, Keypad, Speaker, End Call */}
        <div className="w-full flex items-center justify-around gap-2 pt-2">
          {/* Mute Toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center transition-all ${
              isMuted
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title={isMuted ? t.unmuteCall : t.muteCall}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Keypad Toggle */}
          <button
            onClick={() => setShowKeypad(!showKeypad)}
            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center transition-all ${
              showKeypad
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title={t.dialPad}
          >
            <Grid className="w-5 h-5" />
          </button>

          {/* Speaker Toggle */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center transition-all ${
              isSpeakerOn
                ? 'bg-slate-700 text-emerald-400'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
            title={isSpeakerOn ? t.speakerOn : t.speakerOff}
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all"
            title={t.endCall}
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

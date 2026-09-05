import React, { useState, useEffect, useRef } from 'react';
import { BeneficiaryProfile, SupportedLanguage } from '../types/pmajay';
import { QUESTION_DEFINITIONS, UI_TRANSLATIONS } from '../data/translations';
import {
  HandHeart,
  Volume2,
  Video,
  VideoOff,
  Camera,
  StopCircle,
  Check,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  GraduationCap,
  MapPin,
  Sparkles,
  Scissors,
  Wrench,
  Tractor,
  Truck,
  RotateCcw
} from 'lucide-react';
import { HalfDuplexVoiceEngine } from '../utils/speech';

interface MuteAssistedScreenProps {
  currentLanguage: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onBackToHome: () => void;
  speechEngine: HalfDuplexVoiceEngine;
  onCompleteProfile: (profile: BeneficiaryProfile) => void;
}

export const MuteAssistedScreen: React.FC<MuteAssistedScreenProps> = ({
  currentLanguage,
  onLanguageChange,
  onBackToHome,
  speechEngine,
  onCompleteProfile,
}) => {
  const t = UI_TRANSLATIONS[currentLanguage];

  const [questionIndex, setQuestionIndex] = useState(0);
  const [profile, setProfile] = useState<BeneficiaryProfile>({
    name: '',
    location: '',
    incomeLessThan2point5Lakh: '',
    education: '',
    traditionalWork: '',
    currentWork: '',
    toolsSkills: '',
    mobilityRadiusKm: '',
    careerPreference: '',
  });

  const [customText, setCustomText] = useState('');
  const [spokenNotification, setSpokenNotification] = useState<string | null>(null);

  // Camera & Video Recording for Sign / Gesture / Workshop Evidence
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isRecordingSignVideo, setIsRecordingSignVideo] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const currentQ = QUESTION_DEFINITIONS[questionIndex];

  // AI speaks the question aloud when questionIndex changes
  useEffect(() => {
    let questionText = currentQ.prompts[currentLanguage];
    if (currentQ.id === 2 && profile.name) {
      questionText = questionText.replace('{Name}', profile.name);
    }

    setSpokenNotification(null);
    speechEngine.speakPrompt(questionText, false);

    return () => {
      speechEngine.stopSpeaking();
    };
  }, [questionIndex, currentLanguage]);

  const handleSelectOption = (value: string) => {
    const updatedProfile: BeneficiaryProfile = {
      ...profile,
      [currentQ.key]: value,
    };
    setProfile(updatedProfile);

    // Speak audio confirmation
    let confirmMsg = '';
    if (currentLanguage === 'kn') {
      confirmMsg = `ಆಯ್ಕೆ ಮಾಡಲಾಗಿದೆ: ${value}`;
    } else if (currentLanguage === 'hi') {
      confirmMsg = `चयनित: ${value}`;
    } else {
      confirmMsg = `Selected: ${value}`;
    }
    setSpokenNotification(confirmMsg);
    speechEngine.speakPrompt(confirmMsg, false);

    setTimeout(() => {
      if (questionIndex + 1 < QUESTION_DEFINITIONS.length) {
        setQuestionIndex(questionIndex + 1);
        setCustomText('');
      } else {
        finishRegistration(updatedProfile);
      }
    }, 1200);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customText.trim()) {
      handleSelectOption(customText.trim());
    }
  };

  const finishRegistration = (finalProfile: BeneficiaryProfile) => {
    stopCameraStream();
    const name = finalProfile.name || (currentLanguage === 'kn' ? 'ಫಲಾನುಭವಿ' : currentLanguage === 'hi' ? 'लाभार्थी' : 'Beneficiary');
    const finalSpeech =
      currentLanguage === 'kn'
        ? `ಧನ್ಯವಾದಗಳು ${name}. ನಿಮ್ಮ ಪಿಎಂ-ಅಜಯ್ ಅರ್ಜಿಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ.`
        : currentLanguage === 'hi'
        ? `धन्यवाद ${name}। आपका पीएम-अजय आवेदन सफलतापूर्वक प्राप्त हो गया है।`
        : `Thank you ${name}. Your PM-AJAY registration is complete.`;

    speechEngine.speakPrompt(finalSpeech, false);

    setTimeout(() => {
      onCompleteProfile({
        ...finalProfile,
        videoRecorded: Boolean(recordedVideoUrl),
        videoBlobUrl: recordedVideoUrl || undefined,
      });
    }, 2000);
  };

  // Video recording logic
  const toggleCamera = async () => {
    if (isVideoActive) {
      stopCameraStream();
      setIsVideoActive(false);
    } else {
      try {
        setIsVideoActive(true);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: true,
        });
        setVideoStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera error:', err);
        alert('Could not access camera for sign video.');
        setIsVideoActive(false);
      }
    }
  };

  const startSignRecording = () => {
    if (!videoStream) return;
    try {
      chunksRef.current = [];
      const rec = new MediaRecorder(videoStream);
      mediaRecorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
      };

      rec.start();
      setIsRecordingSignVideo(true);
    } catch (err) {
      console.error('Recording start error:', err);
    }
  };

  const stopSignRecording = () => {
    if (mediaRecorderRef.current && isRecordingSignVideo) {
      mediaRecorderRef.current.stop();
      setIsRecordingSignVideo(false);
    }
  };

  const stopCameraStream = () => {
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop());
      setVideoStream(null);
    }
  };

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream, isVideoActive]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  return (
    <div id="mute-assisted-screen" className="w-full max-w-2xl mx-auto px-4 py-4 sm:py-6 flex flex-col gap-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            speechEngine.stopSpeaking();
            stopCameraStream();
            onBackToHome();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.backToHome}</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Sign Language / Video Camera Button */}
          <button
            onClick={toggleCamera}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              isVideoActive
                ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
            }`}
            title="Record Sign Language or Work Video"
          >
            {isVideoActive ? <VideoOff className="w-3.5 h-3.5 text-purple-400" /> : <Video className="w-3.5 h-3.5 text-purple-400" />}
            <span>{isVideoActive ? 'Hide Camera' : 'Sign / Gesture Camera'}</span>
          </button>
        </div>
      </div>

      {/* Screen Header Badge */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/40">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
            <HandHeart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">
              {currentLanguage === 'kn'
                ? 'ಮೂಕ / ಸಂಜ್ಞಾ ವಿಶೇಷ ಸಹಾಯಕ ಮೋಡ್'
                : currentLanguage === 'hi'
                ? 'मूक / गैर-मौखिक विशेष सहायक मोड'
                : 'Mute & Non-Verbal Assisted Interaction'}
            </h2>
            <p className="text-[11px] text-purple-300/80">
              AI speaks prompts aloud • Tap visual cards or record sign video
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            const prompt = currentQ.prompts[currentLanguage].replace('{Name}', profile.name || 'Beneficiary');
            speechEngine.speakPrompt(prompt, false);
          }}
          className="p-2 rounded-xl bg-purple-600/30 text-purple-200 hover:bg-purple-600/50 transition-colors"
          title="Speak Question Again"
        >
          <Volume2 className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Track */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-slate-400 font-medium">
          <span>
            {currentLanguage === 'kn' ? 'ಪ್ರಶ್ನೆ' : currentLanguage === 'hi' ? 'प्रश्न' : 'Step'} {questionIndex + 1} of 9
          </span>
          <span className="text-purple-300 font-semibold">{currentQ.shortLabel[currentLanguage]}</span>
        </div>
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-300 rounded-full"
            style={{ width: `${((questionIndex + 1) / 9) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Sign Language / Gesture Camera Stream (If active) */}
      {isVideoActive && (
        <div className="w-full bg-slate-950 rounded-2xl border border-purple-800/60 overflow-hidden relative shadow-lg">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-52 object-cover bg-black"
          />
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-semibold text-white flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-purple-400" />
            <span>Sign Language & Evidence Video</span>
          </div>

          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-2">
            {!isRecordingSignVideo ? (
              <button
                onClick={startSignRecording}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg active:scale-95 transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                <span>Record Sign Response</span>
              </button>
            ) : (
              <button
                onClick={stopSignRecording}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 text-purple-300 font-bold text-xs border border-purple-400 shadow-lg active:scale-95 transition-all"
              >
                <StopCircle className="w-4 h-4 text-rose-400" />
                <span>Save Sign Recording</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Spoken Audio Banner & Question Display */}
      <div className="bg-slate-850 border-2 border-purple-500/40 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">
          <Volume2 className="w-4 h-4 animate-pulse" />
          <span>Spoken Question by AI Assistant</span>
        </div>
        <h3 className="text-lg sm:text-xl font-extrabold text-white leading-relaxed">
          {currentQ.prompts[currentLanguage].replace('{Name}', profile.name || 'Beneficiary')}
        </h3>

        {spokenNotification && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{spokenNotification}</span>
          </div>
        )}
      </div>

      {/* Visual Choice Cards (Tailored per Question) */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {currentLanguage === 'kn' ? 'ಸ್ಪರ್ಶಿಸಿ ಆಯ್ಕೆಮಾಡಿ (ಚಿತ್ರ ಕಾರ್ಡ್‌ಗಳು):' : currentLanguage === 'hi' ? 'स्पर्श करके चुनें (चित्र कार्ड):' : 'Tap Your Choice (Visual Cards):'}
        </span>

        {/* Question 3: Income (Two Massive High-Contrast Cards) */}
        {currentQ.id === 3 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <button
              onClick={() => handleSelectOption(currentLanguage === 'kn' ? 'ಹೌದು (2.5 ಲಕ್ಷಕ್ಕಿಂತ ಕಡಿಮೆ)' : currentLanguage === 'hi' ? 'हाँ (2.5 लाख से कम)' : 'Yes (< ₹2.5 Lakh)')}
              className="p-5 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600 text-white border-2 border-emerald-500 flex flex-col items-center justify-center gap-2 text-center transition-all active:scale-95 shadow-md group"
            >
              <span className="text-3xl">✅</span>
              <span className="text-lg font-bold group-hover:text-slate-950">
                {currentLanguage === 'kn' ? 'ಹೌದು - 2.5 ಲಕ್ಷಕ್ಕಿಂತ ಕಡಿಮೆ' : currentLanguage === 'hi' ? 'हाँ - 2.5 लाख से कम' : 'YES - Below ₹2.5 Lakh'}
              </span>
              <span className="text-xs text-emerald-300 group-hover:text-slate-900 font-medium">
                {currentLanguage === 'kn' ? 'ಪಿಎಂ-ಅಜಯ್ ಪೂರ್ಣ ಅನುದಾನಕ್ಕೆ ಅರ್ಹರು' : currentLanguage === 'hi' ? 'पीएम-अजय पूर्ण अनुदान हेतु पात्र' : 'Full PM-AJAY Grant Eligible'}
              </span>
            </button>

            <button
              onClick={() => handleSelectOption(currentLanguage === 'kn' ? 'ಇಲ್ಲ (2.5 ಲಕ್ಷಕ್ಕಿಂತ ಹೆಚ್ಚು)' : currentLanguage === 'hi' ? 'नहीं (2.5 लाख से अधिक)' : 'No (≥ ₹2.5 Lakh)')}
              className="p-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white border-2 border-slate-700 flex flex-col items-center justify-center gap-2 text-center transition-all active:scale-95 shadow-md"
            >
              <span className="text-3xl">❌</span>
              <span className="text-lg font-bold">
                {currentLanguage === 'kn' ? 'ಇಲ್ಲ - 2.5 ಲಕ್ಷಕ್ಕಿಂತ ಹೆಚ್ಚು' : currentLanguage === 'hi' ? 'नहीं - 2.5 लाख से अधिक' : 'NO - Above ₹2.5 Lakh'}
              </span>
              <span className="text-xs text-slate-400">
                General Assistance Scheme
              </span>
            </button>
          </div>
        ) : currentQ.id === 9 ? (
          /* Question 9: Career Preference (Wage Job vs Business) */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <button
              onClick={() => handleSelectOption(currentLanguage === 'kn' ? 'ಕಂಪನಿಯಲ್ಲಿ ಉದ್ಯೋಗ' : currentLanguage === 'hi' ? 'कंपनी में वेतनभोगी नौकरी' : 'Wage Job in Company')}
              className="p-5 rounded-2xl bg-blue-600/20 hover:bg-blue-600 text-white border-2 border-blue-500 flex flex-col items-center justify-center gap-2 text-center transition-all active:scale-95 shadow-md group"
            >
              <Building2 className="w-10 h-10 text-blue-400 group-hover:text-slate-950" />
              <span className="text-base font-bold group-hover:text-slate-950">
                {currentLanguage === 'kn' ? 'ಕಂಪನಿಯಲ್ಲಿ ಉದ್ಯೋಗ' : currentLanguage === 'hi' ? 'कंपनी में नौकरी' : 'Wage Job in Industry'}
              </span>
              <span className="text-xs text-blue-200 group-hover:text-slate-900">
                Fixed Monthly Salary & Placement
              </span>
            </button>

            <button
              onClick={() => handleSelectOption(currentLanguage === 'kn' ? 'ಸ್ವಂತ ಉದ್ಯಮ / ವ್ಯವಹಾರ' : currentLanguage === 'hi' ? 'अपना खुद का व्यवसाय' : 'Start Own Business / Self-Employed')}
              className="p-5 rounded-2xl bg-amber-600/20 hover:bg-amber-600 text-white border-2 border-amber-500 flex flex-col items-center justify-center gap-2 text-center transition-all active:scale-95 shadow-md group"
            >
              <Briefcase className="w-10 h-10 text-amber-400 group-hover:text-slate-950" />
              <span className="text-base font-bold group-hover:text-slate-950">
                {currentLanguage === 'kn' ? 'ಸ್ವಂತ ಉದ್ಯಮ / ವ್ಯಾಪಾರ' : currentLanguage === 'hi' ? 'अपना खुद का व्यवसाय' : 'Start Own Business'}
              </span>
              <span className="text-xs text-amber-200 group-hover:text-slate-900">
                PM-AJAY Capital Subsidy up to ₹50,000
              </span>
            </button>
          </div>
        ) : (
          /* General Pictorial Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {currentQ.suggestedAnswers[currentLanguage].map((opt, i) => (
              <button
                key={i}
                onClick={() => handleSelectOption(opt)}
                className="p-4 rounded-xl bg-slate-800 hover:bg-purple-600 text-white border border-slate-700 hover:border-purple-400 text-left font-semibold text-sm flex items-center justify-between transition-all active:scale-[0.98] shadow-sm group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-700/80 group-hover:bg-white/20 flex items-center justify-center text-purple-400 group-hover:text-white font-bold">
                    {i + 1}
                  </div>
                  <span>{opt}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-transform" />
              </button>
            ))}
          </div>
        )}

        {/* Custom Input Field for Mute / Typist */}
        <form onSubmit={handleCustomSubmit} className="mt-3 flex gap-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder={
              currentLanguage === 'kn'
                ? 'ಬೇರೆ ಉತ್ತರವನ್ನು ಇಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ...'
                : currentLanguage === 'hi'
                ? 'अन्य उत्तर यहाँ टाइप करें...'
                : 'Or type custom response here...'
            }
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shrink-0"
          >
            <span>Confirm</span>
            <Check className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Navigation skip/back */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => {
            if (questionIndex > 0) setQuestionIndex(questionIndex - 1);
          }}
          disabled={questionIndex === 0}
          className="text-xs text-slate-400 hover:text-white disabled:opacity-30 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Previous Step</span>
        </button>

        <button
          onClick={() => {
            if (questionIndex + 1 < QUESTION_DEFINITIONS.length) {
              setQuestionIndex(questionIndex + 1);
            } else {
              finishRegistration(profile);
            }
          }}
          className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
        >
          <span>Skip / Next</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { BeneficiaryProfile, ConversationState, SupportedLanguage } from '../types/pmajay';
import { QUESTION_DEFINITIONS, SUPPORTED_LANGUAGES, UI_TRANSLATIONS } from '../data/translations';
import {
  Mic,
  MicOff,
  Volume2,
  RotateCcw,
  SkipForward,
  Video,
  VideoOff,
  Send,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Camera,
  StopCircle,
  Play
} from 'lucide-react';
import { HalfDuplexVoiceEngine } from '../utils/speech';

interface VoiceAssistantScreenProps {
  currentLanguage: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onBackToHome: () => void;
  speechEngine: HalfDuplexVoiceEngine;
  onCompleteProfile: (profile: BeneficiaryProfile) => void;
}

export const VoiceAssistantScreen: React.FC<VoiceAssistantScreenProps> = ({
  currentLanguage,
  onLanguageChange,
  onBackToHome,
  speechEngine,
  onCompleteProfile,
}) => {
  const t = UI_TRANSLATIONS[currentLanguage];

  // Phase state: 'language_selection' | 'questionnaire'
  const [phase, setPhase] = useState<'language_selection' | 'questionnaire'>('language_selection');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [conversationState, setConversationState] = useState<ConversationState>('STATE_IDLE');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [aiFeedbackText, setAiFeedbackText] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Profile data
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

  // Manual fallback input modal or inline field
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInputText, setManualInputText] = useState('');

  // Video Recording Mode State
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Waveform animation bar heights
  const [audioBars, setAudioBars] = useState<number[]>([20, 45, 75, 30, 60, 80, 40, 65, 35, 55, 70, 25]);

  // Audio bars animation during speaking or listening
  useEffect(() => {
    let animId: number;
    const updateBars = () => {
      if (conversationState === 'STATE_AI_SPEAKING' || conversationState === 'STATE_LISTENING') {
        setAudioBars((prev) =>
          prev.map(() => Math.floor(Math.random() * 65) + 20)
        );
      } else {
        setAudioBars([15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15]);
      }
      animId = requestAnimationFrame(updateBars);
    };
    animId = requestAnimationFrame(updateBars);
    return () => cancelAnimationFrame(animId);
  }, [conversationState]);

  // Sync speech engine state
  useEffect(() => {
    speechEngine.onStateChange = (state) => {
      setConversationState(state);
    };

    speechEngine.onTranscript = (transcript, isFinal) => {
      setLiveTranscript(transcript);
      if (isFinal && transcript.trim()) {
        handleUserResponse(transcript);
      }
    };

    speechEngine.onError = (err) => {
      console.warn('Speech engine error:', err);
    };

    return () => {
      speechEngine.stopSpeaking();
      speechEngine.cancelListening();
    };
  }, [speechEngine, questionIndex, profile]);

  // Play introductory spoken prompt on initial Phase A load
  useEffect(() => {
    if (phase === 'language_selection') {
      const welcomeSpoken =
        "Welcome to PM-AJAY Livelihood Assistant. Please select your language. अपनी भाषा चुनें. ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.";
      const timer = setTimeout(() => {
        speechEngine.speakPrompt(welcomeSpoken, false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Select language and start questionnaire
  const handleSelectLanguage = (lang: SupportedLanguage) => {
    onLanguageChange(lang);
    speechEngine.setLanguage(lang);
    setPhase('questionnaire');
    setQuestionIndex(0);

    // Speak Question 1
    setTimeout(() => {
      const q1 = QUESTION_DEFINITIONS[0].prompts[lang];
      speechEngine.speakPrompt(q1, true);
    }, 400);
  };

  // Speak Current Question
  const speakCurrentQuestion = (idx = questionIndex, currentProf = profile) => {
    const q = QUESTION_DEFINITIONS[idx];
    if (!q) return;

    let text = q.prompts[currentLanguage];
    if (q.id === 2 && currentProf.name) {
      text = text.replace('{Name}', currentProf.name);
    }

    setAiFeedbackText(null);
    setLiveTranscript('');
    speechEngine.speakPrompt(text, true);
  };

  // Process user answer via Server API (with Gemini AI)
  const handleUserResponse = async (answerText: string) => {
    if (!answerText.trim() || isProcessing) return;

    setIsProcessing(true);
    setConversationState('STATE_PROCESSING');
    speechEngine.cancelListening();

    const currentQ = QUESTION_DEFINITIONS[questionIndex];

    try {
      // Call Server API endpoint
      const res = await fetch('/api/process-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQ.id,
          questionKey: currentQ.key,
          userAnswer: answerText,
          language: currentLanguage,
          currentProfile: profile,
        }),
      });

      const data = await res.json();
      const extractedVal = data.extractedValue || answerText;
      const feedback = data.aiFeedback;

      setAiFeedbackText(feedback);

      const updatedProfile: BeneficiaryProfile = {
        ...profile,
        [currentQ.key]: extractedVal,
      };
      setProfile(updatedProfile);

      // Speak feedback, then advance to next question
      speechEngine.speakPrompt(feedback, false);

      setTimeout(() => {
        setIsProcessing(false);
        if (questionIndex + 1 < QUESTION_DEFINITIONS.length) {
          const nextIdx = questionIndex + 1;
          setQuestionIndex(nextIdx);
          speakCurrentQuestion(nextIdx, updatedProfile);
        } else {
          // Finished all 9 questions
          completeQuestionnaire(updatedProfile);
        }
      }, 2000);
    } catch (err) {
      console.warn('API error, falling back locally:', err);
      const updatedProfile = {
        ...profile,
        [currentQ.key]: answerText,
      };
      setProfile(updatedProfile);
      setIsProcessing(false);

      if (questionIndex + 1 < QUESTION_DEFINITIONS.length) {
        const nextIdx = questionIndex + 1;
        setQuestionIndex(nextIdx);
        speakCurrentQuestion(nextIdx, updatedProfile);
      } else {
        completeQuestionnaire(updatedProfile);
      }
    }
  };

  const completeQuestionnaire = (finalProfile: BeneficiaryProfile) => {
    const name = finalProfile.name || (currentLanguage === 'kn' ? 'ಫಲಾನುಭವಿ' : currentLanguage === 'hi' ? 'लाभार्थी' : 'Beneficiary');
    const summaryMsg =
      currentLanguage === 'kn'
        ? `ಧನ್ಯವಾದಗಳು ${name}. ಪಿಎಂ-ಅಜಯ್ ಕೌಶಲ್ಯ ಶಿಫಾರಸುಗಳಿಗಾಗಿ ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಅನ್ನು ನಾವು ನೋಂದಾಯಿಸಿದ್ದೇವೆ.`
        : currentLanguage === 'hi'
        ? `धन्यवाद ${name}। हमने पीएम-अजय कौशल अनुशंसाओं के लिए आपकी प्रोफ़ाइल पंजीकृत कर ली है।`
        : `Thank you ${name}. We have registered your profile for PM-AJAY skilling recommendations.`;

    speechEngine.speakPrompt(summaryMsg, false);

    // Stop video stream if active
    stopCameraStream();

    setTimeout(() => {
      onCompleteProfile({
        ...finalProfile,
        videoRecorded: Boolean(recordedVideoUrl),
        videoBlobUrl: recordedVideoUrl || undefined,
      });
    }, 2800);
  };

  // Video recording controls
  const toggleVideoMode = async () => {
    if (isVideoMode) {
      stopCameraStream();
      setIsVideoMode(false);
    } else {
      setIsVideoMode(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true,
        });
        setVideoStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera access error:', err);
        alert('Could not access camera. Please check camera and microphone permissions.');
        setIsVideoMode(false);
      }
    }
  };

  const startVideoRecording = () => {
    if (!videoStream) return;
    try {
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(videoStream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
      };

      mediaRecorder.start();
      setIsRecordingVideo(true);
      // Start microphone listening along with video
      speechEngine.startListening();
    } catch (err) {
      console.error('Error starting video recording:', err);
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecordingVideo) {
      mediaRecorderRef.current.stop();
      setIsRecordingVideo(false);
      speechEngine.cancelListening();
    }
  };

  const stopCameraStream = () => {
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop());
      setVideoStream(null);
    }
  };

  // Ensure camera stream binds when video element mounts
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream, isVideoMode]);

  // Clean up media on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Quick fallback answer handler
  const handleSelectQuickAnswer = (chip: string) => {
    setLiveTranscript(chip);
    handleUserResponse(chip);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInputText.trim()) {
      handleUserResponse(manualInputText.trim());
      setManualInputText('');
      setShowManualInput(false);
    }
  };

  const currentQ = QUESTION_DEFINITIONS[questionIndex];

  return (
    <div id="voice-assistant-screen" className="w-full max-w-2xl mx-auto px-4 py-4 sm:py-6 flex flex-col gap-5">
      {/* Top Bar with Back and Camera Toggle */}
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

        {/* Video Mode Switcher */}
        {phase === 'questionnaire' && (
          <button
            id="toggle-video-mode-btn"
            onClick={toggleVideoMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              isVideoMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
            }`}
          >
            {isVideoMode ? <VideoOff className="w-3.5 h-3.5 text-amber-400" /> : <Video className="w-3.5 h-3.5" />}
            <span>{isVideoMode ? t.stopCamera : t.switchCamera}</span>
          </button>
        )}
      </div>

      {/* PHASE A: Spoken Language Selection */}
      {phase === 'language_selection' ? (
        <div className="w-full bg-slate-850 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-4">
            <Volume2 className="w-8 h-8 animate-pulse" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {t.selectLanguagePrompt}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-md">
            {t.selectLanguageSubtitle}
          </p>

          {/* Quick Fallback Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-7">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                id={`choose-lang-${lang.code}`}
                onClick={() => handleSelectLanguage(lang.code)}
                className="group p-4 rounded-2xl bg-slate-800 hover:bg-amber-500 text-white hover:text-slate-950 border border-slate-700 hover:border-amber-400 font-bold transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-1"
              >
                <span className="text-2xl">{lang.flag}</span>
                <span className="text-base">{lang.nativeName}</span>
                <span className="text-[11px] text-slate-400 group-hover:text-slate-900 font-normal">
                  {lang.name}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>You can also speak your preferred language anytime</span>
          </div>
        </div>
      ) : (
        /* PHASE B: Sequential Slot-Filling Dialogue */
        <div className="w-full flex flex-col gap-4">
          {/* Progress Pill Bar */}
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="font-bold text-amber-400">
              Question {questionIndex + 1} of {QUESTION_DEFINITIONS.length}
            </span>
            <span className="text-slate-400">
              {currentQ.category}
            </span>
          </div>

          {/* Progress Track */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${((questionIndex + 1) / QUESTION_DEFINITIONS.length) * 100}%` }}
            ></div>
          </div>

          {/* Real-time Status Pill (Strict Half-Duplex state machine indicator) */}
          <div className="flex justify-center">
            {conversationState === 'STATE_AI_SPEAKING' && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-sm">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                <span>🟡 {t.speakingPill}</span>
              </div>
            )}
            {conversationState === 'STATE_LISTENING' && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>🟢 {t.listeningPill}</span>
              </div>
            )}
            {conversationState === 'STATE_PROCESSING' && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs font-bold shadow-sm">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-spin"></span>
                <span>🔵 {t.processingPill}</span>
              </div>
            )}
            {conversationState === 'STATE_IDLE' && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-semibold">
                <span>⚪ {t.idlePill}</span>
              </div>
            )}
          </div>

          {/* Video / Camera Panel (If activated) */}
          {isVideoMode && (
            <div className="w-full bg-slate-950 rounded-2xl border border-slate-700 overflow-hidden relative shadow-lg">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-56 object-cover bg-black"
              />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-semibold text-white flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span>Live Video Response</span>
              </div>

              {/* Video Recording Controls */}
              <div className="absolute bottom-3 inset-x-0 flex justify-center gap-2">
                {!isRecordingVideo ? (
                  <button
                    onClick={startVideoRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition-all active:scale-95"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                    <span>{t.recordVideoBtn}</span>
                  </button>
                ) : (
                  <button
                    onClick={stopVideoRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 text-amber-300 font-bold text-xs border border-amber-400 shadow-lg transition-all active:scale-95"
                  >
                    <StopCircle className="w-4 h-4 text-rose-400" />
                    <span>{t.stopRecordingBtn}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Live Waveform Visualizer & Central Microphone */}
          <div className="flex flex-col items-center justify-center my-2 select-none">
            <div className="flex items-center justify-center gap-1.5 h-14 mb-3">
              {audioBars.map((height, i) => (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    conversationState === 'STATE_LISTENING'
                      ? 'bg-emerald-400'
                      : conversationState === 'STATE_AI_SPEAKING'
                      ? 'bg-amber-400'
                      : 'bg-slate-700'
                  }`}
                  style={{ height: `${height}%` }}
                ></div>
              ))}
            </div>

            {/* Central Pulse Mic Button */}
            <button
              id="voice-central-mic-btn"
              onClick={() => {
                if (conversationState === 'STATE_AI_SPEAKING') {
                  speechEngine.stopSpeaking();
                } else if (conversationState === 'STATE_LISTENING') {
                  speechEngine.cancelListening();
                } else {
                  speechEngine.startListening();
                }
              }}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 ${
                conversationState === 'STATE_LISTENING'
                  ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/30 shadow-emerald-500/30'
                  : conversationState === 'STATE_AI_SPEAKING'
                  ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/30 shadow-amber-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
              }`}
              title={conversationState === 'STATE_LISTENING' ? 'Listening...' : 'Tap to speak'}
            >
              {conversationState === 'STATE_AI_SPEAKING' ? (
                <Volume2 className="w-9 h-9 animate-pulse" />
              ) : conversationState === 'STATE_LISTENING' ? (
                <Mic className="w-9 h-9 animate-bounce" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>
          </div>

          {/* Current Question Card with Large Readable Typography */}
          <div className="bg-slate-850 border border-slate-750 rounded-2xl p-5 sm:p-6 shadow-md">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center justify-between">
              <span>{currentQ.shortLabel[currentLanguage]}</span>
              <button
                onClick={() => speakCurrentQuestion()}
                className="text-slate-400 hover:text-amber-300 flex items-center gap-1 text-[11px] transition-colors"
                title="Replay Audio"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Replay</span>
              </button>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white leading-relaxed">
              {currentQ.prompts[currentLanguage].replace('{Name}', profile.name || 'Beneficiary')}
            </h3>

            {/* AI Conversational Feedback Box */}
            {aiFeedbackText && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{aiFeedbackText}</span>
              </div>
            )}
          </div>

          {/* Real-time User Transcript Display */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 min-h-[64px] flex flex-col justify-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
              Live Voice Transcript:
            </span>
            <p className="text-sm font-medium text-slate-200">
              {liveTranscript ? (
                <span className="text-amber-300 font-semibold">"{liveTranscript}"</span>
              ) : conversationState === 'STATE_LISTENING' ? (
                <span className="text-slate-400 italic">Listening to your voice...</span>
              ) : (
                <span className="text-slate-500 italic">Awaiting speech input...</span>
              )}
            </p>
          </div>

          {/* Noise Resilience & Fallback Controls */}
          <div className="flex flex-col gap-2.5">
            {/* Quick Suggested Answers */}
            <div className="flex flex-wrap gap-2">
              {currentQ.suggestedAnswers[currentLanguage].map((ans, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectQuickAnswer(ans)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-750 hover:border-amber-400/50 transition-all active:scale-95"
                >
                  {ans}
                </button>
              ))}
            </div>

            {/* Action Bar: Repeat Question & Manual Type/Skip */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                id="voice-repeat-question-btn"
                onClick={() => speakCurrentQuestion()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.repeatQuestion}</span>
              </button>

              <button
                id="voice-skip-type-btn"
                onClick={() => setShowManualInput(!showManualInput)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-amber-300 hover:text-amber-200 text-xs font-semibold border border-slate-700 transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>{t.skipOrType}</span>
              </button>
            </div>

            {/* Manual text input fallback drawer/field */}
            {showManualInput && (
              <form onSubmit={handleManualSubmit} className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={manualInputText}
                  onChange={(e) => setManualInputText(e.target.value)}
                  placeholder={`Type answer for: ${currentQ.shortLabel[currentLanguage]}`}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

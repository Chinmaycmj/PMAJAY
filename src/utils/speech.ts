import { ConversationState, SupportedLanguage } from '../types/pmajay';
import { audioFx } from './audio';

// Type definitions for Web Speech API
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface IWindowWithSpeech extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
}

export class HalfDuplexVoiceEngine {
  private currentLanguage: SupportedLanguage = 'kn';
  private state: ConversationState = 'STATE_IDLE';
  private recognition: SpeechRecognitionInstance | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private guardTimeout: number | null = null;
  private isRecognitionAvailable = false;

  public onStateChange?: (state: ConversationState) => void;
  public onTranscript?: (finalTranscript: string, isFinal: boolean) => void;
  public onError?: (errorMessage: string) => void;

  constructor() {
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindowWithSpeech) : null;
    if (!win) return;

    const SpeechRecClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRecClass) {
      try {
        this.recognition = new SpeechRecClass();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.isRecognitionAvailable = true;

        this.recognition.onstart = () => {
          this.setState('STATE_LISTENING');
          audioFx.playMicChime('open');
        };

        this.recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            if (result.isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript.trim()) {
            if (this.onTranscript) {
              this.onTranscript(finalTranscript.trim(), true);
            }
            this.setState('STATE_PROCESSING');
          } else if (interimTranscript.trim() && this.onTranscript) {
            this.onTranscript(interimTranscript.trim(), false);
          }
        };

        this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (event.error === 'no-speech') {
            // Natural silence, stay ready or allow repeat
            this.setState('STATE_IDLE');
          } else if (event.error === 'not-allowed') {
            this.setState('STATE_IDLE');
            this.onError?.('Microphone access was denied. Please allow microphone permissions.');
          } else {
            this.setState('STATE_IDLE');
          }
        };

        this.recognition.onend = () => {
          if (this.state === 'STATE_LISTENING') {
            this.setState('STATE_IDLE');
          }
        };
      } catch {
        this.isRecognitionAvailable = false;
      }
    }
  }

  public setLanguage(lang: SupportedLanguage) {
    this.currentLanguage = lang;
    if (this.recognition) {
      const tag = lang === 'kn' ? 'kn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
      this.recognition.lang = tag;
    }
  }

  public getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  public getState(): ConversationState {
    return this.state;
  }

  public getIsRecognitionAvailable(): boolean {
    return this.isRecognitionAvailable;
  }

  private setState(newState: ConversationState) {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  }

  /**
   * Strict Half-Duplex Step 1:
   * Cancel any active SpeechRecognizer.
   * Play TTS voice.
   * Strict Step 2:
   * On done -> wait 300ms acoustic guard delay.
   * Strict Step 3:
   * Only then start SpeechRecognizer.
   */
  public speakPrompt(text: string, autoListen = true) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.onError?.('Speech synthesis not supported in this browser.');
      return;
    }

    // Step 1: Immediately cancel speech recognition to prevent acoustic echo and feedback
    this.cancelListening();
    this.setState('STATE_AI_SPEAKING');

    window.speechSynthesis.cancel();
    if (this.guardTimeout !== null) {
      clearTimeout(this.guardTimeout);
      this.guardTimeout = null;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;

    const localeTag = this.currentLanguage === 'kn' ? 'kn-IN' : this.currentLanguage === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.lang = localeTag;

    // Pitch & speech rate optimized for Indic cadence
    utterance.rate = 0.92;
    utterance.pitch = 1.0;

    // Try finding the most natural localized voice if available
    const voices = window.speechSynthesis.getVoices();
    const localizedVoice = voices.find(
      (v) =>
        v.lang === localeTag ||
        v.lang.toLowerCase().replace('_', '-').startsWith(this.currentLanguage)
    );
    if (localizedVoice) {
      utterance.voice = localizedVoice;
    }

    utterance.onstart = () => {
      this.cancelListening();
      this.setState('STATE_AI_SPEAKING');
    };

    utterance.onend = () => {
      this.setState('STATE_IDLE');

      if (autoListen) {
        // Acoustic guard delay of 300ms so speaker reverb dissipates
        this.guardTimeout = window.setTimeout(() => {
          this.guardTimeout = null;
          this.startListening();
        }, 300);
      }
    };

    utterance.onerror = () => {
      this.setState('STATE_IDLE');
    };

    window.speechSynthesis.speak(utterance);
  }

  public startListening() {
    if (typeof window === 'undefined') return;

    // Prevent listening if AI is currently speaking
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    if (!this.recognition) {
      this.initSpeechRecognition();
    }

    if (this.recognition) {
      try {
        const localeTag = this.currentLanguage === 'kn' ? 'kn-IN' : this.currentLanguage === 'hi' ? 'hi-IN' : 'en-IN';
        this.recognition.lang = localeTag;
        this.recognition.start();
        this.setState('STATE_LISTENING');
      } catch (err: unknown) {
        // Recognition already started or error
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('already started')) {
          this.setState('STATE_IDLE');
        }
      }
    } else {
      this.setState('STATE_IDLE');
      this.onError?.('Microphone speech recognition is not supported in this browser. You can tap quick options or type.');
    }
  }

  public cancelListening() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignored
      }
    }
  }

  public stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.guardTimeout !== null) {
      clearTimeout(this.guardTimeout);
      this.guardTimeout = null;
    }
    this.setState('STATE_IDLE');
  }

  public release() {
    this.stopSpeaking();
    this.cancelListening();
    this.recognition = null;
    this.currentUtterance = null;
  }
}

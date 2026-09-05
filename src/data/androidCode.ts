export interface AndroidSourceFile {
  fileName: string;
  path: string;
  language: string;
  description: string;
  code: string;
}

export const ANDROID_FILES: AndroidSourceFile[] = [
  {
    fileName: 'AudioConversationManager.kt',
    path: 'app/src/main/java/gov/pmajay/assistant/audio/AudioConversationManager.kt',
    language: 'kotlin',
    description: 'Solves BUG 1 (Echo/Interruption) & BUG 2 (Kannada synthesis failure). Strict half-duplex FSM, Google TTS package targeting, 300ms acoustic guard delay, mutual exclusion.',
    code: `package gov.pmajay.assistant.audio

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * AudioConversationManager enforces a strict Half-Duplex State Machine.
 * Solves:
 * 1. Acoustic Echo & Mic Feedback by guaranteeing SpeechRecognizer is NEVER active during TTS.
 * 2. Kannada (kn-IN) synthesis failure by targeting "com.google.android.tts" and verifying engine readiness.
 */
enum class ConversationState {
    STATE_IDLE,
    STATE_AI_SPEAKING,
    STATE_LISTENING,
    STATE_PROCESSING
}

class AudioConversationManager(
    private val context: Context,
    private val onTranscriptResult: (String) -> Unit,
    private val onPartialTranscript: (String) -> Unit = {},
    private val onErrorEncountered: (String) -> Unit = {}
) {
    companion object {
        private const val TAG = "AudioConversationMgr"
        private const val GOOGLE_TTS_PACKAGE = "com.google.android.tts"
        private const val ACOUSTIC_GUARD_DELAY_MS = 300L
        private const val UTTERANCE_PREFIX = "pmajay_utt_"
    }

    private val mainScope = CoroutineScope(Dispatchers.Main + Job())
    private val mainHandler = Handler(Looper.getMainLooper())

    private var textToSpeech: TextToSpeech? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private var isTtsInitialized = false
    private var currentLanguageTag: String = "en-IN"

    private val _conversationState = MutableStateFlow(ConversationState.STATE_IDLE)
    val conversationState: StateFlow<ConversationState> = _conversationState.asStateFlow()

    init {
        initializeTextToSpeech()
        initializeSpeechRecognizer()
    }

    /**
     * Explicitly target Google's TTS Engine package ("com.google.android.tts")
     * to resolve Kannada (kn-IN) missing voices on OEM devices.
     */
    private fun initializeTextToSpeech() {
        textToSpeech = TextToSpeech(context, { status ->
            if (status == TextToSpeech.SUCCESS) {
                isTtsInitialized = true
                applyLocale(currentLanguageTag)
                setupUtteranceListener()
                Log.d(TAG, "Google TTS Engine initialized successfully")
            } else {
                Log.e(TAG, "Failed to initialize Google TTS engine with status: $status")
                // Fallback to default system engine if Google TTS is not present
                fallbackToDefaultTts()
            }
        }, GOOGLE_TTS_PACKAGE)
    }

    private fun fallbackToDefaultTts() {
        textToSpeech = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                isTtsInitialized = true
                applyLocale(currentLanguageTag)
                setupUtteranceListener()
            }
        }
    }

    private fun setupUtteranceListener() {
        textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                // Strict Half-Duplex: Ensure microphone is CANCELLED and MUTED
                mainScope.launch {
                    cancelSpeechRecognizer()
                    _conversationState.value = ConversationState.STATE_AI_SPEAKING
                    Log.d(TAG, "TTS onStart: Mic cancelled. State = STATE_AI_SPEAKING")
                }
            }

            override fun onDone(utteranceId: String?) {
                // Wait for acoustic guard window before opening microphone
                mainScope.launch {
                    Log.d(TAG, "TTS onDone: Entering acoustic guard window ($ACOUSTIC_GUARD_DELAY_MS ms)...")
                    delay(ACOUSTIC_GUARD_DELAY_MS)
                    _conversationState.value = ConversationState.STATE_LISTENING
                    startListeningInternal()
                }
            }

            override fun onError(utteranceId: String?) {
                mainScope.launch {
                    Log.e(TAG, "TTS onError for utteranceId: $utteranceId")
                    _conversationState.value = ConversationState.STATE_IDLE
                    onErrorEncountered("Audio synthesis failed. Please retry.")
                }
            }
        })
    }

    private fun initializeSpeechRecognizer() {
        if (SpeechRecognizer.isRecognitionAvailable(context)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
                setRecognitionListener(createRecognitionListener())
            }
        } else {
            onErrorEncountered("Native SpeechRecognizer not available on device.")
        }
    }

    private fun createRecognitionListener(): RecognitionListener {
        return object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                Log.d(TAG, "STT Ready for speech")
            }

            override fun onBeginningOfSpeech() {
                Log.d(TAG, "User started speaking")
            }

            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {
                Log.d(TAG, "User stopped speaking")
                _conversationState.value = ConversationState.STATE_PROCESSING
            }

            override fun onError(error: Int) {
                Log.w(TAG, "STT onError code: $error")
                mainScope.launch {
                    _conversationState.value = ConversationState.STATE_IDLE
                    // Gracefully allow manual repeat or retry
                    val message = when (error) {
                        SpeechRecognizer.ERROR_NO_MATCH -> "No speech recognized. Please tap Repeat or speak clearly."
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Listening timed out. Tap Repeat to hear again."
                        else -> "Recognition error ($error). Tap Retry."
                    }
                    onErrorEncountered(message)
                }
            }

            override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val recognizedText = matches?.firstOrNull() ?: ""
                Log.d(TAG, "STT onResults: $recognizedText")
                _conversationState.value = ConversationState.STATE_PROCESSING
                onTranscriptResult(recognizedText)
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                matches?.firstOrNull()?.let { onPartialTranscript(it) }
            }

            override fun onEvent(eventType: Int, params: Bundle?) {}
        }
    }

    /**
     * Apply target locale with Indic pitch/rate tuning.
     */
    fun setLanguage(languageTag: String) {
        currentLanguageTag = languageTag
        applyLocale(languageTag)
    }

    private fun applyLocale(languageTag: String) {
        val targetLocale = when (languageTag) {
            "kn", "kn-IN" -> Locale.forLanguageTag("kn-IN")
            "hi", "hi-IN" -> Locale.forLanguageTag("hi-IN")
            else -> Locale.forLanguageTag("en-IN")
        }

        textToSpeech?.let { tts ->
            val availability = tts.isLanguageAvailable(targetLocale)
            if (availability == TextToSpeech.LANG_MISSING_DATA || availability == TextToSpeech.LANG_NOT_SUPPORTED) {
                Log.w(TAG, "TTS Locale $targetLocale missing or unsupported. Triggering system voice pack.")
                onErrorEncountered("Voice pack for \${targetLocale.displayLanguage} is missing. Please download Google Speech Services.")
            } else {
                tts.language = targetLocale
                // Indic cadence optimization: 0.9f speech rate gives crystal clear articulation
                tts.setSpeechRate(0.9f)
                tts.setPitch(1.0f)
            }
        }
    }

    /**
     * Primary entry point for speaking a prompt.
     * Enforces mutual exclusion: speechRecognizer is stopped before speaking begins.
     */
    fun speakPrompt(text: String, utteranceId: String = "\${UTTERANCE_PREFIX}\${System.currentTimeMillis()}") {
        cancelSpeechRecognizer()
        _conversationState.value = ConversationState.STATE_AI_SPEAKING

        val params = Bundle().apply {
            putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
        }
        textToSpeech?.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
    }

    private fun startListeningInternal() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, currentLanguageTag)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, currentLanguageTag)
            putExtra(RecognizerIntent.EXTRA_ONLY_COMPLETE_PATH, true)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }
        try {
            speechRecognizer?.startListening(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting SpeechRecognizer", e)
            _conversationState.value = ConversationState.STATE_IDLE
        }
    }

    fun cancelSpeechRecognizer() {
        try {
            speechRecognizer?.cancel()
        } catch (e: Exception) {
            Log.e(TAG, "Error cancelling SpeechRecognizer", e)
        }
    }

    fun stopSpeaking() {
        textToSpeech?.stop()
        _conversationState.value = ConversationState.STATE_IDLE
    }

    fun release() {
        cancelSpeechRecognizer()
        speechRecognizer?.destroy()
        speechRecognizer = null
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null
        _conversationState.value = ConversationState.STATE_IDLE
    }
}
`,
  },
  {
    fileName: 'VoiceAssistantViewModel.kt',
    path: 'app/src/main/java/gov/pmajay/assistant/ui/viewmodel/VoiceAssistantViewModel.kt',
    language: 'kotlin',
    description: 'Manages conversation state machine, 9 sequential slot-filling questions, entity injection, and multilingual profiles.',
    code: `package gov.pmajay.assistant.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import gov.pmajay.assistant.audio.AudioConversationManager
import gov.pmajay.assistant.audio.ConversationState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class Question(
    val id: Int,
    val key: String,
    val textEn: String,
    val textHi: String,
    val textKn: String
) {
    fun getText(lang: String, name: String = ""): String {
        val template = when (lang) {
            "kn-IN" -> textKn
            "hi-IN" -> textHi
            else -> textEn
        }
        return template.replace("{Name}", if (name.isNotBlank()) name else "Beneficiary")
    }
}

data class BeneficiaryProfile(
    val name: String = "",
    val location: String = "",
    val incomeLessThan2point5Lakh: String = "",
    val education: String = "",
    val traditionalWork: String = "",
    val currentWork: String = "",
    val toolsSkills: String = "",
    val mobilityRadiusKm: String = "",
    val careerPreference: String = ""
)

class VoiceAssistantViewModel(application: Application) : AndroidViewModel(application) {

    private val questions = listOf(
        Question(1, "name",
            "Welcome to PM-AJAY Livelihood Assistant. Let's find the best training or business grant for you. First, what is your name?",
            "पीएम-अजय आजीविका सहायक में आपका स्वागत है। आइए आपके लिए सर्वोत्तम प्रशिक्षण या व्यावसायिक अनुदान खोजें। सबसे पहले, आपका नाम क्या है?",
            "ಪಿಎಂ-ಅಜಯ್ ಜೀವನೋಪಾಯ ಸಹಾಯಕಕ್ಕೆ ಸುಸ್ವಾಗತ. ನಿಮಗಾಗಿ ಉತ್ತಮ ತರಬೇತಿ ಅಥವಾ ಅನುದಾನವನ್ನು ಹುಡುಕೋಣ. ಮೊದಲನೆಯದಾಗಿ, ನಿಮ್ಮ ಹೆಸರೇನು?"
        ),
        Question(2, "location",
            "Namaste {Name}. Please tell me your District or your 6-digit Pincode.",
            "नमस्ते {Name}। कृपया अपना जिला या अपना 6 अंकों का पिनकोड बताएं।",
            "ನಮಸ್ಕಾರ {Name}. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಜಿಲ್ಲೆ ಅಥವಾ 6 ಅಂಕಿಯ ಪಿನ್ಕೋಡ್ ತಿಳಿಸಿ."
        ),
        Question(3, "income",
            "Is your family's total annual income less than 2.5 Lakh rupees? Please say Yes or No.",
            "क्या आपके परिवार की कुल वार्षिक आय 2.5 लाख रुपये से कम है? कृपया हाँ या ना कहें।",
            "ನಿಮ್ಮ ಕುಟುಂಬದ ಒಟ್ಟು ವಾರ್ಷಿಕ ಆದಾಯ 2.5 ಲಕ್ಷ ರೂಪಾಯಿಗಳಿಗಿಂತ ಕಡಿಮೆಯಿದೆಯೇ? ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ."
        ),
        Question(4, "education",
            "What is the highest class you have studied up to?",
            "आपने अधिकतम किस कक्षा तक पढ़ाई की है?",
            "ನೀವು ಗರಿಷ್ಠ ಯಾವ ತರಗತಿಯವರೆಗೆ ಓದಿದ್ದೀರಿ?"
        ),
        Question(5, "traditionalWork",
            "Does your family have a traditional work, like farming, weaving, or carpentry? Tell me what it is.",
            "क्या आपके परिवार का कोई पारंपरिक काम है, जैसे खेती, बुनाई या बढ़ईगीरी? मुझे बताएं कि वह क्या है।",
            "ನಿಮ್ಮ ಕುಟುಂಬಕ್ಕೆ ಕೃಷಿ, ನೇಯ್ಗೆ ಅಥವಾ ಮರಗೆಲಸದಂತಹ ಸಾಂಪ್ರದಾಯಿಕ ಕೆಲಸವಿದೆಯೇ? ಅದು ಏನು ಎಂದು ತಿಳಿಸಿ."
        ),
        Question(6, "currentWork",
            "And what work are you doing right now to earn a living?",
            "और आजीविका कमाने के लिए आप अभी क्या काम कर रहे हैं?",
            "ಜೀವನೋಪಾಯಕ್ಕಾಗಿ ನೀವು ಪ್ರಸ್ತುತ ಯಾವ ಕೆಲಸ ಮಾಡುತ್ತಿದ್ದೀರಿ?"
        ),
        Question(7, "toolsSkills",
            "What tools, machines, or specific skills do you already know how to use?",
            "आप कौन से उपकरण, मशीनें या विशिष्ट कौशल का उपयोग करना पहले से जानते हैं?",
            "ನಿಮಗೆ ಈಗಾಗಲೇ ಯಾವ ಉಪಕರಣಗಳು ಅಥವಾ ಕೌಶಲ್ಯಗಳನ್ನು ಬಳಸಲು ತಿಳಿದಿದೆ?"
        ),
        Question(8, "mobilityRadius",
            "How far can you travel every day for training? Tell me the distance in kilometers.",
            "प्रशिक्षण के लिए आप प्रतिदिन कितनी दूरी तय कर सकते हैं? मुझे किलोमीटर में दूरी बताएं।",
            "ತರಬೇತಿಗಾಗಿ ನೀವು ಪ್ರತಿದಿನ ಎಷ್ಟು ಕಿಲೋಮೀಟರ್ ಪ್ರಯಾಣಿಸಬಹುದು?"
        ),
        Question(9, "careerPreference",
            "Do you want to get a wage job at a company, or do you want to start your own business?",
            "क्या आप किसी कंपनी में वेतनभोगी नौकरी पाना चाहते हैं, या अपना खुद का व्यवसाय शुरू करना चाहते हैं?",
            "ನೀವು ಕಂಪನಿಯಲ್ಲಿ ಉದ್ಯೋಗ ಪಡೆಯಲು ಬಯಸುತ್ತೀರಾ ಅಥವಾ ನಿಮ್ಮ ಸ್ವಂತ ವ್ಯವಹಾರವನ್ನು ಪ್ರಾರಂಭಿಸಲು ಬಯಸುತ್ತೀರಾ?"
        )
    )

    private val _selectedLanguage = MutableStateFlow("kn-IN")
    val selectedLanguage: StateFlow<String> = _selectedLanguage.asStateFlow()

    private val _currentQuestionIndex = MutableStateFlow(0)
    val currentQuestionIndex: StateFlow<Int> = _currentQuestionIndex.asStateFlow()

    private val _liveTranscript = MutableStateFlow("")
    val liveTranscript: StateFlow<String> = _liveTranscript.asStateFlow()

    private val _profile = MutableStateFlow(BeneficiaryProfile())
    val profile: StateFlow<BeneficiaryProfile> = _profile.asStateFlow()

    private val _isCompleted = MutableStateFlow(false)
    val isCompleted: StateFlow<Boolean> = _isCompleted.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val audioManager = AudioConversationManager(
        context = application.applicationContext,
        onTranscriptResult = { transcript -> handleUserSpeechInput(transcript) },
        onPartialTranscript = { partial -> _liveTranscript.value = partial },
        onErrorEncountered = { error -> _errorMessage.value = error }
    )

    val conversationState = audioManager.conversationState

    fun selectLanguage(languageTag: String) {
        _selectedLanguage.value = languageTag
        audioManager.setLanguage(languageTag)
        askCurrentQuestion()
    }

    fun askCurrentQuestion() {
        val idx = _currentQuestionIndex.value
        if (idx < questions.size) {
            val q = questions[idx]
            val prompt = q.getText(_selectedLanguage.value, _profile.value.name)
            audioManager.speakPrompt(prompt)
        } else {
            completeQuestionnaire()
        }
    }

    fun handleUserSpeechInput(transcript: String) {
        if (transcript.isBlank()) return
        _liveTranscript.value = transcript

        val idx = _currentQuestionIndex.value
        if (idx >= questions.size) return

        val q = questions[idx]
        updateSlotValue(q.key, transcript)

        if (idx + 1 < questions.size) {
            _currentQuestionIndex.value = idx + 1
            askCurrentQuestion()
        } else {
            completeQuestionnaire()
        }
    }

    private fun updateSlotValue(key: String, value: String) {
        _profile.update { current ->
            when (key) {
                "name" -> current.copy(name = value)
                "location" -> current.copy(location = value)
                "income" -> current.copy(incomeLessThan2point5Lakh = value)
                "education" -> current.copy(education = value)
                "traditionalWork" -> current.copy(traditionalWork = value)
                "currentWork" -> current.copy(currentWork = value)
                "toolsSkills" -> current.copy(toolsSkills = value)
                "mobilityRadius" -> current.copy(mobilityRadiusKm = value)
                "careerPreference" -> current.copy(careerPreference = value)
                else -> current
            }
        }
    }

    private fun completeQuestionnaire() {
        _isCompleted.value = true
        val name = _profile.value.name
        val summaryPrompt = when (_selectedLanguage.value) {
            "kn-IN" -> "ಧನ್ಯವಾದಗಳು $name. ಪಿಎಂ-ಅಜಯ್ ಕೌಶಲ್ಯ ಶಿಫಾರಸುಗಳಿಗಾಗಿ ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಅನ್ನು ನಾವು ನೋಂದಾಯಿಸಿದ್ದೇವೆ."
            "hi-IN" -> "धन्यवाद $name। हमने पीएम-अजय कौशल अनुशंसाओं के लिए आपकी प्रोफ़ाइल पंजीकृत कर ली है।"
            else -> "Thank you $name. We have registered your profile for PM-AJAY skilling recommendations."
        }
        audioManager.speakPrompt(summaryPrompt)
    }

    fun repeatQuestion() {
        askCurrentQuestion()
    }

    fun skipCurrentQuestion(fallbackValue: String = "Not Specified") {
        val idx = _currentQuestionIndex.value
        if (idx < questions.size) {
            updateSlotValue(questions[idx].key, fallbackValue)
            if (idx + 1 < questions.size) {
                _currentQuestionIndex.value = idx + 1
                askCurrentQuestion()
            } else {
                completeQuestionnaire()
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        audioManager.release()
    }
}
`,
  },
  {
    fileName: 'VoiceAssistantScreen.kt',
    path: 'app/src/main/java/gov/pmajay/assistant/ui/screens/VoiceAssistantScreen.kt',
    language: 'kotlin',
    description: 'Jetpack Compose Material 3 UI displaying real-time status pills, live visualizer waveforms, high-contrast questions, and fallback controls.',
    code: `package gov.pmajay.assistant.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import gov.pmajay.assistant.audio.ConversationState
import gov.pmajay.assistant.ui.viewmodel.VoiceAssistantViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VoiceAssistantScreen(
    viewModel: VoiceAssistantViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.conversationState.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val questionIndex by viewModel.currentQuestionIndex.collectAsState()
    val transcript by viewModel.liveTranscript.collectAsState()
    val isCompleted by viewModel.isCompleted.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("PM-AJAY Livelihood Assistant", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Real-Time Status Pill
            StatusPill(state = state)

            // Dynamic Visualizer Icon
            PulsingAudioIndicator(state = state)

            // Current Question Display
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text(
                        text = "Question \${questionIndex + 1} of 9",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Live Spoken Question Active",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Real-time transcript display
            Card(
                modifier = Modifier.fillMaxWidth().height(100.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("User Response Transcript:", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = if (transcript.isNotBlank()) transcript else "Awaiting your voice input...",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            // Noise Resilience Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                OutlinedButton(
                    onClick = { viewModel.repeatQuestion() },
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Repeat Question")
                }

                Button(
                    onClick = { viewModel.skipCurrentQuestion() },
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.SkipNext, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Type / Skip")
                }
            }
        }
    }
}

@Composable
fun StatusPill(state: ConversationState) {
    val (bgColor, textColor, label) = when (state) {
        ConversationState.STATE_AI_SPEAKING -> Triple(Color(0xFFFFF3CD), Color(0xFF856404), "🟡 AI Speaking... (Mic Off)")
        ConversationState.STATE_LISTENING -> Triple(Color(0xFFD4EDDA), Color(0xFF155724), "🟢 Listening... Speak Now")
        ConversationState.STATE_PROCESSING -> Triple(Color(0xFFCCE5FF), Color(0xFF004085), "🔵 Processing...")
        ConversationState.STATE_IDLE -> Triple(Color(0xFFE2E3E5), Color(0xFF383D41), "⚪ Ready")
    }

    Surface(
        color = bgColor,
        shape = RoundedCornerShape(50),
        modifier = Modifier.padding(vertical = 8.dp)
    ) {
        Text(
            text = label,
            color = textColor,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )
    }
}

@Composable
fun PulsingAudioIndicator(state: ConversationState) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.25f,
        animationSpec = infiniteRepeatable(
            animation = tween(600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    Box(
        modifier = Modifier
            .size(90.dp)
            .scale(if (state == ConversationState.STATE_AI_SPEAKING || state == ConversationState.STATE_LISTENING) pulseScale else 1f)
            .background(
                color = if (state == ConversationState.STATE_LISTENING) Color(0xFF2E7D32) else Color(0xFF1565C0),
                shape = CircleShape
            ),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = if (state == ConversationState.STATE_AI_SPEAKING) Icons.Default.VolumeUp else Icons.Default.Mic,
            contentDescription = null,
            tint = Color.White,
            modifier = Modifier.size(44.dp)
        )
    }
}
`,
  },
  {
    fileName: 'AndroidManifest.xml',
    path: 'app/src/main/AndroidManifest.xml',
    language: 'xml',
    description: 'Android manifest declaring RECORD_AUDIO, CALL_PHONE, INTERNET, and required <queries> for speech recognition and TTS packages.',
    code: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="gov.pmajay.assistant">

    <!-- Runtime Permissions -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CALL_PHONE" />

    <!-- Android 11+ Package Visibility Declarations for SpeechRecognizer and TTS -->
    <queries>
        <!-- Speech Recognition Service Query -->
        <intent>
            <action android:name="android.speech.RecognitionService" />
        </intent>
        <!-- Text-to-Speech Engine Query -->
        <intent>
            <action android:name="android.intent.action.TTS_SERVICE" />
        </intent>
        <!-- Explicit Google TTS Package Query -->
        <package android:name="com.google.android.tts" />
    </queries>

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="PM-AJAY Assistant"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.PMAJAYAssistant">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.PMAJAYAssistant">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`,
  },
  {
    fileName: 'build.gradle.kts',
    path: 'app/build.gradle.kts',
    language: 'kotlin',
    description: 'Gradle dependencies configuring Jetpack Compose BOM, Material 3, Coroutines, and ViewModel runtime.',
    code: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "gov.pmajay.assistant"
    compileSdk = 34

    defaultConfig {
        applicationId = "gov.pmajay.assistant"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildFeatures {
        compose = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.11"
    }
}

dependencies {
    // Jetpack Compose BOM
    val composeBom = platform("androidx.compose:compose-bom:2024.04.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    // Android Lifecycle & Coroutines
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")
}
`,
  },
];

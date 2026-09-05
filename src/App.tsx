import React, { useState, useMemo } from 'react';
import { ActiveScreen, BeneficiaryProfile, SupportedLanguage } from './types/pmajay';
import { HalfDuplexVoiceEngine } from './utils/speech';
import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { TollFreeCallScreen } from './components/TollFreeCallScreen';
import { VoiceAssistantScreen } from './components/VoiceAssistantScreen';
import { MuteAssistedScreen } from './components/MuteAssistedScreen';
import { ProfileSummaryModal } from './components/ProfileSummaryModal';
import { AndroidCodeHubModal } from './components/AndroidCodeHubModal';
import { UI_TRANSLATIONS } from './data/translations';

export default function App() {
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('kn');
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('home');
  const [isAndroidShell, setIsAndroidShell] = useState<boolean>(false);
  const [isCodeHubOpen, setIsCodeHubOpen] = useState<boolean>(false);
  const [completedProfile, setCompletedProfile] = useState<BeneficiaryProfile | null>(null);

  // Singleton instance of the strict half-duplex speech engine
  const speechEngine = useMemo(() => new HalfDuplexVoiceEngine(), []);

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setCurrentLanguage(newLang);
    speechEngine.setLanguage(newLang);
  };

  const handleProfileComplete = (profileData: BeneficiaryProfile | Record<string, string>) => {
    const rawMap = profileData as Record<string, unknown>;
    const finalProf: BeneficiaryProfile = {
      name: (rawMap.name as string) || '',
      location: (rawMap.location as string) || '',
      incomeLessThan2point5Lakh: (rawMap.incomeLessThan2point5Lakh as string) || (rawMap.income as string) || '',
      education: (rawMap.education as string) || '',
      traditionalWork: (rawMap.traditionalWork as string) || '',
      currentWork: (rawMap.currentWork as string) || '',
      toolsSkills: (rawMap.toolsSkills as string) || '',
      mobilityRadiusKm: (rawMap.mobilityRadiusKm as string) || (rawMap.mobilityRadius as string) || '',
      careerPreference: (rawMap.careerPreference as string) || '',
      videoRecorded: Boolean(rawMap.videoRecorded),
      videoBlobUrl: (rawMap.videoBlobUrl as string) || undefined,
      registeredAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      registrationId: `PMAJAY-${Math.floor(100000 + Math.random() * 900000)}`,
    };
    setCompletedProfile(finalProf);
    setActiveScreen('summary');
  };

  const activeTitle =
    activeScreen === 'call'
      ? 'Toll-Free Call (1800-111-222)'
      : activeScreen === 'voice_assistant'
      ? 'In-App Voice Assistant'
      : activeScreen === 'mute_assisted'
      ? 'Mute & Non-Verbal Mode'
      : activeScreen === 'summary'
      ? 'Registration Confirmation'
      : undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Header */}
      <Header
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
        isAndroidShell={isAndroidShell}
        onToggleAndroidShell={() => setIsAndroidShell(!isAndroidShell)}
        onOpenCodeHub={() => setIsCodeHubOpen(true)}
        onGoHome={() => {
          speechEngine.stopSpeaking();
          speechEngine.cancelListening();
          setActiveScreen('home');
        }}
        activeScreenTitle={activeTitle}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4">
        {isAndroidShell ? (
          /* Android Smartphone Mockup Shell */
          <div className="w-full max-w-[420px] my-4 rounded-[44px] bg-slate-900 border-[10px] border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col min-h-[720px] max-h-[850px] relative">
            {/* Android Status Bar */}
            <div className="h-7 bg-slate-950 px-6 flex items-center justify-between text-[11px] font-medium text-slate-400 select-none border-b border-slate-850">
              <span>9:41</span>
              {/* Camera Notch Hole */}
              <div className="w-4 h-4 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-black"></div>
              </div>
              <div className="flex items-center gap-1.5">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>

            {/* Screen Content Inside Device */}
            <div className="flex-1 overflow-y-auto bg-slate-900 flex flex-col">
              {activeScreen === 'home' && (
                <HomeScreen
                  currentLanguage={currentLanguage}
                  onSelectCall={() => setActiveScreen('call')}
                  onSelectVoiceAssistant={() => setActiveScreen('voice_assistant')}
                  onSelectMuteAssisted={() => setActiveScreen('mute_assisted')}
                  onOpenCodeHub={() => setIsCodeHubOpen(true)}
                  speechEngine={speechEngine}
                />
              )}

              {activeScreen === 'call' && (
                <TollFreeCallScreen
                  currentLanguage={currentLanguage}
                  onLanguageChange={handleLanguageChange}
                  onBackToHome={() => setActiveScreen('home')}
                  speechEngine={speechEngine}
                  onCompleteProfile={handleProfileComplete}
                />
              )}

              {activeScreen === 'voice_assistant' && (
                <VoiceAssistantScreen
                  currentLanguage={currentLanguage}
                  onLanguageChange={handleLanguageChange}
                  onBackToHome={() => setActiveScreen('home')}
                  speechEngine={speechEngine}
                  onCompleteProfile={handleProfileComplete}
                />
              )}

              {activeScreen === 'mute_assisted' && (
                <MuteAssistedScreen
                  currentLanguage={currentLanguage}
                  onLanguageChange={handleLanguageChange}
                  onBackToHome={() => setActiveScreen('home')}
                  speechEngine={speechEngine}
                  onCompleteProfile={handleProfileComplete}
                />
              )}

              {activeScreen === 'summary' && completedProfile && (
                <ProfileSummaryModal
                  profile={completedProfile}
                  currentLanguage={currentLanguage}
                  onReturnHome={() => setActiveScreen('home')}
                  onRestartSession={() => {
                    setCompletedProfile(null);
                    setActiveScreen('voice_assistant');
                  }}
                />
              )}
            </div>

            {/* Android Navigation Gesture Bar */}
            <div className="h-5 bg-slate-950 flex items-center justify-center border-t border-slate-850">
              <div className="w-28 h-1 rounded-full bg-slate-600"></div>
            </div>
          </div>
        ) : (
          /* Full Responsive View */
          <div className="w-full flex-1 flex flex-col items-center justify-start max-w-5xl">
            {activeScreen === 'home' && (
              <HomeScreen
                currentLanguage={currentLanguage}
                onSelectCall={() => setActiveScreen('call')}
                onSelectVoiceAssistant={() => setActiveScreen('voice_assistant')}
                onSelectMuteAssisted={() => setActiveScreen('mute_assisted')}
                onOpenCodeHub={() => setIsCodeHubOpen(true)}
                speechEngine={speechEngine}
              />
            )}

            {activeScreen === 'call' && (
              <TollFreeCallScreen
                currentLanguage={currentLanguage}
                onLanguageChange={handleLanguageChange}
                onBackToHome={() => setActiveScreen('home')}
                speechEngine={speechEngine}
                onCompleteProfile={handleProfileComplete}
              />
            )}

            {activeScreen === 'voice_assistant' && (
              <VoiceAssistantScreen
                currentLanguage={currentLanguage}
                onLanguageChange={handleLanguageChange}
                onBackToHome={() => setActiveScreen('home')}
                speechEngine={speechEngine}
                onCompleteProfile={handleProfileComplete}
              />
            )}

            {activeScreen === 'mute_assisted' && (
              <MuteAssistedScreen
                currentLanguage={currentLanguage}
                onLanguageChange={handleLanguageChange}
                onBackToHome={() => setActiveScreen('home')}
                speechEngine={speechEngine}
                onCompleteProfile={handleProfileComplete}
              />
            )}

            {activeScreen === 'summary' && completedProfile && (
              <ProfileSummaryModal
                profile={completedProfile}
                currentLanguage={currentLanguage}
                onReturnHome={() => setActiveScreen('home')}
                onRestartSession={() => {
                  setCompletedProfile(null);
                  setActiveScreen('voice_assistant');
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* Production Kotlin Android Code Viewer Modal */}
      <AndroidCodeHubModal
        isOpen={isCodeHubOpen}
        onClose={() => setIsCodeHubOpen(false)}
      />

      {/* Footer */}
      <footer className="w-full border-t border-slate-850 bg-slate-950/80 py-3 text-center text-xs text-slate-500 select-none">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>
            {UI_TRANSLATIONS[currentLanguage].govTitle}
          </span>
          <span className="text-[11px] text-slate-600">
            Jetpack Compose Material 3 & Indic Native Speech Architecture
          </span>
        </div>
      </footer>
    </div>
  );
}

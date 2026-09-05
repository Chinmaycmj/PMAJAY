import React from 'react';
import { SupportedLanguage } from '../types/pmajay';
import { SUPPORTED_LANGUAGES, UI_TRANSLATIONS } from '../data/translations';
import { Phone, Sparkles, Smartphone, Code2, Volume2, Globe } from 'lucide-react';

interface HeaderProps {
  currentLanguage: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  isAndroidShell: boolean;
  onToggleAndroidShell: () => void;
  onOpenCodeHub: () => void;
  onGoHome: () => void;
  activeScreenTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentLanguage,
  onLanguageChange,
  isAndroidShell,
  onToggleAndroidShell,
  onOpenCodeHub,
  onGoHome,
  activeScreenTitle,
}) => {
  const t = UI_TRANSLATIONS[currentLanguage];

  return (
    <header id="app-header" className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Logo and Scheme Name */}
        <div
          id="header-brand"
          onClick={onGoHome}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-emerald-600 p-0.5 shadow-lg shadow-orange-500/10">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-black text-amber-400 text-lg">
              अ
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Government of India
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                PM-AJAY
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight group-hover:text-amber-300 transition-colors">
              {t.appTitle}
            </h1>
          </div>
        </div>

        {/* Center / Screen indicator */}
        {activeScreenTitle && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-medium text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            {activeScreenTitle}
          </div>
        )}

        {/* Right side controls: Language Picker, Android Frame toggle, Kotlin Code hub */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Selector */}
          <div id="language-selector-group" className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = currentLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  id={`lang-btn-${lang.code}`}
                  onClick={() => onLanguageChange(lang.code)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                  title={lang.nativeName}
                >
                  {lang.code === 'kn' ? 'ಕನ್ನಡ' : lang.code === 'hi' ? 'हिंदी' : 'EN'}
                </button>
              );
            })}
          </div>

          {/* Android Device Frame Toggle */}
          <button
            id="toggle-android-shell-btn"
            onClick={onToggleAndroidShell}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              isAndroidShell
                ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="Toggle Android Device Mockup Frame"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{isAndroidShell ? 'Android View' : 'Full Screen'}</span>
          </button>

          {/* Kotlin Code Hub Button */}
          <button
            id="open-android-code-btn"
            onClick={onOpenCodeHub}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-xs font-semibold transition-all shadow-sm"
            title="View Production Android Jetpack Compose Code"
          >
            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xs:inline">Kotlin Source</span>
            <span className="text-[10px] px-1 bg-emerald-500/20 text-emerald-300 rounded font-mono">v1.0</span>
          </button>
        </div>
      </div>
    </header>
  );
};

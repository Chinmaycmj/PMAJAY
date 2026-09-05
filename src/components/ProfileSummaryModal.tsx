import React, { useEffect } from 'react';
import { BeneficiaryProfile, SupportedLanguage } from '../types/pmajay';
import { UI_TRANSLATIONS } from '../data/translations';
import {
  ShieldCheck,
  CheckCircle2,
  Download,
  RotateCcw,
  Video,
  Sparkles,
  Award,
  Calendar,
  Building,
  User,
  MapPin,
  Banknote,
  GraduationCap,
  Hammer,
  Briefcase,
  Wrench,
  Navigation
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ProfileSummaryModalProps {
  profile: BeneficiaryProfile;
  currentLanguage: SupportedLanguage;
  onReturnHome: () => void;
  onRestartSession: () => void;
}

export const ProfileSummaryModal: React.FC<ProfileSummaryModalProps> = ({
  profile,
  currentLanguage,
  onReturnHome,
  onRestartSession,
}) => {
  const t = UI_TRANSLATIONS[currentLanguage];

  const registrationId = profile.registrationId || `PMAJAY-${Math.floor(100000 + Math.random() * 900000)}`;
  const regDate = profile.registeredAt || new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  useEffect(() => {
    // Launch celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'],
      });
    } catch {
      // Ignored
    }
  }, []);

  const handleExportJson = () => {
    const fullData = {
      scheme: 'Pradhan Mantri Anusuchit Jaati Abhyuday Yojana (PM-AJAY)',
      ministry: 'Ministry of Social Justice and Empowerment, Government of India',
      registrationId,
      registrationDate: regDate,
      language: currentLanguage,
      beneficiary: profile,
    };
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pmajay-registration-${registrationId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isIncomeEligible =
    profile.incomeLessThan2point5Lakh.toLowerCase().includes('yes') ||
    profile.incomeLessThan2point5Lakh.includes('हाँ') ||
    profile.incomeLessThan2point5Lakh.includes('ಹೌದು');

  return (
    <div id="summary-confirmation-screen" className="w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-900/60 via-slate-850 to-slate-900 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto mb-3 shadow-lg">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold mb-2 border border-emerald-500/30">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{t.summaryTitle}</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold text-white">
          {t.summaryDesc.replace('{Name}', profile.name || 'Beneficiary')}
        </h2>

        <div className="mt-4 inline-flex items-center gap-3 px-4 py-2 bg-slate-900/80 rounded-xl border border-slate-700 text-xs font-mono text-amber-400">
          <span>{t.registrationNumber} <strong className="text-white">{registrationId}</strong></span>
          <span>•</span>
          <span>{t.timestamp} <strong className="text-white">{regDate}</strong></span>
        </div>
      </div>

      {/* Grant & Scheme Eligibility Badge */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-emerald-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
          <Award className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-300">
            {t.grantEligible}
          </h4>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
            {isIncomeEligible
              ? 'Qualified for 100% free residential NSDC Skill certification + enterprise seed grant assistance under PM-AJAY Special Central Assistance.'
              : 'Empanelled for PM-AJAY advanced industry placement, wage-employment linkages, and enterprise credit support.'}
          </p>
        </div>
      </div>

      {/* Profile Details Card */}
      <div className="bg-slate-850 border border-slate-750 rounded-2xl p-5 sm:p-6 shadow-md">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-amber-400" />
          <span>Extracted Beneficiary Profile Data</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          {/* 1. Name */}
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5">Beneficiary Name</span>
            <span className="text-sm font-bold text-white">{profile.name || 'Not specified'}</span>
          </div>

          {/* 2. Location */}
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5">District / Pincode</span>
            <span className="text-sm font-bold text-white">{profile.location || 'Not specified'}</span>
          </div>

          {/* 3. Income */}
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5">Annual Income &lt; ₹2.5L</span>
            <span className="text-sm font-bold text-emerald-400">{profile.incomeLessThan2point5Lakh || 'Not specified'}</span>
          </div>

          {/* 4. Education */}
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5">Highest Qualification</span>
            <span className="text-sm font-bold text-white">{profile.education || 'Not specified'}</span>
          </div>

          {/* 5. Traditional Skill */}
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5">Traditional Skill / Craft</span>
            <span className="text-sm font-bold text-amber-300">{profile.traditionalWork || 'None'}</span>
          </div>

          {/* 6. Current Work */}
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5">Current Occupation</span>
            <span className="text-sm font-bold text-white">{profile.currentWork || 'Not specified'}</span>
          </div>

          {/* 7. Tools & Skills */}
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5">Familiar Tools & Machinery</span>
            <span className="text-sm font-bold text-white">{profile.toolsSkills || 'Not specified'}</span>
          </div>

          {/* 8. Mobility */}
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5">Daily Commute Radius</span>
            <span className="text-sm font-bold text-white">{profile.mobilityRadiusKm || 'Not specified'}</span>
          </div>

          {/* 9. Career Preference */}
          <div className="sm:col-span-2 p-3.5 bg-gradient-to-r from-slate-800 to-slate-750 rounded-xl border border-slate-700">
            <span className="text-slate-400 block mb-0.5">Aspiration / Career Preference</span>
            <span className="text-sm font-bold text-amber-400">{profile.careerPreference || 'Not specified'}</span>
          </div>

          {/* Video Attachment Evidence Preview (if recorded) */}
          {profile.videoBlobUrl && (
            <div className="sm:col-span-2 p-3.5 bg-slate-800 rounded-xl border border-slate-700 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <Video className="w-4 h-4" />
                <span>Beneficiary Video Recording Attached</span>
              </div>
              <video
                src={profile.videoBlobUrl}
                controls
                className="w-full max-h-48 rounded-lg bg-black"
              />
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          onClick={onReturnHome}
          className="flex-1 min-w-[140px] px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs sm:text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2"
        >
          <span>{t.backToHome}</span>
        </button>

        <button
          onClick={handleExportJson}
          className="flex-1 min-w-[160px] px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span>{t.downloadJson}</span>
        </button>

        <button
          onClick={onRestartSession}
          className="px-4 py-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          title={t.restartQuestionnaire}
        >
          <RotateCcw className="w-4 h-4" />
          <span>{t.restartQuestionnaire}</span>
        </button>
      </div>
    </div>
  );
};

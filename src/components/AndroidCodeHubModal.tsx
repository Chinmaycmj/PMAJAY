import React, { useState } from 'react';
import { ANDROID_FILES, AndroidSourceFile } from '../data/androidCode';
import {
  X,
  Code2,
  Copy,
  Check,
  Download,
  FileCode,
  Smartphone,
  ShieldAlert,
  Cpu,
  Radio,
  Sparkles
} from 'lucide-react';

interface AndroidCodeHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidCodeHubModal: React.FC<AndroidCodeHubModalProps> = ({ isOpen, onClose }) => {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentFile: AndroidSourceFile = ANDROID_FILES[activeFileIndex];

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentFile.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadFile = () => {
    const blob = new Blob([currentFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="android-code-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
    >
      <div
        id="android-code-modal-window"
        className="w-full max-w-5xl h-[92vh] max-h-[850px] bg-slate-900 border border-slate-750 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  Android Jetpack Compose & Native Speech Source Code
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                  Staff Engineer Artifacts
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Production-grade Kotlin implementation solving Acoustic Echo & Kannada (kn-IN) synthesis bugs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Close Code Hub"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bug Solved Badges */}
        <div className="px-5 py-2.5 bg-slate-850 border-b border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-400 font-semibold">Architectural Highlights:</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            <Radio className="w-3.5 h-3.5" />
            <span>BUG 1 Solved: Strict Half-Duplex FSM + 300ms Guard Delay</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
            <Cpu className="w-3.5 h-3.5" />
            <span>BUG 2 Solved: "com.google.android.tts" Package Targeting for kn-IN</span>
          </div>
        </div>

        {/* Tab Selector for Files */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 bg-slate-950 border-b border-slate-800 overflow-x-auto select-none">
          {ANDROID_FILES.map((file, idx) => {
            const isActive = idx === activeFileIndex;
            return (
              <button
                key={file.fileName}
                onClick={() => setActiveFileIndex(idx)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-transparent'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{file.fileName}</span>
              </button>
            );
          })}
        </div>

        {/* File Description & Action Bar */}
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="truncate text-slate-300">
            <span className="text-slate-500 font-mono mr-2">{currentFile.path}</span>
            <span className="text-slate-400">{currentFile.description}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium border border-slate-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Code'}</span>
            </button>

            <button
              onClick={handleDownloadFile}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Code Content Container */}
        <div className="flex-1 overflow-auto bg-slate-950 p-4 font-mono text-xs text-slate-200 leading-relaxed select-text">
          <pre className="whitespace-pre font-mono">
            <code>{currentFile.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

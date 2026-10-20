import React from 'react';
import {
  Video,
  Play,
  Download,
  Sparkles,
  Monitor,
  Smartphone,
  Square,
  Settings2,
  RefreshCw,
} from 'lucide-react';
import { AspectRatio, StudioSettings } from '../types';

interface HeaderProps {
  onOpenRecorder: () => void;
  onLoadSample: () => void;
  onOpenExport: () => void;
  studioSettings: StudioSettings;
  onUpdateStudioSettings: (settings: Partial<StudioSettings>) => void;
  isRecordingActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenRecorder,
  onLoadSample,
  onOpenExport,
  studioSettings,
  onUpdateStudioSettings,
  isRecordingActive = false,
}) => {
  return (
    <header className="h-14 border-b border-neutral-800/80 bg-neutral-900/90 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 via-pink-600 to-violet-600 shadow-lg shadow-rose-500/20 text-white font-black text-sm tracking-wider">
          SF
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-extrabold text-base tracking-tight text-white">
            ScreenForge
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Open Studio 4K
          </span>
        </div>
      </div>

      {/* Center Quick Canvas Controls */}
      <div className="hidden md:flex items-center gap-1.5 bg-neutral-950/80 p-1 rounded-lg border border-neutral-800">
        <button
          onClick={() => onUpdateStudioSettings({ aspectRatio: '16:9' })}
          className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
            studioSettings.aspectRatio === '16:9'
              ? 'bg-neutral-800 text-white shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
          title="16:9 Landscape (Desktop & YouTube)"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>16:9</span>
        </button>
        <button
          onClick={() => onUpdateStudioSettings({ aspectRatio: '9:16' })}
          className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
            studioSettings.aspectRatio === '9:16'
              ? 'bg-neutral-800 text-white shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
          title="9:16 Vertical (Shorts, TikTok, Reels)"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>9:16</span>
        </button>
        <button
          onClick={() => onUpdateStudioSettings({ aspectRatio: '1:1' })}
          className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
            studioSettings.aspectRatio === '1:1'
              ? 'bg-neutral-800 text-white shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
          title="1:1 Square (Instagram & Social)"
        >
          <Square className="w-3.5 h-3.5" />
          <span>1:1</span>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onLoadSample}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/60 transition-all flex items-center gap-1.5 shadow-sm"
          title="Load demonstration session with realistic cursor telemetry"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Demo Session</span>
        </button>

        <button
          onClick={onOpenRecorder}
          disabled={isRecordingActive}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
            isRecordingActive
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-neutral-800 hover:bg-neutral-700/80 text-white border border-neutral-700/80'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>Record Screen</span>
        </button>

        <button
          onClick={onOpenExport}
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 hover:from-rose-400 hover:to-purple-500 shadow-md shadow-rose-500/25 active:scale-98 transition-all flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export 4K</span>
        </button>

        <a
          href="https://github.com/alexandrmotologa/screenforge"
          target="_blank"
          rel="noreferrer"
          className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-all"
          title="GitHub Repository"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
        </a>
      </div>
    </header>
  );
};

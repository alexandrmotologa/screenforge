import React, { useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  ZoomIn,
  MousePointer,
  Clock,
  Volume2,
  VolumeX,
  Keyboard,
} from 'lucide-react';
import { IdleInterval } from '../engine/idleCompressor';
import { KeystrokeItem, ZoomKeyframe } from '../types';

interface TimelineProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  zoomKeyframes: ZoomKeyframe[];
  inPoint: number;
  outPoint: number;
  clickTimestamps: number[];
  keystrokes: KeystrokeItem[];
  idleIntervals: IdleInterval[];
  audioClickEnabled: boolean;
  onToggleAudioClick: () => void;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onChangePlaybackRate: (rate: number) => void;
  onAddZoomKeyframe: (time: number) => void;
  onRemoveZoomKeyframe: (id: string) => void;
  onUpdateKeyframe: (id: string, updates: Partial<ZoomKeyframe>) => void;
  onSetInPoint: (time: number) => void;
  onSetOutPoint: (time: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  duration,
  currentTime,
  isPlaying,
  playbackRate,
  zoomKeyframes,
  inPoint,
  outPoint,
  clickTimestamps,
  keystrokes,
  idleIntervals,
  audioClickEnabled,
  onToggleAudioClick,
  onSeek,
  onTogglePlay,
  onChangePlaybackRate,
  onAddZoomKeyframe,
  onRemoveZoomKeyframe,
  onSetInPoint,
  onSetOutPoint,
}) => {
  const rulerRef = useRef<HTMLDivElement | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current || duration <= 0) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  const safeDuration = duration > 0 ? duration : 1;
  const playheadPercent = (currentTime / safeDuration) * 100;
  const inPointPercent = (inPoint / safeDuration) * 100;
  const outPointPercent = (outPoint / safeDuration) * 100;

  return (
    <div className="h-56 sm:h-60 bg-neutral-900/95 border-t border-neutral-800/90 flex flex-col z-20 select-none">
      {/* Top Playback Toolbar */}
      <div className="h-11 px-3 sm:px-4 border-b border-neutral-800/80 flex items-center justify-between overflow-x-auto gap-2">
        {/* Left: Transport controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => onSeek(0)}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-all"
            title="Rewind to start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSeek(Math.max(0, currentTime - 1 / 30))}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-all"
            title="Step back 1 frame"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-neutral-100 hover:bg-white text-neutral-950 flex items-center justify-center font-bold shadow-md hover:scale-105 active:scale-95 transition-all"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={() => onSeek(Math.min(duration, currentTime + 1 / 30))}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-all"
            title="Step forward 1 frame"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Timecode readout */}
          <div className="ml-1 sm:ml-2 font-mono text-[11px] sm:text-xs font-semibold tracking-wider text-neutral-300 bg-neutral-950/70 px-2 py-0.5 sm:py-1 rounded-md border border-neutral-800 whitespace-nowrap">
            <span className="text-rose-400">{formatTime(currentTime)}</span>
            <span className="text-neutral-500 mx-1">/</span>
            <span className="hidden sm:inline">{formatTime(duration)}</span>
            <span className="sm:hidden">{Math.round(duration)}s</span>
          </div>

          {/* Audio Click Sound FX Toggle */}
          <button
            onClick={onToggleAudioClick}
            className={`px-1.5 sm:px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 border transition-all whitespace-nowrap ${
              audioClickEnabled
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                : 'bg-neutral-950/70 border-neutral-800 text-neutral-500 hover:text-neutral-300'
            }`}
            title="Toggle Web Audio Tactile Click Sounds"
          >
            {audioClickEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="hidden md:inline">Click FX</span>
          </button>
        </div>

        {/* Center: Add Zoom at Playhead & In/Out Points */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => onAddZoomKeyframe(currentTime)}
            className="px-2 sm:px-2.5 py-1 text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap"
            title="Insert auto-zoom block at current playhead"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Add Zoom Keyframe</span>
            <span className="sm:hidden">Zoom</span>
          </button>

          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => onSetInPoint(currentTime)}
              className="px-2 py-1 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 rounded border border-neutral-800 transition-all whitespace-nowrap"
              title="Set In-Point"
            >
              [ In
            </button>
            <button
              onClick={() => onSetOutPoint(currentTime)}
              className="px-2 py-1 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 rounded border border-neutral-800 transition-all whitespace-nowrap"
              title="Set Out-Point"
            >
              Out ]
            </button>
          </div>
        </div>

        {/* Right: Speed selector */}
        <div className="hidden sm:flex items-center gap-1 bg-neutral-950/60 p-0.5 rounded-lg border border-neutral-800 text-xs shrink-0">
          {[0.5, 1, 1.5, 2].map((rate) => (
            <button
              key={rate}
              onClick={() => onChangePlaybackRate(rate)}
              className={`px-2 py-0.5 rounded font-mono font-medium transition-all ${
                playbackRate === rate
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>

      {/* Main Track Workspace with Dedicated Left Header Gutter */}
      <div className="flex-1 px-3 sm:px-4 py-2 flex flex-col gap-1.5 overflow-hidden">
        {/* Row 0: Time Ruler */}
        <div className="flex items-center gap-2">
          {/* Left Gutter Header */}
          <div className="w-20 sm:w-28 shrink-0 flex items-center gap-1.5 px-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
            <Clock className="w-3 h-3 text-neutral-400 shrink-0" />
            <span className="hidden sm:inline">Timeline</span>
          </div>

          {/* Right Trackbed: Ruler with Idle Ramp Spans */}
          <div
            ref={rulerRef}
            onClick={handleRulerClick}
            className="flex-1 relative h-6 bg-neutral-950/80 rounded-md border border-neutral-800/80 cursor-pointer overflow-hidden"
          >
            {/* Trim Range Overlay */}
            <div
              className="absolute top-0 bottom-0 bg-neutral-800/30 border-x border-rose-500/40 pointer-events-none"
              style={{
                left: `${inPointPercent}%`,
                width: `${Math.max(0, outPointPercent - inPointPercent)}%`,
              }}
            />

            {/* Idle Speed Ramping Visual Indicators */}
            {idleIntervals.map((idle) => {
              const startPct = (idle.startTime / safeDuration) * 100;
              const widthPct = (idle.duration / safeDuration) * 100;
              return (
                <div
                  key={idle.id}
                  className="absolute top-0 bottom-0 bg-amber-500/20 border-x border-amber-500/40 pointer-events-none [background:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(245,158,11,0.2)_4px,rgba(245,158,11,0.2)_8px)]"
                  style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                  title={`Smart Idle Ramp (${idle.duration.toFixed(1)}s inactive)`}
                />
              );
            })}

            {/* Playhead Marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 shadow-sm z-30 pointer-events-none"
              style={{ left: `${playheadPercent}%` }}
            >
              <div className="w-2.5 h-2.5 bg-rose-500 rounded-sm -ml-1 -mt-0.5 shadow-md shadow-rose-500/50" />
            </div>

            {/* Tick markers */}
            {Array.from({ length: 21 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-neutral-800/60 pointer-events-none text-[9px] font-mono text-neutral-600 pl-1"
                style={{ left: `${i * 5}%` }}
              >
                {i % 4 === 0 && `${((i * 5 * safeDuration) / 100).toFixed(0)}s`}
              </div>
            ))}
          </div>
        </div>

        {/* Row 1: Auto-Zoom Keyframe Segments */}
        <div className="flex items-center gap-2">
          {/* Left Gutter Header (Fixed, zero collision with blocks) */}
          <div className="w-20 sm:w-28 shrink-0 h-10 flex items-center gap-1.5 px-2 rounded-md bg-neutral-950/80 border border-neutral-800/80 text-[10px] font-bold text-rose-400 uppercase tracking-wider">
            <ZoomIn className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline truncate">Auto-Zoom</span>
            <span className="sm:hidden">Zoom</span>
          </div>

          {/* Right Trackbed */}
          <div className="flex-1 relative h-10 bg-neutral-950/60 rounded-md border border-neutral-800/60 overflow-hidden">
            {zoomKeyframes.map((kf) => {
              const startPct = (kf.startTime / safeDuration) * 100;
              const endPct = (kf.endTime / safeDuration) * 100;
              const widthPct = Math.max(3, endPct - startPct);
              const isSelected = currentTime >= kf.startTime && currentTime <= kf.endTime;

              return (
                <div
                  key={kf.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(kf.startTime);
                  }}
                  className={`group absolute top-1 bottom-1 rounded-md px-2 flex items-center justify-between text-xs font-semibold cursor-pointer border transition-all ${
                    isSelected
                      ? 'bg-rose-500/35 border-rose-400 text-white shadow-md shadow-rose-500/25 ring-1 ring-rose-400/40'
                      : 'bg-rose-500/20 border-rose-500/40 text-rose-200 hover:bg-rose-500/30'
                  }`}
                  style={{
                    left: `${startPct}%`,
                    width: `${widthPct}%`,
                  }}
                  title={`Zoom Block: ${kf.scale.toFixed(1)}x (${kf.startTime.toFixed(1)}s - ${kf.endTime.toFixed(1)}s)`}
                >
                  <div className="flex items-center gap-1 truncate min-w-0">
                    <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-500/40 text-rose-100 shrink-0">
                      {kf.scale.toFixed(1)}x
                    </span>
                    <span className="truncate text-[11px] font-medium hidden sm:inline ml-1 text-neutral-200">
                      {kf.label || 'Zoom'}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveZoomKeyframe(kf.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-red-400 transition-opacity ml-1 shrink-0"
                    title="Delete keyframe"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 2: Mouse Telemetry & Click Bursts */}
        <div className="flex items-center gap-2">
          {/* Left Gutter Header */}
          <div className="w-20 sm:w-28 shrink-0 h-7 flex items-center gap-1.5 px-2 rounded-md bg-neutral-950/80 border border-neutral-800/80 text-[10px] font-bold text-sky-400 uppercase tracking-wider">
            <MousePointer className="w-3 h-3 shrink-0" />
            <span className="hidden sm:inline truncate">Clicks</span>
            <span className="sm:hidden">Click</span>
          </div>

          {/* Right Trackbed */}
          <div className="flex-1 relative h-7 bg-neutral-950/60 rounded-md border border-neutral-800/60 overflow-hidden">
            {clickTimestamps.map((ts, idx) => {
              const pct = (ts / (safeDuration * 1000)) * 100;
              return (
                <div
                  key={idx}
                  className="absolute top-1.5 bottom-1.5 w-2 -ml-1 rounded-full bg-pink-500/90 shadow-sm pointer-events-none flex items-center justify-center animate-pulse"
                  style={{ left: `${pct}%` }}
                  title={`Click Event @ ${(ts / 1000).toFixed(2)}s`}
                >
                  <div className="w-1 h-1 rounded-full bg-white" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 3: Keycasting HUD Shortcut Logs */}
        <div className="flex items-center gap-2">
          {/* Left Gutter Header */}
          <div className="w-20 sm:w-28 shrink-0 h-7 flex items-center gap-1.5 px-2 rounded-md bg-neutral-950/80 border border-neutral-800/80 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
            <Keyboard className="w-3 h-3 shrink-0" />
            <span className="hidden sm:inline truncate">Keycasts</span>
            <span className="sm:hidden">Keys</span>
          </div>

          {/* Right Trackbed */}
          <div className="flex-1 relative h-7 bg-neutral-950/60 rounded-md border border-neutral-800/60 overflow-hidden">
            {keystrokes.map((k) => {
              const pct = (k.timestamp / (safeDuration * 1000)) * 100;
              const keyLabel = [...k.modifiers, k.key].join('+');
              return (
                <div
                  key={k.id}
                  className="absolute top-1 bottom-1 px-1.5 rounded bg-neutral-800/90 border border-neutral-700/80 text-[10px] font-mono font-bold text-neutral-200 flex items-center justify-center shadow-sm pointer-events-none whitespace-nowrap"
                  style={{ left: `${pct}%` }}
                  title={`Keystroke: ${keyLabel} @ ${(k.timestamp / 1000).toFixed(2)}s`}
                >
                  {keyLabel}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

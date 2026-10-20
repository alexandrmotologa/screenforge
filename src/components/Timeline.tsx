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
  Scissors,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ZoomKeyframe } from '../types';

interface TimelineProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  zoomKeyframes: ZoomKeyframe[];
  inPoint: number;
  outPoint: number;
  clickTimestamps: number[];
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
  onSeek,
  onTogglePlay,
  onChangePlaybackRate,
  onAddZoomKeyframe,
  onRemoveZoomKeyframe,
  onUpdateKeyframe,
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
    <div className="h-56 bg-neutral-900/95 border-t border-neutral-800/90 flex flex-col z-20 select-none">
      {/* Top Playback Toolbar */}
      <div className="h-11 px-4 border-b border-neutral-800/80 flex items-center justify-between">
        {/* Left: Transport controls */}
        <div className="flex items-center gap-2">
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
            className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-white text-neutral-950 flex items-center justify-center font-bold shadow-md hover:scale-105 active:scale-95 transition-all"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
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
          <div className="ml-3 font-mono text-xs font-semibold tracking-wider text-neutral-300 bg-neutral-950/70 px-2.5 py-1 rounded-md border border-neutral-800">
            <span className="text-rose-400">{formatTime(currentTime)}</span>
            <span className="text-neutral-500 mx-1">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Center: Add Zoom at Playhead */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAddZoomKeyframe(currentTime)}
            className="px-2.5 py-1 text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-md transition-all flex items-center gap-1.5"
            title="Insert auto-zoom block at current playhead"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Zoom Keyframe</span>
          </button>

          <button
            onClick={() => onSetInPoint(currentTime)}
            className="px-2 py-1 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 rounded border border-neutral-800 transition-all"
            title="Set In-Point"
          >
            [ In
          </button>
          <button
            onClick={() => onSetOutPoint(currentTime)}
            className="px-2 py-1 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 rounded border border-neutral-800 transition-all"
            title="Set Out-Point"
          >
            Out ]
          </button>
        </div>

        {/* Right: Speed selector */}
        <div className="flex items-center gap-1 bg-neutral-950/60 p-0.5 rounded-lg border border-neutral-800 text-xs">
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

      {/* Main Track Workspace */}
      <div className="flex-1 px-4 py-2 flex flex-col gap-1.5 overflow-hidden">
        {/* Time Ruler */}
        <div
          ref={rulerRef}
          onClick={handleRulerClick}
          className="relative h-6 bg-neutral-950/80 rounded-md border border-neutral-800/80 cursor-pointer overflow-hidden"
        >
          {/* Trim Range Overlay */}
          <div
            className="absolute top-0 bottom-0 bg-neutral-800/30 border-x border-rose-500/40 pointer-events-none"
            style={{
              left: `${inPointPercent}%`,
              width: `${Math.max(0, outPointPercent - inPointPercent)}%`,
            }}
          />

          {/* Playhead Marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 shadow-sm z-30 pointer-events-none"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="w-2.5 h-2.5 bg-rose-500 rounded-sm -ml-1 -mt-0.5 shadow-md shadow-rose-500/50" />
          </div>

          {/* Tick markers */}
          <div className="absolute inset-0 flex justify-between px-3 items-center pointer-events-none font-mono text-[9px] text-neutral-500">
            <span>00:00</span>
            <span>{formatTime(duration * 0.25)}</span>
            <span>{formatTime(duration * 0.5)}</span>
            <span>{formatTime(duration * 0.75)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Track 1: Auto-Zoom Keyframe Chips */}
        <div className="relative h-12 bg-neutral-950/60 rounded-md border border-neutral-800/60 px-2 py-1 flex items-center overflow-x-auto">
          <div className="w-20 shrink-0 flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
            <ZoomIn className="w-3.5 h-3.5" />
            <span>ZOOM</span>
          </div>

          <div className="relative flex-1 h-full">
            {zoomKeyframes.map((kf) => {
              const startPct = (kf.startTime / safeDuration) * 100;
              const widthPct = ((kf.endTime - kf.startTime) / safeDuration) * 100;
              const isCurrent = currentTime >= kf.startTime && currentTime <= kf.endTime;

              return (
                <div
                  key={kf.id}
                  className={`absolute top-0.5 bottom-0.5 rounded px-2 flex items-center justify-between text-[10px] font-semibold transition-all border group ${
                    isCurrent
                      ? 'bg-rose-500/30 border-rose-500 text-rose-200 shadow-md shadow-rose-500/20'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                  }`}
                  style={{
                    left: `${startPct}%`,
                    width: `${Math.max(4, widthPct)}%`,
                  }}
                  title={`${kf.label || 'Zoom'} (${kf.scale}x): ${kf.startTime.toFixed(1)}s - ${kf.endTime.toFixed(1)}s`}
                >
                  <span className="truncate">
                    {kf.scale}x {kf.label || ''}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveZoomKeyframe(kf.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-white rounded transition-opacity"
                    title="Delete Keyframe"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Track 2: Cursor Action & Click Telemetry Pips */}
        <div className="relative h-9 bg-neutral-950/60 rounded-md border border-neutral-800/60 px-2 flex items-center">
          <div className="w-20 shrink-0 flex items-center gap-1.5 text-sky-400 font-bold text-[11px]">
            <MousePointer className="w-3.5 h-3.5" />
            <span>ACTIONS</span>
          </div>

          <div className="relative flex-1 h-full flex items-center">
            {clickTimestamps.map((tMs, idx) => {
              const pct = (tMs / 1000 / safeDuration) * 100;
              return (
                <div
                  key={idx}
                  className="absolute w-2 h-2 rounded-full bg-sky-400 hover:bg-sky-300 shadow-sm shadow-sky-400/50 hover:scale-150 transition-transform -ml-1 cursor-pointer"
                  style={{ left: `${pct}%` }}
                  title={`Click Event at ${(tMs / 1000).toFixed(2)}s`}
                  onClick={() => onSeek(tMs / 1000)}
                />
              );
            })}
          </div>
        </div>

        {/* Track 3: Video Waveform / Clip Duration */}
        <div className="relative h-9 bg-neutral-950/60 rounded-md border border-neutral-800/60 px-2 flex items-center">
          <div className="w-20 shrink-0 flex items-center gap-1.5 text-neutral-400 font-bold text-[11px]">
            <Scissors className="w-3.5 h-3.5" />
            <span>VIDEO</span>
          </div>

          <div className="relative flex-1 h-5 bg-neutral-800/70 rounded flex items-center px-2 overflow-hidden border border-neutral-700/50">
            <span className="text-[10px] font-mono text-neutral-400 truncate">
              Screen Recording Clip (60 FPS Native WebCodecs Track)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

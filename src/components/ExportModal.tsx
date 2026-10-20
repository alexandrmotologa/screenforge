import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Download,
  Film,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Cpu,
} from 'lucide-react';
import { isTauri, invoke } from '@tauri-apps/api/core';
import {
  CursorSettings,
  ExportFormat,
  ExportResolution,
  ExportSettings,
  RecordingSession,
  StudioSettings,
} from '../types';
import { ExportEngine, ExportProgress } from '../engine/exportEngine';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: RecordingSession;
  studioSettings: StudioSettings;
  cursorSettings: CursorSettings;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  session,
  studioSettings,
  cursorSettings,
}) => {
  const [format, setFormat] = useState<ExportFormat>('mp4');
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  const [fps, setFps] = useState<30 | 60>(60);
  const [engine, setEngine] = useState<'webcodecs' | 'ffmpeg'>('webcodecs');

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ffmpegInfo, setFfmpegInfo] = useState<{
    available: boolean;
    version: string;
    nvenc_supported: boolean;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isTauri()) {
      invoke<{ available: boolean; version: string; nvenc_supported: boolean }>('check_ffmpeg')
        .then((info) => {
          setFfmpegInfo(info);
          if (info.available) {
            setEngine('ffmpeg');
          }
        })
        .catch(() => {});
    }
  }, []);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setIsExporting(true);
    setProgress(null);
    setExportedBlob(null);
    setErrorMsg(null);

    abortControllerRef.current = new AbortController();

    try {
      // Create a temporary video element for rendering frames
      const tempVideo = document.createElement('video');
      tempVideo.crossOrigin = 'anonymous';
      tempVideo.muted = true;
      tempVideo.playsInline = true;

      if (session.videoUrl) {
        tempVideo.src = session.videoUrl;
        await new Promise((resolve, reject) => {
          tempVideo.onloadedmetadata = () => resolve(true);
          tempVideo.onerror = (e) => reject(e);
        });
      }

      const exportConfig: ExportSettings = {
        format,
        resolution,
        fps,
        quality: 'ultra',
        engine,
      };

      const blob = await ExportEngine.renderClientSide(
        tempVideo,
        {
          duration: session.duration,
          inPoint: session.inPoint,
          outPoint: session.outPoint,
          cursorTelemetry: session.cursorTelemetry,
          zoomKeyframes: session.zoomKeyframes,
          videoNaturalWidth: session.sourceWidth || 1920,
          videoNaturalHeight: session.sourceHeight || 1080,
        },
        studioSettings,
        cursorSettings,
        exportConfig,
        (p) => setProgress(p),
        abortControllerRef.current.signal
      );

      setExportedBlob(blob);
      setIsExporting(false);
    } catch (err: any) {
      console.error('Export failed:', err);
      if (err.message !== 'Export cancelled by user') {
        setErrorMsg(err.message || 'Export encoding encountered an error.');
      }
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (!exportedBlob) return;
    const filename = `screenforge_${Date.now()}.${format}`;
    ExportEngine.triggerDownload(exportedBlob, filename);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsExporting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-purple-600 text-white flex items-center justify-center font-bold">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Export Studio Video</h2>
              <p className="text-xs text-neutral-400">
                Studio canvas, auto-zoom tracks and spring cursor smoothing
              </p>
            </div>
          </div>

          {!isExporting && (
            <button
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* FFmpeg / Engine Status Badge */}
        {ffmpegInfo?.available && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-semibold">Native Desktop Acceleration: </span>
                <span>{ffmpegInfo.version}</span>
              </div>
            </div>
            {ffmpegInfo.nvenc_supported && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                NVENC GPU
              </span>
            )}
          </div>
        )}

        {/* Error Callout */}
        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Export In Progress */}
        {isExporting ? (
          <div className="py-6 space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-neutral-200">
                  {progress?.statusText || 'Encoding 4K Studio Canvas...'}
                </span>
                <span className="font-mono text-rose-400 font-bold">
                  {progress ? Math.round(progress.progress * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-purple-600 transition-all duration-200"
                  style={{ width: `${progress ? progress.progress * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-neutral-950/70 border border-neutral-800/80 rounded-lg flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-400" />
                <div>
                  <div className="text-[10px] text-neutral-500 uppercase font-bold">
                    Time Elapsed
                  </div>
                  <div className="font-mono font-semibold text-neutral-300">
                    {progress ? `${progress.elapsedSeconds}s` : '0s'}
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-neutral-950/70 border border-neutral-800/80 rounded-lg flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-400" />
                <div>
                  <div className="text-[10px] text-neutral-500 uppercase font-bold">
                    Est. Remaining
                  </div>
                  <div className="font-mono font-semibold text-neutral-300">
                    {progress ? `${progress.etaSeconds}s` : 'Calculating...'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Cancel Export
              </button>
            </div>
          </div>
        ) : exportedBlob ? (
          /* Export Complete View */
          <div className="py-6 flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Video Render Complete!</h3>
              <p className="text-xs text-neutral-400">
                {(exportedBlob.size / (1024 * 1024)).toFixed(2)} MB • {resolution.toUpperCase()}{' '}
                {fps}fps • {format.toUpperCase()}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={() => setExportedBlob(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                Export Another Format
              </button>
              <button
                onClick={handleDownload}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 active:scale-95 transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download {format.toUpperCase()}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Export Settings Form */
          <div className="space-y-4">
            {/* Format Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold tracking-wider uppercase text-neutral-400">
                Export Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'mp4', label: 'MP4 Video', desc: 'Universal H.264' },
                  { id: 'webm', label: 'WebM Video', desc: 'High-Efficiency VP9' },
                  { id: 'gif', label: 'Animated GIF', desc: 'GitHub & Social' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id as ExportFormat)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      format === f.id
                        ? 'border-rose-500 bg-rose-500/10 text-white shadow-sm'
                        : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{f.label}</div>
                    <div className="text-[10px] text-neutral-500">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution & FPS */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-bold tracking-wider uppercase text-neutral-400">
                  Resolution
                </label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as ExportResolution)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="4k">4K Ultra HD (3840×2160)</option>
                  <option value="2k">2K Quad HD (2560×1440)</option>
                  <option value="1080p">1080p Full HD (1920×1080)</option>
                  <option value="720p">720p HD (1280×720)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold tracking-wider uppercase text-neutral-400">
                  Framerate
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                  {[60, 30].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setFps(rate as 30 | 60)}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                        fps === rate
                          ? 'bg-neutral-800 text-white shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {rate} FPS
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartExport}
                className="px-5 py-2.5 bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/25 active:scale-95 transition-all flex items-center gap-2"
              >
                <Film className="w-4 h-4" />
                <span>Start Render</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

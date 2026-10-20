import React, { useEffect, useRef, useState } from 'react';
import {
  CursorSettings,
  RecordingSession,
  StudioSettings,
  ZoomKeyframe,
} from '../types';
import { StudioRenderer } from '../engine/studioRenderer';
import { SpringCursorEngine } from '../engine/cursorPhysics';
import { drawSimulatedDesktopUI } from '../data/sampleRecordings';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

interface StudioCanvasProps {
  session: RecordingSession;
  currentTimeSeconds: number;
  studioSettings: StudioSettings;
  cursorSettings: CursorSettings;
  isPlaying: boolean;
  onTimeUpdate?: (time: number) => void;
}

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  session,
  currentTimeSeconds,
  studioSettings,
  cursorSettings,
  isPlaying,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const simulatedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorEngineRef = useRef<SpringCursorEngine>(new SpringCursorEngine(cursorSettings));

  const [activeCameraScale, setActiveCameraScale] = useState<number>(1.0);
  const [stageScale, setStageScale] = useState<'fit' | '100%' | '75%'>('fit');

  // Keep cursor engine settings in sync
  useEffect(() => {
    cursorEngineRef.current.updateSettings(cursorSettings);
  }, [cursorSettings]);

  // Setup offscreen canvas for simulated UI if no real video is attached
  useEffect(() => {
    if (!simulatedCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = session.sourceWidth || 1920;
      c.height = session.sourceHeight || 1080;
      simulatedCanvasRef.current = c;
    }
  }, [session.sourceWidth, session.sourceHeight]);

  // Main rendering loop (60 FPS)
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const { width, height } = StudioRenderer.getDimensionsForAspectRatio(
        studioSettings.aspectRatio,
        1920
      );

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      // Check if real video is available or use simulated desktop UI
      let videoSource: HTMLVideoElement | HTMLCanvasElement;

      if (session.videoUrl && videoElementRef.current) {
        videoSource = videoElementRef.current;
      } else {
        // Draw simulated interactive desktop UI onto buffer
        const simCanvas = simulatedCanvasRef.current;
        if (simCanvas) {
          const simCtx = simCanvas.getContext('2d');
          if (simCtx) {
            drawSimulatedDesktopUI(simCtx, simCanvas.width, simCanvas.height, currentTimeSeconds);
          }
          videoSource = simCanvas;
        } else {
          return;
        }
      }

      // Render the studio composition
      const result = StudioRenderer.renderFrame({
        canvas,
        video: videoSource,
        currentTimeSeconds,
        studioSettings,
        cursorSettings,
        cursorEngine: cursorEngineRef.current,
        cursorEvents: session.cursorTelemetry,
        zoomKeyframes: session.zoomKeyframes,
        videoNaturalWidth: session.sourceWidth || 1920,
        videoNaturalHeight: session.sourceHeight || 1080,
      });

      if (result?.camera) {
        setActiveCameraScale(result.camera.scale);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [session, currentTimeSeconds, studioSettings, cursorSettings]);

  return (
    <div className="relative flex-1 bg-neutral-950 flex flex-col items-center justify-center p-6 overflow-hidden select-none">
      {/* Background Subtle Grid Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      {/* Real Video Element (Hidden in DOM, feeds into canvas) */}
      {session.videoUrl && (
        <video
          ref={videoElementRef}
          src={session.videoUrl}
          className="hidden"
          playsInline
          muted
        />
      )}

      {/* Main Studio Viewport */}
      <div
        className={`relative transition-all duration-300 flex items-center justify-center ${
          stageScale === '100%'
            ? 'w-full h-full max-w-[1920px]'
            : stageScale === '75%'
            ? 'w-[75%] h-[75%]'
            : 'max-w-full max-h-full'
        }`}
      >
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-neutral-800/80 bg-neutral-900/50 flex items-center justify-center max-w-full max-h-[calc(100vh-270px)]">
          <canvas
            ref={canvasRef}
            className="w-auto h-auto max-w-full max-h-[calc(100vh-270px)] object-contain rounded-xl"
            style={{
              aspectRatio:
                studioSettings.aspectRatio === '16:9'
                  ? '16/9'
                  : studioSettings.aspectRatio === '9:16'
                  ? '9/16'
                  : studioSettings.aspectRatio === '1:1'
                  ? '1/1'
                  : studioSettings.aspectRatio === '4:3'
                  ? '4/3'
                  : '4/5',
            }}
          />

          {/* Real-time Status Badges */}
          <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
            {activeCameraScale > 1.05 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/90 text-white shadow-lg backdrop-blur-sm animate-pulse">
                {activeCameraScale.toFixed(1)}x Auto-Zoom
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-neutral-900/80 text-neutral-300 border border-neutral-700/60 backdrop-blur-sm">
              {studioSettings.aspectRatio} • 4K Stage
            </span>
          </div>
        </div>
      </div>

      {/* Stage Scale Floating Controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-neutral-900/90 border border-neutral-800 p-1 rounded-lg backdrop-blur-md shadow-lg z-10 text-xs">
        <button
          onClick={() => setStageScale('fit')}
          className={`px-2 py-1 rounded font-medium transition-all ${
            stageScale === 'fit'
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
          title="Fit to Screen"
        >
          <Maximize2 className="w-3.5 h-3.5 inline mr-1" />
          Fit
        </button>
        <button
          onClick={() => setStageScale('75%')}
          className={`px-2 py-1 rounded font-medium transition-all ${
            stageScale === '75%'
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          75%
        </button>
        <button
          onClick={() => setStageScale('100%')}
          className={`px-2 py-1 rounded font-medium transition-all ${
            stageScale === '100%'
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          100%
        </button>
      </div>
    </div>
  );
};

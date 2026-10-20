import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { StudioCanvas } from './components/StudioCanvas';
import { Timeline } from './components/Timeline';
import { Inspector } from './components/Inspector';
import { RecorderModal } from './components/RecorderModal';
import { ExportModal } from './components/ExportModal';
import {
  CursorSettings,
  RecordingSession,
  StudioSettings,
  ZoomKeyframe,
} from './types';
import { generateSampleSession } from './data/sampleRecordings';
import { AutoZoomEngine } from './engine/autoZoom';

export const App: React.FC = () => {
  // Initialize with sample interactive demo session
  const [session, setSession] = useState<RecordingSession>(() => generateSampleSession());
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Studio canvas settings
  const [studioSettings, setStudioSettings] = useState<StudioSettings>({
    aspectRatio: '16:9',
    padding: 12,
    borderRadius: 18,
    shadowStrength: 80,
    shadowBlur: 38,
    backgroundType: 'mesh',
    backgroundTheme: 'sunset',
    customBgColor: '#0a0a0c',
    windowFrame: 'macOS',
    windowTitle: 'ScreenForge Studio • auto_zoom.rs',
    perspective3D: {
      enabled: false,
      rotateX: 4,
      rotateY: -6,
      rotateZ: 0,
      depth: 1200,
    },
  });

  // Cursor physics & rendering settings
  const [cursorSettings, setCursorSettings] = useState<CursorSettings>({
    visible: true,
    smoothing: 75,
    springStiffness: 160,
    springDamping: 22,
    springMass: 1.0,
    style: 'macos',
    size: 26,
    showRipples: true,
    rippleColor: '#ec4899',
    tactileClickSound: true,
    clickSoundVolume: 0.4,
  });

  // Modals
  const [isRecorderOpen, setIsRecorderOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  const lastFrameTimeRef = useRef<number>(performance.now());

  // Playback timer loop
  useEffect(() => {
    let animId: number;

    const tick = (now: number) => {
      const dt = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      if (isPlaying && session.duration > 0) {
        setCurrentTime((prev) => {
          const nextTime = prev + dt * playbackRate;
          const end = session.outPoint > session.inPoint ? session.outPoint : session.duration;
          if (nextTime >= end) {
            return session.inPoint; // loop back to in-point
          }
          return nextTime;
        });
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, playbackRate, session.duration, session.inPoint, session.outPoint]);

  // Keyboard shortcuts (Space = Play/Pause, Left/Right = Frame step)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime((prev) => Math.max(0, prev - 1 / 30));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime((prev) => Math.min(session.duration, prev + 1 / 30));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session.duration]);

  // Click telemetry timestamps for the timeline track
  const clickTimestamps = session.cursorTelemetry
    .filter((e) => e.type === 'click' || e.type === 'mousedown')
    .map((e) => e.timestamp);

  // Auto-Zoom Regenerator
  const handleRegenerateAutoZoom = () => {
    const keyframes = AutoZoomEngine.generateKeyframes(
      session.cursorTelemetry,
      session.duration,
      {
        defaultScale: 2.1,
        transitionDuration: 0.45,
        holdDuration: 1.4,
      }
    );
    setSession((prev) => ({ ...prev, zoomKeyframes: keyframes }));
  };

  const handleAddZoomKeyframe = (time: number) => {
    // Determine target from cursor at that time
    let targetX = 0.5;
    let targetY = 0.5;
    const closest = session.cursorTelemetry.find(
      (e) => Math.abs(e.timestamp - time * 1000) < 500
    );
    if (closest) {
      targetX = closest.x;
      targetY = closest.y;
    }

    const newKf: ZoomKeyframe = {
      id: `zoom_user_${Date.now()}`,
      startTime: Math.max(0, time - 0.2),
      endTime: Math.min(session.duration, time + 1.8),
      targetX,
      targetY,
      scale: 2.2,
      transitionDuration: 0.4,
      easing: 'easeInOut',
      label: `Manual Zoom #${session.zoomKeyframes.length + 1}`,
      isAutoGenerated: false,
    };

    setSession((prev) => ({
      ...prev,
      zoomKeyframes: [...prev.zoomKeyframes, newKf].sort(
        (a, b) => a.startTime - b.startTime
      ),
    }));
  };

  const handleRemoveZoomKeyframe = (id: string) => {
    setSession((prev) => ({
      ...prev,
      zoomKeyframes: prev.zoomKeyframes.filter((k) => k.id !== id),
    }));
  };

  const handleUpdateKeyframe = (id: string, updates: Partial<ZoomKeyframe>) => {
    setSession((prev) => ({
      ...prev,
      zoomKeyframes: prev.zoomKeyframes.map((k) =>
        k.id === id ? { ...k, ...updates } : k
      ),
    }));
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 font-sans">
      {/* Top Application Header */}
      <Header
        onOpenRecorder={() => setIsRecorderOpen(true)}
        onLoadSample={() => {
          setSession(generateSampleSession());
          setCurrentTime(0);
          setIsPlaying(true);
        }}
        onOpenExport={() => {
          setIsPlaying(false);
          setIsExportOpen(true);
        }}
        studioSettings={studioSettings}
        onUpdateStudioSettings={(s) =>
          setStudioSettings((prev) => ({ ...prev, ...s }))
        }
      />

      {/* Center Studio Area: Canvas + Property Inspector */}
      <div className="flex-1 flex overflow-hidden">
        <StudioCanvas
          session={session}
          currentTimeSeconds={currentTime}
          studioSettings={studioSettings}
          cursorSettings={cursorSettings}
          isPlaying={isPlaying}
        />

        <Inspector
          studioSettings={studioSettings}
          cursorSettings={cursorSettings}
          zoomKeyframes={session.zoomKeyframes}
          onUpdateStudioSettings={(s) =>
            setStudioSettings((prev) => ({ ...prev, ...s }))
          }
          onUpdateCursorSettings={(c) =>
            setCursorSettings((prev) => ({ ...prev, ...c }))
          }
          onRegenerateAutoZoom={handleRegenerateAutoZoom}
          onUpdateKeyframe={handleUpdateKeyframe}
          onRemoveKeyframe={handleRemoveZoomKeyframe}
          onSeek={(t) => setCurrentTime(t)}
        />
      </div>

      {/* Bottom Multi-Track Timeline & Playback Bar */}
      <Timeline
        duration={session.duration}
        currentTime={currentTime}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        zoomKeyframes={session.zoomKeyframes}
        inPoint={session.inPoint}
        outPoint={session.outPoint}
        clickTimestamps={clickTimestamps}
        onSeek={(t) => setCurrentTime(t)}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        onChangePlaybackRate={(r) => setPlaybackRate(r)}
        onAddZoomKeyframe={handleAddZoomKeyframe}
        onRemoveZoomKeyframe={handleRemoveZoomKeyframe}
        onUpdateKeyframe={handleUpdateKeyframe}
        onSetInPoint={(t) =>
          setSession((prev) => ({ ...prev, inPoint: Math.min(t, prev.outPoint - 0.5) }))
        }
        onSetOutPoint={(t) =>
          setSession((prev) => ({ ...prev, outPoint: Math.max(t, prev.inPoint + 0.5) }))
        }
      />

      {/* Screen & Telemetry Recorder Modal */}
      <RecorderModal
        isOpen={isRecorderOpen}
        onClose={() => setIsRecorderOpen(false)}
        onFinishRecording={(newSession) => {
          setSession(newSession);
          setCurrentTime(0);
          setIsPlaying(true);
        }}
      />

      {/* 4K Studio Exporter Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        session={session}
        studioSettings={studioSettings}
        cursorSettings={cursorSettings}
      />
    </div>
  );
};

export default App;

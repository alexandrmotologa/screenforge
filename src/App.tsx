import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { StudioCanvas } from './components/StudioCanvas';
import { Timeline } from './components/Timeline';
import { Inspector } from './components/Inspector';
import { RecorderModal } from './components/RecorderModal';
import { ExportModal } from './components/ExportModal';
import { DropZone } from './components/DropZone';
import {
  ClickAudioStyle,
  CursorSettings,
  IdleRampSettings,
  KeycastSettings,
  RecordingSession,
  SpotlightSettings,
  StudioSettings,
  WebcamSettings,
  ZoomKeyframe,
} from './types';
import { generateSampleSession } from './data/sampleRecordings';
import { AutoZoomEngine } from './engine/autoZoom';
import { ClickAudioSynthesizer } from './engine/audioSynthesizer';
import { IdleSpeedCompressor } from './engine/idleCompressor';

export const App: React.FC = () => {
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

  // Spotlight Focus Dimmer
  const [spotlightSettings, setSpotlightSettings] = useState<SpotlightSettings>({
    enabled: false,
    intensity: 45,
    radius: 180,
  });

  // Webcam Picture-in-Picture Bubble
  const [webcamSettings, setWebcamSettings] = useState<WebcamSettings>({
    enabled: false,
    position: 'bottom-right',
    size: 140,
    shape: 'circle',
    borderWidth: 3,
    borderColor: '#ec4899',
    shadow: true,
  });

  // Keycasting Shortcut HUD
  const [keycastSettings, setKeycastSettings] = useState<KeycastSettings>({
    enabled: true,
    position: 'bottom-center',
    style: 'glass',
    fadeDurationMs: 1400,
  });

  // Smart Idle Speed Ramping
  const [idleRampSettings, setIdleRampSettings] = useState<IdleRampSettings>({
    enabled: true,
    thresholdSeconds: 2.2,
    speedMultiplier: 2.0,
  });

  // Audio click synthesizer
  const [audioClickStyle, setAudioClickStyle] = useState<ClickAudioStyle>('mechanical');
  const audioSynthRef = useRef<ClickAudioSynthesizer>(
    new ClickAudioSynthesizer({
      volume: cursorSettings.clickSoundVolume,
      isMuted: !cursorSettings.tactileClickSound,
      style: audioClickStyle,
    })
  );

  // Modals
  const [isRecorderOpen, setIsRecorderOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);

  const lastFrameTimeRef = useRef<number>(performance.now());
  const lastClickPlayedIndexRef = useRef<number>(-1);

  // Synchronize audio click synth settings
  useEffect(() => {
    audioSynthRef.current.setVolume(cursorSettings.clickSoundVolume);
    audioSynthRef.current.setMuted(!cursorSettings.tactileClickSound);
    audioSynthRef.current.setStyle(audioClickStyle);
  }, [cursorSettings.clickSoundVolume, cursorSettings.tactileClickSound, audioClickStyle]);

  // Detect idle intervals
  const idleIntervals = useMemo(() => {
    return IdleSpeedCompressor.detectIdleSpans(
      session.cursorTelemetry,
      session.duration,
      idleRampSettings
    );
  }, [session.cursorTelemetry, session.duration, idleRampSettings]);

  // Click telemetry timestamps for the timeline track
  const clickTimestamps = useMemo(() => {
    return session.cursorTelemetry
      .filter((e) => e.type === 'click' || e.type === 'mousedown')
      .map((e) => e.timestamp);
  }, [session.cursorTelemetry]);

  // Main playback timer loop
  useEffect(() => {
    let animId: number;

    const tick = (now: number) => {
      const dt = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      if (isPlaying && session.duration > 0) {
        // Evaluate dynamic speed boost if currently in an idle interval
        const dynamicMultiplier = IdleSpeedCompressor.getSpeedMultiplierAt(
          currentTime,
          idleIntervals,
          idleRampSettings
        );

        setCurrentTime((prev) => {
          const nextTime = prev + dt * playbackRate * dynamicMultiplier;
          const end = session.outPoint > session.inPoint ? session.outPoint : session.duration;

          // Check if playhead crossed any click event to trigger audio click sound
          const currentMs = nextTime * 1000;
          for (let i = 0; i < clickTimestamps.length; i++) {
            const clickMs = clickTimestamps[i];
            if (clickMs >= prev * 1000 && clickMs <= currentMs && lastClickPlayedIndexRef.current !== i) {
              lastClickPlayedIndexRef.current = i;
              audioSynthRef.current.playClick();
              break;
            }
          }

          if (nextTime >= end) {
            lastClickPlayedIndexRef.current = -1;
            return session.inPoint; // loop back to in-point
          }
          return nextTime;
        });
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [
    isPlaying,
    playbackRate,
    currentTime,
    session.duration,
    session.inPoint,
    session.outPoint,
    clickTimestamps,
    idleIntervals,
    idleRampSettings,
  ]);

  // Keyboard shortcuts
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
        onVideoImported={(newSession) => {
          setSession(newSession);
          setCurrentTime(0);
          setIsPlaying(true);
        }}
        studioSettings={studioSettings}
        onUpdateStudioSettings={(s) =>
          setStudioSettings((prev) => ({ ...prev, ...s }))
        }
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
      />

      <DropZone
        onVideoLoaded={(newSession) => {
          setSession(newSession);
          setCurrentTime(0);
          setIsPlaying(true);
        }}
      >
        <div className="flex-1 flex overflow-hidden relative">
          <StudioCanvas
            session={session}
            currentTimeSeconds={currentTime}
            studioSettings={studioSettings}
            cursorSettings={cursorSettings}
            spotlightSettings={spotlightSettings}
            webcamSettings={webcamSettings}
            keycastSettings={keycastSettings}
            isPlaying={isPlaying}
          />

          {/* Desktop Inspector Sidebar (Always visible on lg+) */}
          <div className="hidden lg:flex">
            <Inspector
              studioSettings={studioSettings}
              cursorSettings={cursorSettings}
              spotlightSettings={spotlightSettings}
              webcamSettings={webcamSettings}
              keycastSettings={keycastSettings}
              idleRampSettings={idleRampSettings}
              audioClickStyle={audioClickStyle}
              zoomKeyframes={session.zoomKeyframes}
              onUpdateStudioSettings={(s) =>
                setStudioSettings((prev) => ({ ...prev, ...s }))
              }
              onUpdateCursorSettings={(c) =>
                setCursorSettings((prev) => ({ ...prev, ...c }))
              }
              onUpdateSpotlightSettings={(sp) =>
                setSpotlightSettings((prev) => ({ ...prev, ...sp }))
              }
              onUpdateWebcamSettings={(w) =>
                setWebcamSettings((prev) => ({ ...prev, ...w }))
              }
              onUpdateKeycastSettings={(k) =>
                setKeycastSettings((prev) => ({ ...prev, ...k }))
              }
              onUpdateIdleRampSettings={(ir) =>
                setIdleRampSettings((prev) => ({ ...prev, ...ir }))
              }
              onUpdateAudioClickStyle={(st) => setAudioClickStyle(st)}
              onRegenerateAutoZoom={handleRegenerateAutoZoom}
              onUpdateKeyframe={handleUpdateKeyframe}
              onRemoveKeyframe={handleRemoveZoomKeyframe}
              onSeek={(t) => setCurrentTime(t)}
            />
          </div>

          {/* Mobile/Tablet Inspector Drawer Overlay */}
          {isInspectorOpen && (
            <div className="lg:hidden absolute inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
              <div className="h-full w-80 max-w-[85vw] shadow-2xl flex flex-col bg-neutral-900 border-l border-neutral-800 animate-in slide-in-from-right duration-200">
                <Inspector
                  studioSettings={studioSettings}
                  cursorSettings={cursorSettings}
                  spotlightSettings={spotlightSettings}
                  webcamSettings={webcamSettings}
                  keycastSettings={keycastSettings}
                  idleRampSettings={idleRampSettings}
                  audioClickStyle={audioClickStyle}
                  zoomKeyframes={session.zoomKeyframes}
                  onUpdateStudioSettings={(s) =>
                    setStudioSettings((prev) => ({ ...prev, ...s }))
                  }
                  onUpdateCursorSettings={(c) =>
                    setCursorSettings((prev) => ({ ...prev, ...c }))
                  }
                  onUpdateSpotlightSettings={(sp) =>
                    setSpotlightSettings((prev) => ({ ...prev, ...sp }))
                  }
                  onUpdateWebcamSettings={(w) =>
                    setWebcamSettings((prev) => ({ ...prev, ...w }))
                  }
                  onUpdateKeycastSettings={(k) =>
                    setKeycastSettings((prev) => ({ ...prev, ...k }))
                  }
                  onUpdateIdleRampSettings={(ir) =>
                    setIdleRampSettings((prev) => ({ ...prev, ...ir }))
                  }
                  onUpdateAudioClickStyle={(st) => setAudioClickStyle(st)}
                  onRegenerateAutoZoom={handleRegenerateAutoZoom}
                  onUpdateKeyframe={handleUpdateKeyframe}
                  onRemoveKeyframe={handleRemoveZoomKeyframe}
                  onSeek={(t) => setCurrentTime(t)}
                  onClose={() => setIsInspectorOpen(false)}
                />
              </div>
            </div>
          )}
        </div>
      </DropZone>

      <Timeline
        duration={session.duration}
        currentTime={currentTime}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        zoomKeyframes={session.zoomKeyframes}
        inPoint={session.inPoint}
        outPoint={session.outPoint}
        clickTimestamps={clickTimestamps}
        keystrokes={session.keystrokes}
        idleIntervals={idleIntervals}
        audioClickEnabled={cursorSettings.tactileClickSound}
        onToggleAudioClick={() =>
          setCursorSettings((prev) => ({
            ...prev,
            tactileClickSound: !prev.tactileClickSound,
          }))
        }
        onSeek={(t) => setCurrentTime(t)}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        onChangePlaybackRate={(r) => setPlaybackRate(r)}
        onAddZoomKeyframe={handleAddZoomKeyframe}
        onRemoveZoomKeyframe={handleRemoveZoomKeyframe}
        onUpdateKeyframe={handleUpdateKeyframe}
        onSetInPoint={(t) =>
          setSession((prev) => ({
            ...prev,
            inPoint: Math.min(t, prev.outPoint - 0.5),
          }))
        }
        onSetOutPoint={(t) =>
          setSession((prev) => ({
            ...prev,
            outPoint: Math.max(t, prev.inPoint + 0.5),
          }))
        }
      />

      <RecorderModal
        isOpen={isRecorderOpen}
        onClose={() => setIsRecorderOpen(false)}
        onFinishRecording={(newSession) => {
          setSession(newSession);
          setCurrentTime(0);
          setIsPlaying(true);
        }}
      />

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

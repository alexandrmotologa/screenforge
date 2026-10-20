import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Monitor,
  Mic,
  MicOff,
  Video,
  Square,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { CursorEvent, KeystrokeItem, RecordingSession } from '../types';
import { AutoZoomEngine } from '../engine/autoZoom';

interface RecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinishRecording: (session: RecordingSession) => void;
}

export const RecorderModal: React.FC<RecorderModalProps> = ({
  isOpen,
  onClose,
  onFinishRecording,
}) => {
  const [includeMic, setIncludeMic] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const telemetryRef = useRef<CursorEvent[]>([]);
  const keystrokesRef = useRef<KeystrokeItem[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<number | null>(null);

  const listenersRef = useRef<{
    mouseMove?: (e: MouseEvent) => void;
    mouseDown?: (e: MouseEvent) => void;
    keyDown?: (e: KeyboardEvent) => void;
  }>({});

  const removeWindowListeners = () => {
    if (listenersRef.current.mouseMove) {
      window.removeEventListener('mousemove', listenersRef.current.mouseMove);
    }
    if (listenersRef.current.mouseDown) {
      window.removeEventListener('mousedown', listenersRef.current.mouseDown);
    }
    if (listenersRef.current.keyDown) {
      window.removeEventListener('keydown', listenersRef.current.keyDown);
    }
    listenersRef.current = {};
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      removeWindowListeners();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleStartCapture = async () => {
    setErrorMsg(null);
    try {
      // 1. Request Display Media (Screen / Window)
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 60, max: 60 },
          displaySurface: 'monitor',
        },
        audio: true,
      });

      // 2. Optionally combine with microphone audio
      let combinedStream = displayStream;
      if (includeMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioContext = new AudioContext();
          const dest = audioContext.createMediaStreamDestination();

          if (displayStream.getAudioTracks().length > 0) {
            const sysAudio = audioContext.createMediaStreamSource(displayStream);
            sysAudio.connect(dest);
          }
          const micAudio = audioContext.createMediaStreamSource(micStream);
          micAudio.connect(dest);

          combinedStream = new MediaStream([
            ...displayStream.getVideoTracks(),
            ...dest.stream.getAudioTracks(),
          ]);
        } catch (err) {
          console.warn('Microphone permission denied, proceeding with system audio only');
        }
      }

      streamRef.current = combinedStream;

      // Handle user clicking native browser "Stop Sharing" floating bar
      displayStream.getVideoTracks()[0].onended = () => {
        handleStopRecording();
      };

      // 3. Countdown 3.. 2.. 1..
      setCountdown(3);
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            startActualRecording(combinedStream);
            return null;
          }
          return prev - 1;
        });
      }, 900);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Screen capture permission was cancelled.');
    }
  };

  const startActualRecording = (stream: MediaStream) => {
    chunksRef.current = [];
    telemetryRef.current = [];
    keystrokesRef.current = [];
    recordingStartTimeRef.current = performance.now();

    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 25_000_000, // 25 Mbps high fidelity
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      finalizeRecording(stream);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(200);

    // If running in Tauri desktop environment, trigger native OS 60Hz telemetry capture
    if (isTauri()) {
      invoke('start_global_telemetry').catch((err) => {
        console.warn('Native global telemetry start failed:', err);
      });
    }

    // Window telemetry listener during recording
    const onMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      telemetryRef.current.push({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
        timestamp: Math.round(now - recordingStartTimeRef.current),
        type: 'move',
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      const now = performance.now();
      telemetryRef.current.push({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
        timestamp: Math.round(now - recordingStartTimeRef.current),
        type: 'click',
        button: e.button,
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const now = performance.now();
      const modifiers: string[] = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');
      if (e.metaKey) modifiers.push('Cmd');

      keystrokesRef.current.push({
        id: `k_${now}`,
        key: e.key,
        modifiers,
        timestamp: Math.round(now - recordingStartTimeRef.current),
        duration: 1400,
      });
    };

    listenersRef.current = { mouseMove: onMouseMove, mouseDown: onMouseDown, keyDown: onKeyDown };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);

    setIsRecording(true);
    setElapsedSeconds(0);
    timerIntervalRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  const handleStopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const finalizeRecording = async (stream: MediaStream) => {
    stream.getTracks().forEach((track) => track.stop());
    removeWindowListeners();

    // If running in Tauri desktop environment, collect native OS desktop-wide telemetry
    if (isTauri()) {
      try {
        const nativeTelemetry = await invoke<
          Array<{
            x: number;
            y: number;
            timestamp: number;
            event_type: string;
            button: number;
          }>
        >('stop_global_telemetry');

        if (nativeTelemetry && nativeTelemetry.length > 0) {
          telemetryRef.current = nativeTelemetry.map((p) => ({
            x: p.x,
            y: p.y,
            timestamp: p.timestamp,
            type: p.event_type as 'move' | 'click',
            button: p.button >= 0 ? p.button : undefined,
          }));
        }
      } catch (err) {
        console.warn('Native telemetry collection error:', err);
      }
    }

    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    const videoUrl = URL.createObjectURL(blob);
    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack ? videoTrack.getSettings() : { width: 1920, height: 1080 };
    const width = settings.width || 1920;
    const height = settings.height || 1080;
    const duration = Math.max(1, elapsedSeconds);

    // Synthesize fallback telemetry points if mouse stayed outside window
    if (telemetryRef.current.length < 5) {
      telemetryRef.current = [
        { x: 0.5, y: 0.5, timestamp: 0, type: 'move' },
        { x: 0.45, y: 0.45, timestamp: Math.round(duration * 400), type: 'click' },
        { x: 0.55, y: 0.55, timestamp: Math.round(duration * 800), type: 'move' },
      ];
    }

    // Generate smart auto-zoom keyframes
    const zoomKeyframes = AutoZoomEngine.generateKeyframes(telemetryRef.current, duration, {
      defaultScale: 2.1,
      transitionDuration: 0.45,
      holdDuration: 1.4,
    });

    const newSession: RecordingSession = {
      id: `session_${Date.now()}`,
      title: `Screen Recording ${new Date().toLocaleTimeString()}`,
      sourceWidth: width,
      sourceHeight: height,
      duration,
      videoUrl,
      videoBlob: blob,
      cursorTelemetry: telemetryRef.current,
      keystrokes: keystrokesRef.current,
      zoomKeyframes,
      inPoint: 0,
      outPoint: duration,
    };

    setIsRecording(false);
    onFinishRecording(newSession);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-purple-600 text-white flex items-center justify-center font-bold">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Record Screen</h2>
              <p className="text-xs text-neutral-400">Capture 4K Display with Cursor Telemetry</p>
            </div>
          </div>

          {!isRecording && (
            <button
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Error Callout */}
        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Active Countdown */}
        {countdown !== null && (
          <div className="py-8 flex flex-col items-center justify-center space-y-2">
            <div className="text-6xl font-black text-rose-500 animate-ping font-mono">
              {countdown}
            </div>
            <div className="text-xs text-neutral-400 font-medium">Recording starts shortly...</div>
          </div>
        )}

        {/* Active Recording View */}
        {isRecording && countdown === null && (
          <div className="py-6 flex flex-col items-center justify-center space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 animate-pulse flex items-center justify-center">
                <div className="w-6 h-6 rounded-sm bg-rose-500" />
              </div>
            </div>

            <div className="text-center space-y-1">
              <div className="text-2xl font-mono font-bold text-white">
                {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:
                {String(elapsedSeconds % 60).padStart(2, '0')}
              </div>
              <div className="text-xs text-neutral-400 flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>Recording active screen & telemetry...</span>
              </div>
            </div>

            <button
              onClick={handleStopRecording}
              className="mt-4 px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-600/30 active:scale-95 transition-all flex items-center gap-2"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Stop & Open Studio</span>
            </button>
          </div>
        )}

        {/* Configuration Setup */}
        {!isRecording && countdown === null && (
          <div className="space-y-4">
            <div className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200">
                  <Monitor className="w-4 h-4 text-rose-400" />
                  <span>Display Capture Mode</span>
                </div>
                <span className="text-[11px] font-mono text-neutral-400">60 FPS Native</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Choose any screen, window, or Chrome tab. Full mouse cursor movement, velocity, and
                click coordinates will be tracked automatically.
              </p>
            </div>

            {/* Mic Toggle */}
            <div className="flex items-center justify-between p-3 bg-neutral-950/40 border border-neutral-800 rounded-xl">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    includeMic ? 'bg-rose-500/20 text-rose-400' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {includeMic ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-200">Microphone Narration</div>
                  <div className="text-[10px] text-neutral-500">Record voiceover alongside system audio</div>
                </div>
              </div>

              <button
                onClick={() => setIncludeMic(!includeMic)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  includeMic ? 'bg-rose-600' : 'bg-neutral-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    includeMic ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartCapture}
              className="w-full py-3 bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Select Screen & Record</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

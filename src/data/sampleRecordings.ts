import { CursorEvent, KeystrokeItem, RecordingSession, ZoomKeyframe } from '../types';
import { AutoZoomEngine } from '../engine/autoZoom';

/**
 * Generates an authentic interactive demonstration session with simulated screen interactions,
 * real cursor movement sweeps, click telemetry, keystroke HUD items, and pre-computed auto-zoom keyframes.
 */
export function generateSampleSession(): RecordingSession {
  const duration = 12.0; // 12 seconds
  const width = 1920;
  const height = 1080;

  // Synthesize realistic cursor telemetry points
  const events: CursorEvent[] = [];
  const fps = 60;
  const totalFrames = duration * fps;

  // Waypoints for mouse movement (normalized 0..1)
  const waypoints = [
    { t: 0.0, x: 0.2, y: 0.3, action: null },
    { t: 1.2, x: 0.28, y: 0.18, action: 'click', label: 'Click File Tab' },
    { t: 2.4, x: 0.45, y: 0.42, action: 'click', label: 'Select Code Line' },
    { t: 3.8, x: 0.72, y: 0.25, action: 'click', label: 'Trigger Build' },
    { t: 5.2, x: 0.82, y: 0.85, action: 'click', label: 'Terminal Logs' },
    { t: 6.8, x: 0.52, y: 0.62, action: 'click', label: 'Inspect Metric' },
    { t: 8.5, x: 0.32, y: 0.78, action: 'click', label: 'Expand Tree' },
    { t: 10.0, x: 0.88, y: 0.15, action: 'click', label: 'Deploy Production' },
    { t: 12.0, x: 0.5, y: 0.5, action: null },
  ];

  for (let frame = 0; frame <= totalFrames; frame++) {
    const tSec = frame / fps;
    const tMs = Math.round(tSec * 1000);

    let p0 = waypoints[0];
    let p1 = waypoints[waypoints.length - 1];

    for (let i = 0; i < waypoints.length - 1; i++) {
      if (tSec >= waypoints[i].t && tSec <= waypoints[i + 1].t) {
        p0 = waypoints[i];
        p1 = waypoints[i + 1];
        break;
      }
    }

    const segDuration = p1.t - p0.t || 1;
    const progress = Math.max(0, Math.min(1, (tSec - p0.t) / segDuration));

    const smoothProgress = progress * progress * (3 - 2 * progress);
    const jitterX = Math.sin(frame * 0.7) * 0.0015 + Math.cos(frame * 1.3) * 0.001;
    const jitterY = Math.cos(frame * 0.9) * 0.0015 + Math.sin(frame * 1.1) * 0.001;

    const x = p0.x + (p1.x - p0.x) * smoothProgress + jitterX;
    const y = p0.y + (p1.y - p0.y) * smoothProgress + jitterY;

    const isAtActionWaypoint = Math.abs(tSec - p1.t) < 0.02 && p1.action === 'click';

    if (isAtActionWaypoint) {
      events.push({
        x,
        y,
        timestamp: tMs,
        type: 'click',
        button: 0,
      });
    } else {
      events.push({
        x,
        y,
        timestamp: tMs,
        type: 'move',
      });
    }
  }

  // Pre-configured realistic keystrokes synchronized with actions
  const keystrokes: KeystrokeItem[] = [
    {
      id: 'k_1',
      key: 'P',
      modifiers: ['Ctrl', 'Shift'],
      timestamp: 1800,
      duration: 1400,
    },
    {
      id: 'k_2',
      key: 'Enter',
      modifiers: [],
      timestamp: 4200,
      duration: 1200,
    },
    {
      id: 'k_3',
      key: 'K',
      modifiers: ['Ctrl'],
      timestamp: 7200,
      duration: 1400,
    },
    {
      id: 'k_4',
      key: 'S',
      modifiers: ['Ctrl'],
      timestamp: 9800,
      duration: 1200,
    },
  ];

  // Generate intelligent auto-zoom keyframes from the synthesized telemetry
  const zoomKeyframes: ZoomKeyframe[] = AutoZoomEngine.generateKeyframes(events, duration, {
    defaultScale: 2.1,
    transitionDuration: 0.45,
    holdDuration: 1.4,
    clusterTimeThreshold: 2.4,
    clusterDistThreshold: 0.35,
  });

  return {
    id: 'sample_session_studio',
    title: 'ScreenForge Interactive Demo Studio',
    sourceWidth: width,
    sourceHeight: height,
    duration,
    videoUrl: '', // Will be rendered into canvas dynamically
    cursorTelemetry: events,
    keystrokes,
    zoomKeyframes,
    inPoint: 0,
    outPoint: duration,
  };
}

/**
 * Creates an authentic high-resolution simulated UI canvas representing a modern software studio.
 */
export function drawSimulatedDesktopUI(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSeconds: number
) {
  // 1. Editor Window Background
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, width, height);

  // 2. Sidebar Navigation
  const sidebarW = 260;
  ctx.fillStyle = '#090a0f';
  ctx.fillRect(0, 0, sidebarW, height);

  // Sidebar Header
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('SCREENFORGE CORE', 24, 38);

  // Sidebar File Tree
  const files = [
    { name: 'src/engine/spring.rs', active: timeSeconds < 3 },
    { name: 'src/engine/auto_zoom.rs', active: timeSeconds >= 3 && timeSeconds < 6 },
    { name: 'src/render/studio_canvas.rs', active: timeSeconds >= 6 && timeSeconds < 9 },
    { name: 'src/export/ffmpeg_nvenc.rs', active: timeSeconds >= 9 },
    { name: 'Cargo.toml', active: false },
    { name: 'README.md', active: false },
  ];

  let fileY = 80;
  ctx.font = '500 13px "JetBrains Mono", monospace';
  files.forEach((file) => {
    if (file.active) {
      ctx.fillStyle = 'rgba(236, 72, 153, 0.15)';
      ctx.fillRect(12, fileY - 16, sidebarW - 24, 28);
      ctx.fillStyle = '#ec4899';
    } else {
      ctx.fillStyle = '#94a3b8';
    }
    ctx.fillText(file.name, 32, fileY);
    fileY += 36;
  });

  // 3. Top Editor Tabs
  const tabH = 44;
  ctx.fillStyle = '#14161f';
  ctx.fillRect(sidebarW, 0, width - sidebarW, tabH);

  // Active Tab
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(sidebarW, 0, 240, tabH);
  ctx.fillStyle = '#ec4899';
  ctx.fillRect(sidebarW, 0, 240, 2);

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillText('auto_zoom.rs • Screen Studio Engine', sidebarW + 20, 26);

  // 4. Code Area
  const codeLines = [
    '// ScreenForge Smart Auto-Zoom Engine & Spring Cursor Physics',
    'pub struct AutoZoomEngine {',
    '    stiffness: f32,',
    '    damping: f32,',
    '    telemetry_buffer: Vec<CursorTelemetryPoint>,',
    '}',
    '',
    'impl AutoZoomEngine {',
    '    pub fn compute_camera_glide(&self, t_ms: u64) -> CameraTransform {',
    '        let target = self.detect_action_cluster(t_ms);',
    '        let smooth_scale = spring_interpolate(1.0, 2.2, self.stiffness);',
    '        CameraTransform { scale: smooth_scale, center: target }',
    '    }',
    '}',
  ];

  let codeY = tabH + 40;
  ctx.font = '500 15px "JetBrains Mono", monospace';
  codeLines.forEach((line, idx) => {
    ctx.fillStyle = '#475569';
    ctx.fillText(`${(idx + 1).toString().padStart(2, ' ')}`, sidebarW + 24, codeY);

    if (line.startsWith('//')) {
      ctx.fillStyle = '#64748b';
    } else if (line.includes('pub struct') || line.includes('impl') || line.includes('pub fn')) {
      ctx.fillStyle = '#f43f5e';
    } else if (line.includes('CameraTransform') || line.includes('AutoZoomEngine')) {
      ctx.fillStyle = '#38bdf8';
    } else if (line.includes('spring_interpolate')) {
      ctx.fillStyle = '#fbbf24';
    } else {
      ctx.fillStyle = '#e2e8f0';
    }

    ctx.fillText(line, sidebarW + 70, codeY);
    codeY += 28;
  });

  // 5. Bottom Live Telemetry / Terminal Inspector
  const termH = 260;
  const termY = height - termH;
  ctx.fillStyle = '#0a0b10';
  ctx.fillRect(sidebarW, termY, width - sidebarW, termH);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sidebarW, termY);
  ctx.lineTo(width, termY);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('TERMINAL & TELEMETRY STREAM', sidebarW + 24, termY + 28);

  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(sidebarW + 230, termY + 24, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillText('60 FPS SYNCED', sidebarW + 242, termY + 28);

  const logs = [
    `[${timeSeconds.toFixed(2)}s] TELEMETRY_INGEST: 60Hz high-precision cursor sampling active`,
    `[${timeSeconds.toFixed(2)}s] SPRING_DYNAMICS: mass=1.00 stiffness=180.0 damping=24.0 (critically damped)`,
    `[${timeSeconds.toFixed(2)}s] CAMERA_AUTOZOOM: cluster threshold=2.4s safe_clamping=true`,
    `[${timeSeconds.toFixed(2)}s] STUDIO_CANVAS: 4K rendering pipeline ready (NVENC hardware acceleration enabled)`,
  ];

  let logY = termY + 68;
  logs.forEach((log) => {
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('➜', sidebarW + 24, logY);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(log, sidebarW + 44, logY);
    logY += 26;
  });
}

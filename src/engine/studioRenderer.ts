import {
  AspectRatio,
  BackgroundTheme,
  CursorEvent,
  CursorSettings,
  IdleRampSettings,
  KeycastSettings,
  KeystrokeItem,
  SpotlightSettings,
  StudioSettings,
  WebcamSettings,
  ZoomKeyframe,
} from '../types';
import { AutoZoomEngine, CameraState } from './autoZoom';
import { Point2D, SmoothedCursorState, SpringCursorEngine } from './cursorPhysics';

export interface RenderContextOptions {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement | ImageBitmap | HTMLCanvasElement;
  currentTimeSeconds: number;
  studioSettings: StudioSettings;
  cursorSettings: CursorSettings;
  spotlightSettings?: SpotlightSettings;
  webcamSettings?: WebcamSettings;
  webcamSource?: HTMLVideoElement | HTMLCanvasElement | null;
  keycastSettings?: KeycastSettings;
  keystrokes?: KeystrokeItem[];
  cursorEngine: SpringCursorEngine;
  cursorEvents: CursorEvent[];
  zoomKeyframes: ZoomKeyframe[];
  videoNaturalWidth: number;
  videoNaturalHeight: number;
}

export class StudioRenderer {
  public static getDimensionsForAspectRatio(
    aspectRatio: AspectRatio,
    baseWidth = 1920
  ): { width: number; height: number } {
    switch (aspectRatio) {
      case '16:9':
        return { width: baseWidth, height: Math.round((baseWidth * 9) / 16) };
      case '9:16':
        return { width: Math.round((baseWidth * 9) / 16), height: baseWidth };
      case '1:1':
        return { width: baseWidth, height: baseWidth };
      case '4:3':
        return { width: baseWidth, height: Math.round((baseWidth * 3) / 4) };
      case '4:5':
        return { width: Math.round((baseWidth * 4) / 5), height: baseWidth };
      default:
        return { width: baseWidth, height: Math.round((baseWidth * 9) / 16) };
    }
  }

  public static renderFrame(options: RenderContextOptions): {
    camera: CameraState;
    cursor: SmoothedCursorState;
  } {
    const {
      canvas,
      video,
      currentTimeSeconds,
      studioSettings,
      cursorEngine,
      cursorEvents,
      zoomKeyframes,
      videoNaturalWidth,
      videoNaturalHeight,
      spotlightSettings,
      webcamSettings,
      webcamSource,
      keycastSettings,
      keystrokes,
    } = options;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not obtain 2D canvas context');

    const canvasW = canvas.width;
    const canvasH = canvas.height;

    // 1. Draw Studio Background
    StudioRenderer.drawBackground(ctx, canvasW, canvasH, studioSettings);

    // 2. Compute Camera Viewport State
    const camera = AutoZoomEngine.evaluateCamera(zoomKeyframes, currentTimeSeconds);

    // 3. Compute Window Geometry inside Canvas
    const paddingPercent = studioSettings.padding / 100;
    const maxWindowW = canvasW * (1 - paddingPercent * 2);
    const maxWindowH = canvasH * (1 - paddingPercent * 2);

    const videoAspect = videoNaturalWidth / (videoNaturalHeight || 1);
    let windowW = maxWindowW;
    let windowH = windowW / videoAspect;

    if (windowH > maxWindowH) {
      windowH = maxWindowH;
      windowW = windowH * videoAspect;
    }

    const windowX = (canvasW - windowW) / 2;
    const windowY = (canvasH - windowH) / 2;

    const headerHeight =
      studioSettings.windowFrame === 'macOS'
        ? 36
        : studioSettings.windowFrame === 'sleek'
        ? 24
        : 0;
    const totalH = windowH + headerHeight;
    const adjustedY = windowY - headerHeight / 2;

    // 4. Apply 2.5D Perspective Tilt
    ctx.save();
    if (studioSettings.perspective3D.enabled) {
      const p = studioSettings.perspective3D;
      ctx.translate(canvasW / 2, canvasH / 2);
      const radX = (p.rotateX * Math.PI) / 180;
      const radY = (p.rotateY * Math.PI) / 180;
      const radZ = (p.rotateZ * Math.PI) / 180;

      ctx.transform(
        Math.cos(radZ) * Math.cos(radY),
        Math.sin(radZ),
        -Math.sin(radZ) + Math.sin(radX) * 0.25,
        Math.cos(radZ) * Math.cos(radX),
        0,
        0
      );
      ctx.translate(-canvasW / 2, -canvasH / 2);
    }

    // 5. Draw Dual-Layer Realistic Drop Shadows
    if (studioSettings.shadowStrength > 0) {
      const alpha = (studioSettings.shadowStrength / 100) * 0.65;
      const blur = studioSettings.shadowBlur;

      // Soft ambient diffuse shadow
      ctx.save();
      ctx.shadowColor = `rgba(0, 0, 0, ${alpha * 0.4})`;
      ctx.shadowBlur = blur * 1.5;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = blur * 0.3;
      StudioRenderer.fillRoundedRect(
        ctx,
        windowX,
        adjustedY,
        windowW,
        totalH,
        studioSettings.borderRadius
      );
      ctx.restore();

      // Deep directional elevation shadow
      ctx.save();
      ctx.shadowColor = `rgba(0, 0, 0, ${alpha * 0.8})`;
      ctx.shadowBlur = blur * 0.8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = blur * 0.65;
      StudioRenderer.fillRoundedRect(
        ctx,
        windowX,
        adjustedY,
        windowW,
        totalH,
        studioSettings.borderRadius
      );
      ctx.restore();
    }

    // 6. Draw Window Shell & Header Frame
    ctx.save();
    StudioRenderer.clipRoundedRect(
      ctx,
      windowX,
      adjustedY,
      windowW,
      totalH,
      studioSettings.borderRadius
    );

    // Header bar
    if (headerHeight > 0) {
      const headerGrad = ctx.createLinearGradient(
        windowX,
        adjustedY,
        windowX,
        adjustedY + headerHeight
      );
      headerGrad.addColorStop(0, '#262629');
      headerGrad.addColorStop(1, '#1a1a1c');
      ctx.fillStyle = headerGrad;
      ctx.fillRect(windowX, adjustedY, windowW, headerHeight);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(windowX, adjustedY + headerHeight - 1, windowW, 1);

      // Traffic Lights for macOS style
      if (studioSettings.windowFrame === 'macOS') {
        const dotRadius = 5.5;
        const startDotX = windowX + 18;
        const dotY = adjustedY + headerHeight / 2;
        const spacing = 16;

        ctx.beginPath();
        ctx.arc(startDotX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ff5f56';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(startDotX + spacing, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffbd2e';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(startDotX + spacing * 2, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#27c93f';
        ctx.fill();
      }

      if (studioSettings.windowTitle) {
        ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          studioSettings.windowTitle,
          windowX + windowW / 2,
          adjustedY + headerHeight / 2
        );
      }
    }

    // 7. Render Video Frame with Camera Zoom
    const videoY = adjustedY + headerHeight;

    const scale = camera.scale;
    const srcW = videoNaturalWidth / scale;
    const srcH = videoNaturalHeight / scale;

    const rawSrcX = camera.centerX * videoNaturalWidth - srcW / 2;
    const rawSrcY = camera.centerY * videoNaturalHeight - srcH / 2;

    const srcX = Math.max(0, Math.min(videoNaturalWidth - srcW, rawSrcX));
    const srcY = Math.max(0, Math.min(videoNaturalHeight - srcH, rawSrcY));

    ctx.save();
    ctx.beginPath();
    ctx.rect(windowX, videoY, windowW, windowH);
    ctx.clip();

    try {
      ctx.drawImage(
        video as CanvasImageSource,
        srcX,
        srcY,
        srcW,
        srcH,
        windowX,
        videoY,
        windowW,
        windowH
      );
    } catch {
      ctx.fillStyle = '#121214';
      ctx.fillRect(windowX, videoY, windowW, windowH);
    }

    // 8. Evaluate Smoothed Cursor Coordinates
    const cursor = cursorEngine.evaluate(cursorEvents, currentTimeSeconds * 1000);

    const toScreenCoord = (normX: number, normY: number): Point2D => {
      const relX = (normX * videoNaturalWidth - srcX) / srcW;
      const relY = (normY * videoNaturalHeight - srcY) / srcH;
      return {
        x: windowX + relX * windowW,
        y: videoY + relY * windowH,
      };
    };

    const cursorScreen = toScreenCoord(cursor.x, cursor.y);

    // 9. Spotlight Focus Dimmer Layer
    if (spotlightSettings && spotlightSettings.enabled && spotlightSettings.intensity > 0) {
      StudioRenderer.drawSpotlightFocus(
        ctx,
        windowX,
        videoY,
        windowW,
        windowH,
        cursorScreen.x,
        cursorScreen.y,
        spotlightSettings.radius,
        spotlightSettings.intensity
      );
    }

    // 10. Click Ripples & Vector Pointer
    cursorEngine.drawRipples(ctx, toScreenCoord, cursor.recentClicks);
    cursorEngine.draw(ctx, cursorScreen.x, cursorScreen.y, cursor);

    // 11. Keycasting Shortcut HUD
    if (keycastSettings && keycastSettings.enabled && keystrokes && keystrokes.length > 0) {
      StudioRenderer.drawKeycastingHUD(
        ctx,
        windowX,
        videoY,
        windowW,
        windowH,
        currentTimeSeconds,
        keystrokes,
        keycastSettings
      );
    }

    ctx.restore(); // end video area clip
    ctx.restore(); // end window shell clip

    // Window border outline
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    StudioRenderer.strokeRoundedRect(
      ctx,
      windowX,
      adjustedY,
      windowW,
      totalH,
      studioSettings.borderRadius
    );
    ctx.restore();

    // 12. Webcam Picture-in-Picture Bubble
    if (webcamSettings && webcamSettings.enabled) {
      StudioRenderer.drawWebcamBubble(
        ctx,
        canvasW,
        canvasH,
        webcamSettings,
        webcamSource
      );
    }

    ctx.restore(); // end perspective 3D

    return { camera, cursor };
  }

  /**
   * Draws Spotlight Focus Dimmer mask around mouse focal target.
   */
  private static drawSpotlightFocus(
    ctx: CanvasRenderingContext2D,
    wx: number,
    wy: number,
    ww: number,
    wh: number,
    cx: number,
    cy: number,
    radius: number,
    intensity: number
  ) {
    ctx.save();
    const maxAlpha = (intensity / 100) * 0.75;

    const grad = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius * 1.6);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.6, `rgba(0, 0, 0, ${maxAlpha * 0.5})`);
    grad.addColorStop(1, `rgba(0, 0, 0, ${maxAlpha})`);

    ctx.fillStyle = grad;
    ctx.fillRect(wx, wy, ww, wh);
    ctx.restore();
  }

  /**
   * Draws Keycasting HUD showing pressed keys and shortcuts.
   */
  private static drawKeycastingHUD(
    ctx: CanvasRenderingContext2D,
    wx: number,
    wy: number,
    ww: number,
    wh: number,
    timeSec: number,
    keystrokes: KeystrokeItem[],
    settings: KeycastSettings
  ) {
    const timeMs = timeSec * 1000;
    // Find active keystrokes within fade duration
    const active = keystrokes.filter(
      (k) => timeMs >= k.timestamp && timeMs <= k.timestamp + settings.fadeDurationMs
    );

    if (active.length === 0) return;
    const latest = active[active.length - 1];
    const age = (timeMs - latest.timestamp) / settings.fadeDurationMs; // 0..1
    const alpha = Math.max(0, 1 - Math.pow(age, 2));

    ctx.save();
    ctx.globalAlpha = alpha;

    const parts = [...latest.modifiers, latest.key.toUpperCase()];
    const text = parts.join(' + ');

    ctx.font = '600 13px "JetBrains Mono", monospace';
    const textMetrics = ctx.measureText(text);
    const pillW = textMetrics.width + 32;
    const pillH = 36;
    const pillX = wx + (ww - pillW) / 2;
    const pillY = settings.position === 'top-center' ? wy + 24 : wy + wh - pillH - 24;

    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    // Rounded Pill Background
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 10);
    ctx.fillStyle = 'rgba(15, 17, 26, 0.92)';
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Keystroke Text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pillX + pillW / 2, pillY + pillH / 2);

    ctx.restore();
  }

  /**
   * Draws Webcam Picture-in-Picture Bubble.
   */
  private static drawWebcamBubble(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    settings: WebcamSettings,
    videoSource?: HTMLVideoElement | HTMLCanvasElement | null
  ) {
    const size = settings.size;
    const margin = 36;
    let bx = canvasW - size - margin;
    let by = canvasH - size - margin;

    if (settings.position === 'bottom-left') {
      bx = margin;
      by = canvasH - size - margin;
    } else if (settings.position === 'top-right') {
      bx = canvasW - size - margin;
      by = margin;
    } else if (settings.position === 'top-left') {
      bx = margin;
      by = margin;
    }

    ctx.save();

    // Dual drop shadow
    if (settings.shadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 8;
    }

    // Clip to circle or squircle
    ctx.beginPath();
    if (settings.shape === 'circle') {
      ctx.arc(bx + size / 2, by + size / 2, size / 2, 0, Math.PI * 2);
    } else {
      ctx.roundRect(bx, by, size, size, 24);
    }
    ctx.clip();

    // Render live webcam feed or synthetic presenter avatar
    if (videoSource) {
      try {
        ctx.drawImage(videoSource as CanvasImageSource, bx, by, size, size);
      } catch {
        StudioRenderer.drawSyntheticAvatar(ctx, bx, by, size);
      }
    } else {
      StudioRenderer.drawSyntheticAvatar(ctx, bx, by, size);
    }

    ctx.restore();

    // Outer glow / border outline
    ctx.save();
    ctx.beginPath();
    if (settings.shape === 'circle') {
      ctx.arc(bx + size / 2, by + size / 2, size / 2, 0, Math.PI * 2);
    } else {
      ctx.roundRect(bx, by, size, size, 24);
    }
    ctx.strokeStyle = settings.borderColor || '#ec4899';
    ctx.lineWidth = settings.borderWidth || 3;
    ctx.stroke();
    ctx.restore();
  }

  private static drawSyntheticAvatar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ) {
    const grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, '#3b82f6');
    grad.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, size, size);

    // Presenter silhouette icon
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size * 0.38, size * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x + size / 2, y + size * 0.9, size * 0.36, Math.PI, 0);
    ctx.fill();
  }

  private static drawBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    settings: StudioSettings
  ) {
    if (settings.backgroundType === 'solid') {
      ctx.fillStyle = settings.customBgColor || '#0a0a0c';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    switch (settings.backgroundTheme) {
      case 'sunset': {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#ff5e62');
        grad.addColorStop(0.4, '#ff9966');
        grad.addColorStop(0.7, '#8e2de2');
        grad.addColorStop(1, '#4a00e0');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        break;
      }
      case 'cosmic': {
        const grad = ctx.createRadialGradient(
          width * 0.3,
          height * 0.2,
          100,
          width * 0.5,
          height * 0.5,
          width * 0.8
        );
        grad.addColorStop(0, '#6366f1');
        grad.addColorStop(0.4, '#a855f7');
        grad.addColorStop(0.7, '#ec4899');
        grad.addColorStop(1, '#090a14');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        break;
      }
      case 'emerald': {
        const grad = ctx.createRadialGradient(
          width * 0.2,
          height * 0.2,
          50,
          width * 0.5,
          height * 0.5,
          width * 0.75
        );
        grad.addColorStop(0, '#10b981');
        grad.addColorStop(0.4, '#06b6d4');
        grad.addColorStop(0.7, '#047857');
        grad.addColorStop(1, '#031713');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        break;
      }
      case 'cyberpunk': {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(0.4, '#d946ef');
        grad.addColorStop(0.8, '#f43f5e');
        grad.addColorStop(1, '#090a12');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        break;
      }
      case 'velvet': {
        const grad = ctx.createRadialGradient(
          width * 0.4,
          height * 0.3,
          100,
          width * 0.5,
          height * 0.5,
          width * 0.8
        );
        grad.addColorStop(0, '#e11d48');
        grad.addColorStop(0.5, '#9333ea');
        grad.addColorStop(1, '#100517');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        break;
      }
      case 'slate': {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#334155');
        grad.addColorStop(0.6, '#1e293b');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        break;
      }
      case 'clean-white': {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#f8fafc');
        grad.addColorStop(1, '#e2e8f0');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        break;
      }
      case 'obsidian':
      default: {
        const grad = ctx.createRadialGradient(
          width * 0.5,
          height * 0.2,
          50,
          width * 0.5,
          height * 0.5,
          width * 0.7
        );
        grad.addColorStop(0, '#222225');
        grad.addColorStop(0.6, '#141416');
        grad.addColorStop(1, '#080809');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        break;
      }
    }
  }

  private static fillRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = '#000000';
    ctx.fill();
  }

  private static strokeRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
  }

  private static clipRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.clip();
  }
}

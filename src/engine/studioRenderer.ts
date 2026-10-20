import {
  AspectRatio,
  BackgroundTheme,
  CursorEvent,
  CursorSettings,
  StudioSettings,
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
  cursorEngine: SpringCursorEngine;
  cursorEvents: CursorEvent[];
  zoomKeyframes: ZoomKeyframe[];
  videoNaturalWidth: number;
  videoNaturalHeight: number;
}

export class StudioRenderer {
  /**
   * Calculates canvas dimensions based on target aspect ratio and export resolution.
   */
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

  /**
   * Core frame rendering pass. Renders background, window shell, camera zoom, video frame, and vector cursor.
   */
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

    const headerHeight = studioSettings.windowFrame === 'macOS' ? 36 : studioSettings.windowFrame === 'sleek' ? 24 : 0;
    const totalH = windowH + headerHeight;
    const adjustedY = windowY - headerHeight / 2;

    // 4. Apply 2.5D Perspective Tilt if enabled
    ctx.save();
    if (studioSettings.perspective3D.enabled) {
      const p = studioSettings.perspective3D;
      ctx.translate(canvasW / 2, canvasH / 2);
      // Perspective matrix approximation in 2D
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

    // 6. Draw Window Shell & Frame
    ctx.save();
    StudioRenderer.clipRoundedRect(
      ctx,
      windowX,
      adjustedY,
      windowW,
      totalH,
      studioSettings.borderRadius
    );

    // Window Header Background
    if (headerHeight > 0) {
      const headerGrad = ctx.createLinearGradient(windowX, adjustedY, windowX, adjustedY + headerHeight);
      headerGrad.addColorStop(0, '#262629');
      headerGrad.addColorStop(1, '#1a1a1c');
      ctx.fillStyle = headerGrad;
      ctx.fillRect(windowX, adjustedY, windowW, headerHeight);

      // Bottom separator border
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(windowX, adjustedY + headerHeight - 1, windowW, 1);

      // Traffic Lights for macOS style
      if (studioSettings.windowFrame === 'macOS') {
        const dotRadius = 5.5;
        const startDotX = windowX + 18;
        const dotY = adjustedY + headerHeight / 2;
        const spacing = 16;

        // Red (Close)
        ctx.beginPath();
        ctx.arc(startDotX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ff5f56';
        ctx.fill();

        // Yellow (Minimize)
        ctx.beginPath();
        ctx.arc(startDotX + spacing, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffbd2e';
        ctx.fill();

        // Green (Maximize)
        ctx.beginPath();
        ctx.arc(startDotX + spacing * 2, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#27c93f';
        ctx.fill();
      }

      // Window Title
      if (studioSettings.windowTitle) {
        ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(studioSettings.windowTitle, windowX + windowW / 2, adjustedY + headerHeight / 2);
      }
    }

    // 7. Render Video Frame with Camera Zoom
    const videoY = adjustedY + headerHeight;

    // Crop source video based on camera zoom and center
    const scale = camera.scale;
    const srcW = videoNaturalWidth / scale;
    const srcH = videoNaturalHeight / scale;

    const rawSrcX = camera.centerX * videoNaturalWidth - srcW / 2;
    const rawSrcY = camera.centerY * videoNaturalHeight - srcH / 2;

    const srcX = Math.max(0, Math.min(videoNaturalWidth - srcW, rawSrcX));
    const srcY = Math.max(0, Math.min(videoNaturalHeight - srcH, rawSrcY));

    // Clip to video content area
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
      // Fallback if video frame is momentarily unavailable
      ctx.fillStyle = '#121214';
      ctx.fillRect(windowX, videoY, windowW, windowH);
    }

    // 8. Evaluate & Render Spring-Smoothed Cursor & Ripples
    const cursor = cursorEngine.evaluate(cursorEvents, currentTimeSeconds * 1000);

    // Convert normalized video coords (0..1) to window canvas coords
    const toScreenCoord = (normX: number, normY: number): Point2D => {
      const relX = (normX * videoNaturalWidth - srcX) / srcW;
      const relY = (normY * videoNaturalHeight - srcY) / srcH;
      return {
        x: windowX + relX * windowW,
        y: videoY + relY * windowH,
      };
    };

    // Draw click ripples
    cursorEngine.drawRipples(ctx, toScreenCoord, cursor.recentClicks);

    // Draw smoothed cursor pointer
    const cursorScreen = toScreenCoord(cursor.x, cursor.y);
    cursorEngine.draw(ctx, cursorScreen.x, cursorScreen.y, cursor);

    ctx.restore(); // end video clip
    ctx.restore(); // end window shell clip

    // Window subtle glass stroke border
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

    ctx.restore(); // end perspective transform

    return { camera, cursor };
  }

  /**
   * Fills background with luxury mesh gradients or flat tones.
   */
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

import { CursorEvent, CursorSettings } from '../types';

export interface Point2D {
  x: number;
  y: number;
}

export interface SmoothedCursorState {
  x: number; // normalized 0..1
  y: number;
  vx: number;
  vy: number;
  isClicking: boolean;
  recentClicks: Array<{ x: number; y: number; age: number; button: number }>;
}

/**
 * Spring-damper physics engine for cinematic cursor trajectory smoothing.
 * Replaces erratic, shaky human mouse movements with fluid, organic glide curves.
 */
export class SpringCursorEngine {
  private currentX: number = 0.5;
  private currentY: number = 0.5;
  private velocityX: number = 0;
  private velocityY: number = 0;
  private lastUpdateTime: number = 0;

  constructor(
    private settings: CursorSettings = {
      visible: true,
      smoothing: 75,
      springStiffness: 160,
      springDamping: 22,
      springMass: 1.0,
      style: 'macos',
      size: 24,
      showRipples: true,
      rippleColor: '#ec4899',
      tactileClickSound: true,
      clickSoundVolume: 0.4,
    }
  ) {}

  public updateSettings(newSettings: Partial<CursorSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  public reset(initialX = 0.5, initialY = 0.5) {
    this.currentX = initialX;
    this.currentY = initialY;
    this.velocityX = 0;
    this.velocityY = 0;
    this.lastUpdateTime = 0;
  }

  /**
   * Find interpolated raw target at time `tMs` from discrete telemetry events.
   */
  public getRawTargetAt(events: CursorEvent[], tMs: number): Point2D {
    if (!events || events.length === 0) {
      return { x: 0.5, y: 0.5 };
    }

    if (tMs <= events[0].timestamp) {
      return { x: events[0].x, y: events[0].y };
    }

    if (tMs >= events[events.length - 1].timestamp) {
      const last = events[events.length - 1];
      return { x: last.x, y: last.y };
    }

    // Binary search for surrounding events
    let low = 0;
    let high = events.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (events[mid].timestamp < tMs) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const prevIndex = Math.max(0, low - 1);
    const nextIndex = Math.min(events.length - 1, low);

    const prev = events[prevIndex];
    const next = events[nextIndex];

    if (prev === next || next.timestamp === prev.timestamp) {
      return { x: prev.x, y: prev.y };
    }

    const alpha = (tMs - prev.timestamp) / (next.timestamp - prev.timestamp);

    // Smooth cubic Hermite interpolation between coordinates
    const smoothAlpha = alpha * alpha * (3 - 2 * alpha);
    return {
      x: prev.x + (next.x - prev.x) * smoothAlpha,
      y: prev.y + (next.y - prev.y) * smoothAlpha,
    };
  }

  /**
   * Evaluates the smoothed cursor position at time `tMs` by simulating spring-damper dynamics.
   */
  public evaluate(events: CursorEvent[], tMs: number, dtSeconds = 1 / 60): SmoothedCursorState {
    const rawTarget = this.getRawTargetAt(events, tMs);

    // If smoothing is set to 0, return raw coordinates immediately
    if (this.settings.smoothing <= 0) {
      this.currentX = rawTarget.x;
      this.currentY = rawTarget.y;
      this.velocityX = 0;
      this.velocityY = 0;
    } else {
      // Dynamic parameters scaled by smoothing slider (0-100)
      const smoothingFactor = this.settings.smoothing / 100;
      const k = this.settings.springStiffness * (1 - smoothingFactor * 0.4);
      const c = this.settings.springDamping * (1 + smoothingFactor * 0.5);
      const m = this.settings.springMass;

      // Sub-stepping for numerical stability
      const substeps = 3;
      const subDt = Math.min(dtSeconds, 0.05) / substeps;

      for (let s = 0; s < substeps; s++) {
        const dx = this.currentX - rawTarget.x;
        const dy = this.currentY - rawTarget.y;

        const forceX = -k * dx - c * this.velocityX;
        const forceY = -k * dy - c * this.velocityY;

        const ax = forceX / m;
        const ay = forceY / m;

        this.velocityX += ax * subDt;
        this.velocityY += ay * subDt;

        this.currentX += this.velocityX * subDt;
        this.currentY += this.velocityY * subDt;
      }
    }

    // Determine click state & recent clicks within 600ms for ripple waves
    const recentClicks: Array<{ x: number; y: number; age: number; button: number }> = [];
    let isClicking = false;

    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      const delta = tMs - ev.timestamp;
      if (delta >= 0 && delta <= 600) {
        if (ev.type === 'click' || ev.type === 'mousedown' || ev.type === 'dblclick') {
          recentClicks.push({
            x: ev.x,
            y: ev.y,
            age: delta / 600, // 0 (just happened) to 1 (faded)
            button: ev.button ?? 0,
          });
        }
      }
      if (delta >= 0 && delta <= 120 && (ev.type === 'mousedown' || ev.type === 'click')) {
        isClicking = true;
      }
      if (delta > 1000) break;
    }

    return {
      x: this.currentX,
      y: this.currentY,
      vx: this.velocityX,
      vy: this.velocityY,
      isClicking,
      recentClicks,
    };
  }

  /**
   * Renders the stylized vector cursor onto the 2D canvas context.
   */
  public draw(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    state: SmoothedCursorState
  ) {
    if (!this.settings.visible) return;

    const size = this.settings.size;
    const isClicking = state.isClicking;

    ctx.save();
    ctx.translate(screenX, screenY);

    // Subtle scale-down when clicking for tactile press feel
    if (isClicking) {
      ctx.scale(0.92, 0.92);
    }

    switch (this.settings.style) {
      case 'macos':
        this.drawMacOSCursor(ctx, size);
        break;
      case 'dark':
        this.drawDarkCursor(ctx, size);
        break;
      case 'glow-ring':
        this.drawGlowRingCursor(ctx, size);
        break;
      case 'neon-dot':
        this.drawNeonDotCursor(ctx, size);
        break;
      default:
        this.drawMacOSCursor(ctx, size);
    }

    ctx.restore();
  }

  private drawMacOSCursor(ctx: CanvasRenderingContext2D, size: number) {
    ctx.save();
    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    // Elegant crisp macOS pointer SVG path
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, size * 0.9);
    ctx.lineTo(size * 0.28, size * 0.65);
    ctx.lineTo(size * 0.52, size * 1.05);
    ctx.lineTo(size * 0.68, size * 0.95);
    ctx.lineTo(size * 0.44, size * 0.58);
    ctx.lineTo(size * 0.75, size * 0.58);
    ctx.closePath();

    // Body
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Pure crisp white outline
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.restore();
  }

  private drawDarkCursor(ctx: CanvasRenderingContext2D, size: number) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, size * 0.85);
    ctx.lineTo(size * 0.24, size * 0.62);
    ctx.lineTo(size * 0.46, size * 0.98);
    ctx.lineTo(size * 0.6, size * 0.9);
    ctx.lineTo(size * 0.38, size * 0.54);
    ctx.lineTo(size * 0.68, size * 0.54);
    ctx.closePath();

    ctx.fillStyle = '#18181b';
    ctx.fill();

    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.stroke();
    ctx.restore();
  }

  private drawGlowRingCursor(ctx: CanvasRenderingContext2D, size: number) {
    ctx.save();
    const radius = size * 0.45;

    // Glow ring
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#0284c7';
    ctx.shadowBlur = 10;
    ctx.stroke();

    // Center precision dot
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  private drawNeonDotCursor(ctx: CanvasRenderingContext2D, size: number) {
    ctx.save();
    const radius = size * 0.35;

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#e11d48';
    ctx.shadowBlur = 14;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  /**
   * Renders expanding tactile click ripples.
   */
  public drawRipples(
    ctx: CanvasRenderingContext2D,
    toScreenCoord: (normX: number, normY: number) => Point2D,
    recentClicks: Array<{ x: number; y: number; age: number; button: number }>
  ) {
    if (!this.settings.showRipples) return;

    for (const click of recentClicks) {
      const pos = toScreenCoord(click.x, click.y);
      const maxRadius = this.settings.size * 2.2;
      const radius = maxRadius * Math.sin((click.age * Math.PI) / 2);
      const alpha = Math.max(0, 1 - click.age);

      ctx.save();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);

      const color = this.settings.rippleColor;
      ctx.strokeStyle = `${color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 2.5 * (1 - click.age * 0.5);
      ctx.stroke();

      // Subtle filled core
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = `${color}${Math.floor(alpha * 0.3 * 255).toString(16).padStart(2, '0')}`;
      ctx.fill();

      ctx.restore();
    }
  }
}

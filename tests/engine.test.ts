import { describe, it, expect } from 'vitest';
import { AutoZoomEngine } from '../src/engine/autoZoom';
import { SpringCursorEngine } from '../src/engine/cursorPhysics';
import { StudioRenderer } from '../src/engine/studioRenderer';
import { CursorEvent } from '../src/types';

describe('AutoZoomEngine', () => {
  it('correctly clamps center coordinates to prevent showing offscreen boundaries', () => {
    // At scale 2.0, half viewport is 0.25. Valid center range is [0.25, 0.75]
    const clampedNearOrigin = AutoZoomEngine.clampCenter(0.05, 0.05, 2.0);
    expect(clampedNearOrigin.x).toBeCloseTo(0.25, 2);
    expect(clampedNearOrigin.y).toBeCloseTo(0.25, 2);

    const clampedNearMax = AutoZoomEngine.clampCenter(0.98, 0.95, 2.0);
    expect(clampedNearMax.x).toBeCloseTo(0.75, 2);
    expect(clampedNearMax.y).toBeCloseTo(0.75, 2);

    // Center in safe area remains unchanged
    const safeCenter = AutoZoomEngine.clampCenter(0.48, 0.52, 2.0);
    expect(safeCenter.x).toBeCloseTo(0.48, 2);
    expect(safeCenter.y).toBeCloseTo(0.52, 2);
  });

  it('clusters proximate clicks into unified zoom segments', () => {
    const events: CursorEvent[] = [
      { x: 0.3, y: 0.3, timestamp: 1000, type: 'click' },
      { x: 0.32, y: 0.31, timestamp: 2000, type: 'click' }, // Within cluster window (1s diff, 0.02 dist)
      { x: 0.8, y: 0.8, timestamp: 6000, type: 'click' }, // Separate cluster
    ];

    const keyframes = AutoZoomEngine.generateKeyframes(events, 10, {
      defaultScale: 2.0,
      holdDuration: 1.5,
      clusterTimeThreshold: 2.0,
      clusterDistThreshold: 0.3,
    });

    expect(keyframes.length).toBe(2);
    expect(keyframes[0].startTime).toBeLessThan(1.0);
    expect(keyframes[0].endTime).toBeGreaterThanOrEqual(3.5);
  });

  it('smoothly interpolates camera state during transitions', () => {
    const keyframes = [
      {
        id: 'k1',
        startTime: 2.0,
        endTime: 5.0,
        targetX: 0.4,
        targetY: 0.4,
        scale: 2.0,
        transitionDuration: 0.5,
        easing: 'easeInOut' as const,
      },
    ];

    // Prior to keyframe
    const stateBefore = AutoZoomEngine.evaluateCamera(keyframes, 1.0);
    expect(stateBefore.scale).toBe(1.0);
    expect(stateBefore.centerX).toBe(0.5);

    // Mid-transition into zoom (2.25s)
    const stateMidZoom = AutoZoomEngine.evaluateCamera(keyframes, 2.25);
    expect(stateMidZoom.scale).toBeGreaterThan(1.0);
    expect(stateMidZoom.scale).toBeLessThan(2.0);

    // Steady hold (3.5s)
    const stateSteady = AutoZoomEngine.evaluateCamera(keyframes, 3.5);
    expect(stateSteady.scale).toBe(2.0);
    expect(stateSteady.centerX).toBeCloseTo(0.4, 2);

    // After keyframe has fully exited (6.0s)
    const stateAfter = AutoZoomEngine.evaluateCamera(keyframes, 6.0);
    expect(stateAfter.scale).toBe(1.0);
  });
});

describe('SpringCursorEngine', () => {
  it('smoothly guides cursor position towards target without blowing up', () => {
    const engine = new SpringCursorEngine({
      visible: true,
      smoothing: 80,
      springStiffness: 180,
      springDamping: 24,
      springMass: 1.0,
      style: 'macos',
      size: 24,
      showRipples: true,
      rippleColor: '#ec4899',
      tactileClickSound: false,
      clickSoundVolume: 0,
    });

    engine.reset(0, 0);

    const telemetry: CursorEvent[] = [
      { x: 0.0, y: 0.0, timestamp: 0, type: 'move' },
      { x: 0.8, y: 0.6, timestamp: 500, type: 'move' },
    ];

    // Simulate several frames
    let state = engine.evaluate(telemetry, 0, 1 / 60);
    expect(state.x).toBe(0);

    for (let t = 50; t <= 1000; t += 50) {
      state = engine.evaluate(telemetry, t, 0.05);
    }

    // After 1000ms, cursor should have converged stably towards target
    expect(state.x).toBeGreaterThan(0.7);
    expect(state.y).toBeGreaterThan(0.5);
    expect(Number.isFinite(state.x)).toBe(true);
    expect(Number.isFinite(state.y)).toBe(true);
  });

  it('detects recent click events for tactile ripple rendering', () => {
    const engine = new SpringCursorEngine();
    const telemetry: CursorEvent[] = [
      { x: 0.5, y: 0.5, timestamp: 1000, type: 'click' },
    ];

    // At 1100ms (100ms after click)
    const state = engine.evaluate(telemetry, 1100, 1 / 60);
    expect(state.isClicking).toBe(true);
    expect(state.recentClicks.length).toBe(1);
    expect(state.recentClicks[0].age).toBeGreaterThan(0);
    expect(state.recentClicks[0].age).toBeLessThan(1);

    // At 2000ms (1000ms after click, faded)
    const stateLater = engine.evaluate(telemetry, 2000, 1 / 60);
    expect(stateLater.isClicking).toBe(false);
    expect(stateLater.recentClicks.length).toBe(0);
  });
});

describe('StudioRenderer', () => {
  it('computes exact pixel dimensions for standard aspect ratios', () => {
    const dim169 = StudioRenderer.getDimensionsForAspectRatio('16:9', 1920);
    expect(dim169.width).toBe(1920);
    expect(dim169.height).toBe(1080);

    const dim916 = StudioRenderer.getDimensionsForAspectRatio('9:16', 1920);
    expect(dim916.width).toBe(1080);
    expect(dim916.height).toBe(1920);

    const dim11 = StudioRenderer.getDimensionsForAspectRatio('1:1', 1920);
    expect(dim11.width).toBe(1920);
    expect(dim11.height).toBe(1920);

    const dim43 = StudioRenderer.getDimensionsForAspectRatio('4:3', 1920);
    expect(dim43.width).toBe(1920);
    expect(dim43.height).toBe(1440);
  });
});

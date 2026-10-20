import { CursorEvent, IdleRampSettings } from '../types';

export interface IdleInterval {
  id: string;
  startTime: number; // seconds
  endTime: number;
  duration: number;
}

export class IdleSpeedCompressor {
  /**
   * Scans cursor telemetry and keystroke activity to detect idle spans where user is inactive.
   */
  public static detectIdleSpans(
    events: CursorEvent[],
    totalDurationSeconds: number,
    settings: IdleRampSettings
  ): IdleInterval[] {
    if (!settings.enabled || !events || events.length === 0) return [];

    const thresholdMs = settings.thresholdSeconds * 1000;
    const intervals: IdleInterval[] = [];

    let lastActiveTimeMs = 0;
    let lastX = events[0].x;
    let lastY = events[0].y;

    for (let i = 1; i < events.length; i++) {
      const ev = events[i];
      const dist = Math.hypot(ev.x - lastX, ev.y - lastY);
      const isAction = ev.type === 'click' || ev.type === 'mousedown' || ev.type === 'keydown';

      // If significant cursor motion (> 0.03 normalized) or action occurred, user is active
      if (dist > 0.03 || isAction) {
        const idleDurationMs = ev.timestamp - lastActiveTimeMs;
        if (idleDurationMs >= thresholdMs) {
          intervals.push({
            id: `idle_${Math.floor(lastActiveTimeMs)}`,
            startTime: (lastActiveTimeMs + 500) / 1000,
            endTime: (ev.timestamp - 300) / 1000,
            duration: (idleDurationMs - 800) / 1000,
          });
        }
        lastActiveTimeMs = ev.timestamp;
        lastX = ev.x;
        lastY = ev.y;
      }
    }

    // Check trailing silence until end of recording
    const finalIdleMs = totalDurationSeconds * 1000 - lastActiveTimeMs;
    if (finalIdleMs >= thresholdMs) {
      intervals.push({
        id: `idle_${Math.floor(lastActiveTimeMs)}`,
        startTime: (lastActiveTimeMs + 500) / 1000,
        endTime: totalDurationSeconds,
        duration: (finalIdleMs - 500) / 1000,
      });
    }

    return intervals.filter((item) => item.duration > 0.8);
  }

  /**
   * Checks if current playback time is inside an idle interval and returns dynamic speed multiplier.
   */
  public static getSpeedMultiplierAt(
    currentTimeSeconds: number,
    idleIntervals: IdleInterval[],
    settings: IdleRampSettings
  ): number {
    if (!settings.enabled || idleIntervals.length === 0) return 1.0;

    for (const interval of idleIntervals) {
      if (currentTimeSeconds >= interval.startTime && currentTimeSeconds <= interval.endTime) {
        return settings.speedMultiplier;
      }
    }

    return 1.0;
  }
}

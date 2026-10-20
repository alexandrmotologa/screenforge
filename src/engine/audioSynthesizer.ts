import { ClickAudioStyle } from '../types';

/**
 * Pure Web Audio API tactile mechanical click synthesizer.
 * Synthesizes crisp physical click transients on mouse actions with zero external sound files.
 */
export class ClickAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.4;
  private style: ClickAudioStyle = 'mechanical';

  constructor(options: { volume?: number; isMuted?: boolean; style?: ClickAudioStyle } = {}) {
    if (options.volume !== undefined) this.volume = options.volume;
    if (options.isMuted !== undefined) this.isMuted = options.isMuted;
    if (options.style !== undefined) this.style = options.style;
  }

  private initContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public setStyle(style: ClickAudioStyle) {
    this.style = style;
  }

  /**
   * Triggers an authentic synthetic click sound at the current audio time.
   */
  public playClick(style: ClickAudioStyle = this.style) {
    if (this.isMuted || this.volume <= 0) return;

    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(this.volume, now);
      masterGain.connect(ctx.destination);

      if (style === 'mechanical') {
        this.synthesizeMechanicalClick(ctx, masterGain, now);
      } else if (style === 'soft') {
        this.synthesizeSoftTap(ctx, masterGain, now);
      } else {
        this.synthesizeMinimalClick(ctx, masterGain, now);
      }
    } catch {
      // Audio playback failsafe
    }
  }

  private synthesizeMechanicalClick(ctx: AudioContext, dest: AudioNode, now: number) {
    // 1. Sharp initial transient snap
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2800, now);
    filter.Q.setValueAtTime(3.0, now);

    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(3200, now);
    snapOsc.frequency.exponentialRampToValueAtTime(400, now + 0.012);

    snapGain.gain.setValueAtTime(0.7, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    snapOsc.connect(filter);
    filter.connect(snapGain);
    snapGain.connect(dest);

    snapOsc.start(now);
    snapOsc.stop(now + 0.018);

    // 2. Resonant switch body cavity thud
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();

    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(420, now + 0.002);
    bodyOsc.frequency.exponentialRampToValueAtTime(140, now + 0.035);

    bodyGain.gain.setValueAtTime(0.5, now + 0.002);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(dest);

    bodyOsc.start(now + 0.002);
    bodyOsc.stop(now + 0.042);
  }

  private synthesizeSoftTap(ctx: AudioContext, dest: AudioNode, now: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, now);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.025);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.032);
  }

  private synthesizeMinimalClick(ctx: AudioContext, dest: AudioNode, now: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.01);
  }
}

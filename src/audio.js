/**
 * Lightweight Web Audio API synthesizer for retro Tibia-inspired sound effects.
 */

export class AudioEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  ensureContext() {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        this.ctx = new Ctx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  tone(freqStart, freqEnd, durationSec, type = 'square', gainPeak = 0.06, delaySec = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t0 = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durationSec + 0.02);
  }

  play(name) {
    if (!this.enabled) return;
    switch (name) {
      case 'hit':
        this.tone(210, 85, 0.08, 'sawtooth', 0.06);
        break;
      case 'hurt':
        this.tone(160, 65, 0.11, 'square', 0.06);
        break;
      case 'poof':
        this.tone(130, 95, 0.05, 'triangle', 0.04);
        break;
      case 'heal':
        this.tone(440, 660, 0.12, 'sine', 0.05);
        this.tone(660, 880, 0.14, 'sine', 0.05, 0.08);
        break;
      case 'fire':
        this.tone(240, 90, 0.2, 'sawtooth', 0.06);
        this.tone(360, 140, 0.18, 'triangle', 0.04, 0.04);
        break;
      case 'coin':
        this.tone(880, 1320, 0.08, 'sine', 0.04);
        break;
      case 'step':
        this.tone(190, 260, 0.09, 'triangle', 0.04);
        break;
      case 'levelup':
        this.tone(523, 523, 0.1, 'triangle', 0.06, 0);
        this.tone(659, 659, 0.1, 'triangle', 0.06, 0.1);
        this.tone(784, 784, 0.12, 'triangle', 0.06, 0.2);
        this.tone(1046, 1046, 0.24, 'triangle', 0.07, 0.32);
        break;
      default:
        break;
    }
  }
}

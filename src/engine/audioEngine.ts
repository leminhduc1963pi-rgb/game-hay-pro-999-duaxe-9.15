/**
 * High-End Racing Audio Synthesizer Engine
 * Uses Web Audio API for synthetic engine roar, transmission whine, tire skid, and race SFX.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private isInitialized: boolean = false;
  public isMuted: boolean = false;

  // Engine sound nodes
  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;

  // Tire skid / screech nodes
  private skidGain: GainNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;
  private skidNoiseNode: AudioBufferSourceNode | null = null;

  init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.ctx = new AudioCtxClass();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.45, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // 1. Engine Oscillator Chain (Sawtooth + Triangle rich harmonics)
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.setValueAtTime(65, this.ctx.currentTime);

      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.setValueAtTime(32.5, this.ctx.currentTime);

      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(450, this.ctx.currentTime);
      this.filterNode.Q.setValueAtTime(3.5, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

      this.engineOsc1.connect(this.filterNode);
      this.engineOsc2.connect(this.filterNode);
      this.filterNode.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc1.start();
      this.engineOsc2.start();

      // 2. Tire Skid Noise Generator (Pink/White noise with bandpass filter)
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.skidNoiseNode = this.ctx.createBufferSource();
      this.skidNoiseNode.buffer = noiseBuffer;
      this.skidNoiseNode.loop = true;

      this.skidFilter = this.ctx.createBiquadFilter();
      this.skidFilter.type = 'bandpass';
      this.skidFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      this.skidFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

      this.skidGain = this.ctx.createGain();
      this.skidGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.skidNoiseNode.connect(this.skidFilter);
      this.skidFilter.connect(this.skidGain);
      this.skidGain.connect(this.masterGain);

      this.skidNoiseNode.start();

      this.isInitialized = true;
    } catch (err) {
      console.warn('AudioEngine initialization error:', err);
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.45, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  playCountdownBeep(isFinal: boolean = false) {
    if (this.isMuted || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = isFinal ? 'square' : 'sine';
      osc.frequency.setValueAtTime(isFinal ? 880 : 440, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (isFinal ? 0.6 : 0.25));

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + (isFinal ? 0.65 : 0.3));
    } catch {
      // Ignore audio glitches
    }
  }

  update(rpm: number = 3500, throttle: number = 0.8, isDrifting: boolean = false, isBraking: boolean = false, speed: number = 120) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;

      // Base engine frequency scaled by RPM & speed (40Hz idle to 380Hz redline)
      const baseFreq = THREE_MathUtils_lerp(50, 360, Math.min(1.0, Math.max(0.1, (rpm || 3000) / 9500)));
      if (this.engineOsc1) {
        this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
      }
      if (this.engineOsc2) {
        this.engineOsc2.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.04);
      }

      // Filter opening with throttle & speed
      if (this.filterNode) {
        const filterCutoff = THREE_MathUtils_lerp(400, 2600, Math.min(1.0, (throttle * 0.6) + (speed / 500) * 0.5));
        this.filterNode.frequency.setTargetAtTime(filterCutoff, now, 0.05);
      }

      // Tire Skid sound
      if (this.skidGain) {
        const targetSkidVol = (isDrifting || isBraking) ? Math.min(0.35, 0.15 + (speed / 500) * 0.2) : 0;
        this.skidGain.gain.setTargetAtTime(targetSkidVol, now, 0.06);
      }
    } catch {
      // Ignore
    }
  }
}

function THREE_MathUtils_lerp(x: number, y: number, t: number): number {
  return (1 - t) * x + t * y;
}

export const audioEngine = new AudioEngine();

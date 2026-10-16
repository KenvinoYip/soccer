/**
 * Shaolin Soccer - AudioSystem
 * Pure WebAudio API synthesizer for responsive sound effects without external audio assets.
 * Compatible with Cocos Creator 3.8 web platform.
 */

export class AudioSystem {
  private actx: AudioContext | null = null;
  private masterVolume: number = 1.0;
  private isMuted: boolean = false;

  /**
   * Initializes the AudioContext lazily on user gesture.
   */
  public init(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (this.actx && this.actx.state !== 'closed') {
      if (this.actx.state === 'suspended') {
        this.actx.resume().catch(() => {});
      }
      return this.actx;
    }

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioCtxClass) {
        this.actx = new AudioCtxClass();
        if (this.actx.state === 'suspended') {
          this.actx.resume().catch(() => {});
        }
      }
    } catch {
      this.actx = null;
    }

    return this.actx;
  }

  /**
   * Set master sound volume (0.0 to 1.0)
   */
  public setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Toggle mute on/off
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * Set mute state explicitly
   */
  public setMute(muted: boolean): void {
    this.isMuted = muted;
  }

  /**
   * Generate an in-memory AudioBuffer containing white noise
   */
  private createNoiseBuffer(duration: number): AudioBuffer | null {
    if (!this.actx) return null;
    const sampleRate = this.actx.sampleRate;
    const bufferSize = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.actx.createBuffer(1, bufferSize, sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      channelData[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Generate a non-linear distortion curve for punchy wave shaping
   */
  private createDistortionCurve(amount: number = 30): Float32Array {
    const k = amount;
    const nSamples = 22050;
    const arrayBuffer = new ArrayBuffer(nSamples * 4);
    const curve = new Float32Array(arrayBuffer);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  /**
   * Play synthesized sound effect
   */
  public play(type: 'kick' | 'superKick' | 'boom' | 'shield' | 'combo' | 'tnt' | 'crowd' | string): void {
    if (this.isMuted) return;

    const ctx = this.init();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const vol = this.masterVolume;

    switch (type) {
      case 'kick': {
        // Triangle osc, 200 -> 30Hz, 0.15s, gain 0.6 -> 0.01
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

        gain.gain.setValueAtTime(0.6 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }

      case 'superKick': {
        // Sawtooth + distortion, 320 -> 25Hz, 0.3s, gain 0.8. Add second osc at 160Hz for richness
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const shaper = ctx.createWaveShaper();
        const gain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(320, now);
        osc1.frequency.exponentialRampToValueAtTime(25, now + 0.3);

        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(160, now);
        osc2.frequency.exponentialRampToValueAtTime(20, now + 0.3);

        shaper.curve = this.createDistortionCurve(35) as any;
        shaper.oversample = '2x';

        gain.gain.setValueAtTime(0.8 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc1.connect(shaper);
        osc2.connect(shaper);
        shaper.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.31);
        osc2.stop(now + 0.31);
        break;
      }

      case 'boom': {
        // White noise + lowpass filter 500 -> 50Hz, 0.3s, gain 0.8 -> 0.01. Layer with low sine at 60Hz
        const noiseBuffer = this.createNoiseBuffer(0.3);
        if (noiseBuffer) {
          const noise = ctx.createBufferSource();
          noise.buffer = noiseBuffer;

          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(500, now);
          filter.frequency.exponentialRampToValueAtTime(50, now + 0.3);

          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.8 * vol, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

          noise.connect(filter);
          filter.connect(noiseGain);
          noiseGain.connect(ctx.destination);

          noise.start(now);
          noise.stop(now + 0.31);
        }

        // Sub-bass sine layer
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(60, now);
        subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.3);

        subGain.gain.setValueAtTime(0.7 * vol, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        subOsc.connect(subGain);
        subGain.connect(ctx.destination);

        subOsc.start(now);
        subOsc.stop(now + 0.31);
        break;
      }

      case 'shield': {
        // 少林金刚铜钟金石交鸣 (Shaolin Bronze Bell Gong with rich harmonic overtones)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const strike = ctx.createOscillator();
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();
        const strikeGain = ctx.createGain();

        // 铜钟基频 ~520Hz，悠远衰减 0.45s
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(520, now);
        osc1.frequency.exponentialRampToValueAtTime(460, now + 0.45);

        gain1.gain.setValueAtTime(0.7 * vol, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

        // 泛音层 1040Hz
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1040, now);
        osc2.frequency.exponentialRampToValueAtTime(980, now + 0.3);

        gain2.gain.setValueAtTime(0.35 * vol, now);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        // 敲击瞬态金石清脆声 0.04s
        strike.type = 'triangle';
        strike.frequency.setValueAtTime(1200, now);
        strike.frequency.exponentialRampToValueAtTime(250, now + 0.05);

        strikeGain.gain.setValueAtTime(0.6 * vol, now);
        strikeGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        osc1.connect(gain1); gain1.connect(ctx.destination);
        osc2.connect(gain2); gain2.connect(ctx.destination);
        strike.connect(strikeGain); strikeGain.connect(ctx.destination);

        osc1.start(now); osc1.stop(now + 0.46);
        osc2.start(now); osc2.stop(now + 0.31);
        strike.start(now); strike.stop(now + 0.06);
        break;
      }

      case 'bellShatter': {
        // 金钟罩爆碎·琉璃水晶崩裂炸响
        const noiseBuffer = this.createNoiseBuffer(0.35);
        if (noiseBuffer) {
          const noise = ctx.createBufferSource();
          noise.buffer = noiseBuffer;
          const bandpass = ctx.createBiquadFilter();
          bandpass.type = 'bandpass';
          bandpass.frequency.setValueAtTime(2200, now);
          bandpass.Q.setValueAtTime(4.0, now);

          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.85 * vol, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

          noise.connect(bandpass);
          bandpass.connect(noiseGain);
          noiseGain.connect(ctx.destination);

          noise.start(now);
          noise.stop(now + 0.36);
        }

        // 晶体碎裂降调震音
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.28);

        gain.gain.setValueAtTime(0.5 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.29);
        break;
      }

      case 'brickHit': {
        // 玄石古碑撞击金石闷响 (Crisp stone impact thud)
        const osc = ctx.createOscillator();
        const thud = ctx.createOscillator();
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();

        // 瞬态高频石击
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
        gain1.gain.setValueAtTime(0.55 * vol, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.045);

        // 石碑厚实闷响
        thud.type = 'sine';
        thud.frequency.setValueAtTime(130, now);
        thud.frequency.exponentialRampToValueAtTime(50, now + 0.08);
        gain2.gain.setValueAtTime(0.6 * vol, now);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(gain1); gain1.connect(ctx.destination);
        thud.connect(gain2); gain2.connect(ctx.destination);

        osc.start(now); osc.stop(now + 0.05);
        thud.start(now); thud.stop(now + 0.09);
        break;
      }

      case 'brickShatter': {
        // 少林玄石古碑碎石崩解爆裂 (Explosive stone crunch & shattering fracture)
        const noiseBuffer = this.createNoiseBuffer(0.25);
        if (noiseBuffer) {
          const noise = ctx.createBufferSource();
          noise.buffer = noiseBuffer;
          const bandpass = ctx.createBiquadFilter();
          bandpass.type = 'bandpass';
          bandpass.frequency.setValueAtTime(2400, now);
          bandpass.Q.setValueAtTime(2.8, now);

          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.9 * vol, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

          noise.connect(bandpass);
          bandpass.connect(noiseGain);
          noiseGain.connect(ctx.destination);

          noise.start(now);
          noise.stop(now + 0.25);
        }

        // 石块崩断脆音
        const crunch = ctx.createOscillator();
        const crunchGain = ctx.createGain();
        crunch.type = 'sawtooth';
        crunch.frequency.setValueAtTime(1100, now);
        crunch.frequency.exponentialRampToValueAtTime(160, now + 0.14);

        crunchGain.gain.setValueAtTime(0.65 * vol, now);
        crunchGain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

        crunch.connect(crunchGain);
        crunchGain.connect(ctx.destination);

        crunch.start(now);
        crunch.stop(now + 0.15);

        // 重低音下沉
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(95, now);
        sub.frequency.exponentialRampToValueAtTime(28, now + 0.28);

        subGain.gain.setValueAtTime(0.75 * vol, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

        sub.connect(subGain);
        subGain.connect(ctx.destination);

        sub.start(now);
        sub.stop(now + 0.29);
        break;
      }

      case 'combo': {
        // Two short sine beeps ascending (440Hz then 880Hz), 0.1s each
        const beep1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        beep1.type = 'sine';
        beep1.frequency.setValueAtTime(440, now);

        gain1.gain.setValueAtTime(0.4 * vol, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

        beep1.connect(gain1);
        gain1.connect(ctx.destination);

        beep1.start(now);
        beep1.stop(now + 0.1);

        const beep2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        beep2.type = 'sine';
        beep2.frequency.setValueAtTime(880, now + 0.09);

        gain2.gain.setValueAtTime(0.01, now);
        gain2.gain.setValueAtTime(0.45 * vol, now + 0.09);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.19);

        beep2.connect(gain2);
        gain2.connect(ctx.destination);

        beep2.start(now + 0.09);
        beep2.stop(now + 0.2);
        break;
      }

      case 'tnt': {
        // Noise burst 0.4s + low rumble sine at 40Hz
        const noiseBuffer = this.createNoiseBuffer(0.4);
        if (noiseBuffer) {
          const noise = ctx.createBufferSource();
          noise.buffer = noiseBuffer;

          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(750, now);
          filter.frequency.exponentialRampToValueAtTime(80, now + 0.4);

          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.9 * vol, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

          noise.connect(filter);
          filter.connect(noiseGain);
          noiseGain.connect(ctx.destination);

          noise.start(now);
          noise.stop(now + 0.42);
        }

        const rumble = ctx.createOscillator();
        const rumbleGain = ctx.createGain();
        rumble.type = 'sine';
        rumble.frequency.setValueAtTime(40, now);
        rumble.frequency.exponentialRampToValueAtTime(22, now + 0.45);

        rumbleGain.gain.setValueAtTime(0.85 * vol, now);
        rumbleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

        rumble.connect(rumbleGain);
        rumbleGain.connect(ctx.destination);

        rumble.start(now);
        rumble.stop(now + 0.47);
        break;
      }

      case 'wata': {
        // Bruce Lee signature martial kiai shout ('WATA~!')
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(1050, now + 0.07);
        osc.frequency.exponentialRampToValueAtTime(720, now + 0.22);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(1800, now + 0.08);
        filter.frequency.exponentialRampToValueAtTime(900, now + 0.22);
        filter.Q.value = 3.5;

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.85 * vol, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }

      case 'crowd': {
        // Multi-layered noise with resonant filter to simulate crowd roar (0.8s)
        const noiseBuffer = this.createNoiseBuffer(0.85);
        if (!noiseBuffer) break;

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.Q.setValueAtTime(3.4, now);
        bandpass.frequency.setValueAtTime(380, now);
        bandpass.frequency.linearRampToValueAtTime(740, now + 0.32);
        bandpass.frequency.exponentialRampToValueAtTime(300, now + 0.8);

        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(280, now);

        const crowdGain = ctx.createGain();
        crowdGain.gain.setValueAtTime(0.01, now);
        crowdGain.gain.linearRampToValueAtTime(0.72 * vol, now + 0.16);
        crowdGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

        noise.connect(bandpass);
        noise.connect(lowpass);
        bandpass.connect(crowdGain);
        lowpass.connect(crowdGain);
        crowdGain.connect(ctx.destination);

        noise.start(now);
        noise.stop(now + 0.82);
        break;
      }

      default:
        break;
    }
  }
}

export const audioSystem = new AudioSystem();

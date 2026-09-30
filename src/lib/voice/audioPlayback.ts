/**
 * Audio progressive playback for Gemini Live API & Assistant Speech
 * Plays 24,000 Hz raw 16-bit linear PCM with jitter-free timeline scheduling,
 * calibrated output gain boosting, and instantaneous interruption support (barge-in cutoff).
 */

// Single configurable assistant output gain constant (Safe range 1.0 - 2.0; 1.8 = significantly louder & clear)
export const ASSISTANT_OUTPUT_GAIN = 1.8;

export class LiveAudioPlayer {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private nextStartTime = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private sampleRate = 24000;
  private isPlaying = false;
  private checkEndTimeout: any = null;
  private onPlaybackStateChange?: (isPlaying: boolean) => void;
  private onTurnEndCallback: (() => void) | null = null;

  constructor(onPlaybackStateChange?: (isPlaying: boolean) => void) {
    this.onPlaybackStateChange = onPlaybackStateChange;
  }

  private ensureAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: this.sampleRate });
      this.gainNode = null;
      this.compressorNode = null;
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  /**
   * Initializes and maintains the output audio processing chain:
   * Voice model PCM -> BufferSource -> GainNode (1.8x) -> DynamicsCompressor (anti-clipping limiter) -> Destination
   */
  private ensureAudioNodes(): { ctx: AudioContext; gainNode: GainNode } {
    const ctx = this.ensureAudioContext();

    if (!this.gainNode || !this.compressorNode) {
      // 1. Calibrated GainNode for audible, punchy assistant speech
      this.gainNode = ctx.createGain();
      this.gainNode.gain.setValueAtTime(ASSISTANT_OUTPUT_GAIN, ctx.currentTime);

      // 2. High-fidelity transparent brickwall limiter to strictly prevent clipping or distortion
      this.compressorNode = ctx.createDynamicsCompressor();
      this.compressorNode.threshold.setValueAtTime(-1.5, ctx.currentTime); // Soft ceiling
      this.compressorNode.knee.setValueAtTime(6, ctx.currentTime);        // Musical smooth transition
      this.compressorNode.ratio.setValueAtTime(12, ctx.currentTime);       // Fast limiter ratio
      this.compressorNode.attack.setValueAtTime(0.002, ctx.currentTime);   // 2ms fast attack to catch syllable peaks
      this.compressorNode.release.setValueAtTime(0.12, ctx.currentTime);   // 120ms natural vocal decay

      // Connect: gainNode -> limiter compressor -> speakers (ctx.destination)
      this.gainNode.connect(this.compressorNode);
      this.compressorNode.connect(ctx.destination);
    }

    return { ctx, gainNode: this.gainNode };
  }

  /**
   * Progressive chunk playback: decodes base64 raw 16-bit PCM and schedules gaplessly
   */
  public playChunk(base64Pcm: string) {
    try {
      const { ctx, gainNode } = this.ensureAudioNodes();

      // Decode base64 to 16-bit linear PCM
      const binary = atob(base64Pcm);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      if (int16Array.length === 0) return;

      // Create AudioBuffer at 24kHz
      const audioBuffer = ctx.createBuffer(1, int16Array.length, this.sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }

      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = audioBuffer;

      // Route through GainNode & DynamicsCompressor limiter
      sourceNode.connect(gainNode);

      const currentTime = ctx.currentTime;
      // Schedule gaplessly; if we've fallen behind current time, catch up
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.015; // 15ms safety lead
      }

      sourceNode.start(this.nextStartTime);
      this.activeSources.add(sourceNode);

      this.nextStartTime += audioBuffer.duration;

      if (!this.isPlaying) {
        this.isPlaying = true;
        this.onPlaybackStateChange?.(true);
      }

      sourceNode.onended = () => {
        this.activeSources.delete(sourceNode);
        this.scheduleEndCheck();
      };
    } catch (err) {
      console.warn('[AURA AudioPlayer] Error playing audio chunk:', err);
    }
  }

  /**
   * Dedicated full speech utterance playback with completion callback
   */
  public playPcmAudio(base64Pcm: string, onComplete?: () => void) {
    this.stopAll();
    this.onTurnEndCallback = onComplete || null;
    this.playChunk(base64Pcm);
  }

  private scheduleEndCheck() {
    if (this.checkEndTimeout) {
      clearTimeout(this.checkEndTimeout);
    }

    this.checkEndTimeout = setTimeout(() => {
      if (this.activeSources.size === 0 && this.isPlaying) {
        this.isPlaying = false;
        this.nextStartTime = 0;
        this.onPlaybackStateChange?.(false);
        if (this.onTurnEndCallback) {
          const cb = this.onTurnEndCallback;
          this.onTurnEndCallback = null;
          cb();
        }
      }
    }, 60);
  }

  /**
   * Barge-in interruption: Instantaneously cut off all current and scheduled audio
   */
  public stopAll() {
    if (this.checkEndTimeout) {
      clearTimeout(this.checkEndTimeout);
      this.checkEndTimeout = null;
    }

    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources.clear();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.nextStartTime = this.audioContext.currentTime;
    } else {
      this.nextStartTime = 0;
    }

    if (this.isPlaying) {
      this.isPlaying = false;
      this.onPlaybackStateChange?.(false);
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public close() {
    this.stopAll();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
  }
}

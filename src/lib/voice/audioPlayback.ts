/**
 * Audio progressive playback for Gemini Live API
 * Plays 24,000 Hz raw 16-bit linear PCM with jitter-free timeline scheduling
 * and instantaneous interruption support (barge-in cutoff).
 */

export class LiveAudioPlayer {
  private audioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private sampleRate = 24000;
  private isPlaying = false;
  private checkEndTimeout: any = null;
  private onPlaybackStateChange?: (isPlaying: boolean) => void;

  constructor(onPlaybackStateChange?: (isPlaying: boolean) => void) {
    this.onPlaybackStateChange = onPlaybackStateChange;
  }

  private ensureAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: this.sampleRate });
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * Progressive chunk playback: decodes base64 raw 16-bit PCM and schedules gaplessly
   */
  public playChunk(base64Pcm: string) {
    try {
      const ctx = this.ensureAudioContext();

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
      sourceNode.connect(ctx.destination);

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

  private scheduleEndCheck() {
    if (this.checkEndTimeout) {
      clearTimeout(this.checkEndTimeout);
    }

    this.checkEndTimeout = setTimeout(() => {
      if (this.activeSources.size === 0 && this.isPlaying) {
        this.isPlaying = false;
        this.nextStartTime = 0;
        this.onPlaybackStateChange?.(false);
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

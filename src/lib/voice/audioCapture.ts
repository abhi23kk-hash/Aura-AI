/**
 * Audio capture and real-time DSP preprocessing for Gemini Live API
 * 
 * Features:
 * - Hardware & browser-level echo cancellation and noise suppression
 * - Multi-stage DSP filtering:
 *   - 85Hz High-pass filter: removes fan rumble, AC hum, desk vibration
 *   - 2.2kHz Presence filter: enhances speech formant intelligibility
 *   - 7.5kHz Low-pass filter: strips high-frequency static and electronic hiss
 *   - Dynamics compressor: balances quiet and loud speech without clipping or distortion
 * - Adaptive Noise Floor Tracking & Intelligent Voice Activity Detection (VAD)
 * - Hangover timing to protect natural conversational pauses from being cut off
 * - Acoustic isolation sink: prevents microphone audio from bleeding into output speakers
 * - Streams 16-bit linear PCM at 16,000 Hz in small low-latency chunks
 */

export interface AudioCaptureCallbacks {
  onAudioChunk: (base64Pcm: string) => void;
  onAudioLevel: (level: number) => void;
  onUserVoiceDetected?: () => void;
}

export class LiveAudioCapture {
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private clarityFilter: BiquadFilterNode | null = null;
  private antiHissFilter: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private silentSinkNode: GainNode | null = null;

  private isCapturing = false;
  private isSpeaking = false; // Whether the assistant is currently speaking (for client barge-in detection)
  private callbacks: AudioCaptureCallbacks | null = null;
  private sampleRate = 16000;
  private targetChunkSamples = 512; // ~32ms at 16kHz
  private pcmBuffer: Int16Array = new Int16Array(512);
  private pcmBufferOffset = 0;

  // Adaptive VAD & Noise Gate State
  private ambientNoiseFloor = 0.015;
  private isVoiceDetected = false;
  private hangoverFrames = 0;
  private readonly HANGOVER_FRAMES_TOTAL = 35; // ~750ms-900ms protection for mid-sentence pauses
  private currentExpansionGain = 1.0;

  public setAssistantSpeaking(speaking: boolean) {
    this.isSpeaking = speaking;
  }

  public start(stream: MediaStream, callbacks: AudioCaptureCallbacks) {
    if (this.isCapturing) {
      this.stop();
    }

    this.callbacks = callbacks;
    this.isCapturing = true;
    this.ambientNoiseFloor = 0.015;
    this.isVoiceDetected = false;
    this.hangoverFrames = 0;
    this.currentExpansionGain = 1.0;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: this.sampleRate });

      this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);

      // Stage 1: 85 Hz High-pass filter to eliminate fan rumble, HVAC hum, and physical vibrations
      this.highPassFilter = this.audioContext.createBiquadFilter();
      this.highPassFilter.type = 'highpass';
      this.highPassFilter.frequency.value = 85;
      this.highPassFilter.Q.value = 0.707;

      // Stage 2: 2.2 kHz Vocal clarity peaking filter to focus speech intelligibility
      this.clarityFilter = this.audioContext.createBiquadFilter();
      this.clarityFilter.type = 'peaking';
      this.clarityFilter.frequency.value = 2200;
      this.clarityFilter.Q.value = 0.9;
      this.clarityFilter.gain.value = 1.5;

      // Stage 3: 7.5 kHz Anti-hiss filter to eliminate high-frequency static and prevent aliasing
      this.antiHissFilter = this.audioContext.createBiquadFilter();
      this.antiHissFilter.type = 'lowpass';
      this.antiHissFilter.frequency.value = 7500;
      this.antiHissFilter.Q.value = 0.707;

      // Stage 4: Hardware dynamics compressor for voice leveling (smooths quiet and loud speech)
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.compressorNode.threshold.value = -24; // dB
      this.compressorNode.knee.value = 12; // dB soft knee
      this.compressorNode.ratio.value = 3.5;
      this.compressorNode.attack.value = 0.003; // 3ms fast transient response
      this.compressorNode.release.value = 0.12; // 120ms smooth natural release

      // Stage 5: Spectrum analyser for visual levels
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.25;

      // Stage 6: Script processor for adaptive DSP and 16kHz PCM chunking
      const bufferSize = 1024;
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      // Stage 7: Silent sink node to prevent any mic audio from looping into speaker output
      this.silentSinkNode = this.audioContext.createGain();
      this.silentSinkNode.gain.value = 0;

      // Connect DSP audio graph
      this.mediaStreamSource.connect(this.highPassFilter);
      this.highPassFilter.connect(this.clarityFilter);
      this.clarityFilter.connect(this.antiHissFilter);
      this.antiHissFilter.connect(this.compressorNode);
      this.compressorNode.connect(this.analyserNode);
      this.analyserNode.connect(this.processorNode);
      this.processorNode.connect(this.silentSinkNode);
      this.silentSinkNode.connect(this.audioContext.destination);

      const actualSampleRate = this.audioContext.sampleRate;
      this.pcmBufferOffset = 0;

      this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.isCapturing) return;

        const inputChannelData = e.inputBuffer.getChannelData(0);
        const bufferLength = inputChannelData.length;

        // 1. Calculate buffer RMS energy
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const sample = inputChannelData[i];
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / bufferLength);

        // 2. Adaptive ambient noise floor tracking
        // Quickly tracks down when room is quieter, slowly tracks up so speech is not tracked as noise
        if (rms < this.ambientNoiseFloor) {
          this.ambientNoiseFloor = this.ambientNoiseFloor * 0.90 + rms * 0.10;
        } else {
          this.ambientNoiseFloor = this.ambientNoiseFloor * 0.998 + rms * 0.002;
        }
        this.ambientNoiseFloor = Math.max(0.002, Math.min(0.07, this.ambientNoiseFloor));

        // 3. Voice Activity Detection with noise-relative threshold & hangover
        const speechThreshold = Math.max(this.ambientNoiseFloor * 2.2 + 0.006, 0.016);
        if (rms >= speechThreshold) {
          this.isVoiceDetected = true;
          // Generous hangover window ensures natural pauses between words are never cut off
          this.hangoverFrames = this.HANGOVER_FRAMES_TOTAL;
        } else if (this.hangoverFrames > 0) {
          this.hangoverFrames--;
          this.isVoiceDetected = true;
        } else {
          this.isVoiceDetected = false;
        }

        // 4. Update visualizer level (clean representation of user voice)
        const displayLevel = this.isVoiceDetected
          ? Math.min(1, rms * 4.2)
          : Math.min(0.15, rms * 1.5);
        this.callbacks?.onAudioLevel(displayLevel);

        // 5. Barge-in detection: Only triggers when user speaks clearly above the ambient noise
        if (this.isSpeaking && this.isVoiceDetected && rms > (this.ambientNoiseFloor * 2.5 + 0.025)) {
          this.callbacks?.onUserVoiceDetected?.();
        }

        // 6. Smooth downward noise expander: softens pure background noise while keeping speech 100% natural
        const targetExpansionGain = this.isVoiceDetected ? 1.0 : 0.18;
        const processedAudio = new Float32Array(bufferLength);
        for (let i = 0; i < bufferLength; i++) {
          this.currentExpansionGain += (targetExpansionGain - this.currentExpansionGain) * 0.02;
          processedAudio[i] = inputChannelData[i] * this.currentExpansionGain;
        }

        // 7. Resample to 16,000 Hz if actualSampleRate differs from target
        const resampled = this.resampleAudio(processedAudio, actualSampleRate, this.sampleRate);

        // 8. Convert float [-1.0, 1.0] to 16-bit signed PCM
        for (let i = 0; i < resampled.length; i++) {
          const s = Math.max(-1, Math.min(1, resampled[i]));
          const pcmVal = s < 0 ? s * 0x8000 : s * 0x7fff;
          this.pcmBuffer[this.pcmBufferOffset++] = pcmVal;

          if (this.pcmBufferOffset >= this.targetChunkSamples) {
            const base64Chunk = this.int16ToBase64(this.pcmBuffer);
            this.callbacks?.onAudioChunk(base64Chunk);
            this.pcmBufferOffset = 0;
          }
        }
      };
    } catch (err) {
      console.error('[AURA AudioCapture] Error starting audio capture:', err);
      this.stop();
    }
  }

  public stop() {
    this.isCapturing = false;
    this.pcmBufferOffset = 0;

    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
        this.processorNode.onaudioprocess = null;
      } catch {}
      this.processorNode = null;
    }

    if (this.silentSinkNode) {
      try {
        this.silentSinkNode.disconnect();
      } catch {}
      this.silentSinkNode = null;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {}
      this.analyserNode = null;
    }

    if (this.compressorNode) {
      try {
        this.compressorNode.disconnect();
      } catch {}
      this.compressorNode = null;
    }

    if (this.antiHissFilter) {
      try {
        this.antiHissFilter.disconnect();
      } catch {}
      this.antiHissFilter = null;
    }

    if (this.clarityFilter) {
      try {
        this.clarityFilter.disconnect();
      } catch {}
      this.clarityFilter = null;
    }

    if (this.highPassFilter) {
      try {
        this.highPassFilter.disconnect();
      } catch {}
      this.highPassFilter = null;
    }

    if (this.mediaStreamSource) {
      try {
        this.mediaStreamSource.disconnect();
      } catch {}
      this.mediaStreamSource = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    this.callbacks?.onAudioLevel(0);
  }

  private resampleAudio(input: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return input;
    const ratio = fromRate / toRate;
    const newLength = Math.round(input.length / ratio);
    const output = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIdx = i * ratio;
      const index = Math.floor(srcIdx);
      const frac = srcIdx - index;
      const nextIndex = Math.min(index + 1, input.length - 1);
      output[i] = input[index] * (1 - frac) + input[nextIndex] * frac;
    }
    return output;
  }

  private int16ToBase64(int16Arr: Int16Array): string {
    const uint8Arr = new Uint8Array(int16Arr.buffer, int16Arr.byteOffset, int16Arr.byteLength);
    let binary = '';
    const len = uint8Arr.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Arr[i]);
    }
    return btoa(binary);
  }
}

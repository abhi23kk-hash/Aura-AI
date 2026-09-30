/**
 * Real-time bidirectional voice session coordinator using Gemini Live API
 */

import { LiveAudioCapture } from './audioCapture.js';
import { LiveAudioPlayer } from './audioPlayback.js';
import {
  acquireMicrophoneStream,
  isStreamActive,
  getActiveMediaStream,
  releaseMicrophoneStream,
} from './permissions.js';
import { AssistantState } from '../../types.js';

export interface LiveSessionHandlers {
  onStateChange: (state: AssistantState) => void;
  onAudioLevel: (level: number) => void;
  onTranscript: (text: string, role: 'assistant' | 'user') => void;
  onToolCall?: (name: string, args: any) => void;
  onError?: (message: string) => void;
}

export class LiveSessionManager {
  private ws: WebSocket | null = null;
  private audioCapture: LiveAudioCapture;
  private audioPlayer: LiveAudioPlayer;
  private handlers: LiveSessionHandlers;
  private currentState: AssistantState = 'IDLE';
  private isActive = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimer: any = null;

  constructor(handlers: LiveSessionHandlers) {
    this.handlers = handlers;

    this.audioPlayer = new LiveAudioPlayer((isPlaying) => {
      this.audioCapture.setAssistantSpeaking(isPlaying);
      if (isPlaying) {
        this.updateState('SPEAKING');
      } else if (this.isActive && this.currentState === 'SPEAKING') {
        this.updateState('LISTENING');
      }
    });

    this.audioCapture = new LiveAudioCapture();
  }

  private updateState(newState: AssistantState) {
    if (this.currentState === newState) return;
    this.currentState = newState;
    this.handlers.onStateChange(newState);
  }

  public getState(): AssistantState {
    return this.currentState;
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * Activates the assistant session:
   * Requests mic permission on first use (browser prompt), or immediately reuses granted permission.
   */
  public async start(): Promise<boolean> {
    if (this.isActive && this.ws && this.ws.readyState === WebSocket.OPEN) {
      return true;
    }

    this.isActive = true;
    this.updateState('CONNECTING');

    // 1. Acquire microphone stream (reuses permission if already granted)
    const micResult = await acquireMicrophoneStream();
    if (!micResult.stream) {
      this.isActive = false;
      this.updateState('ERROR');
      this.handlers.onError?.(
        micResult.error || 'Microphone access is required to use the voice assistant.'
      );
      return false;
    }

    const stream = micResult.stream;

    // 2. Open WebSocket connection to server Live relay
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/live-assistant`;

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err: any) {
      console.error('[AURA LiveSession] Failed to initialize WebSocket:', err);
      this.isActive = false;
      this.updateState('ERROR');
      this.handlers.onError?.('Unable to establish voice connection. Please try again.');
      return false;
    }

    this.ws.onopen = () => {
      console.log('[AURA LiveSession] WebSocket connected to Live relay');
      this.reconnectAttempts = 0;

      // Start audio capture and streaming to Gemini Live
      this.audioCapture.start(stream, {
        onAudioChunk: (base64Chunk) => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(
              JSON.stringify({
                type: 'realtime_audio',
                audio: base64Chunk,
              })
            );
          }
        },
        onAudioLevel: (level) => {
          this.handlers.onAudioLevel(level);
        },
        onUserVoiceDetected: () => {
          // Client-side instant barge-in detection
          this.interrupt();
        },
      });

      this.updateState('LISTENING');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Server confirmed connection
        if (msg.type === 'connected') {
          this.updateState('LISTENING');
        }

        // Server/Gemini Live detected user barge-in interruption
        if (msg.type === 'interrupted') {
          this.handleInterruption();
        }

        // Native 24kHz audio chunk from Gemini Live
        if (msg.type === 'audio' && msg.audio) {
          this.audioPlayer.playChunk(msg.audio);
        }

        // Live transcription / model turn text
        if (msg.type === 'transcript' && msg.text) {
          this.handlers.onTranscript(msg.text, msg.role || 'assistant');
        }

        // Tool call from Gemini Live
        if (msg.type === 'tool_call' && msg.name) {
          this.handlers.onToolCall?.(msg.name, msg.args);
        }

        // Turn complete
        if (msg.type === 'turn_complete') {
          // Audio player onended will automatically return to LISTENING once buffered chunks complete
        }

        if (msg.type === 'error') {
          console.warn('[AURA LiveSession] Server notice:', msg.message);
        }
      } catch (err) {
        console.warn('[AURA LiveSession] Error parsing message:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.warn('[AURA LiveSession] WebSocket connection error:', err);
    };

    this.ws.onclose = () => {
      console.log('[AURA LiveSession] WebSocket connection closed');
      this.audioCapture.stop();
      this.audioPlayer.stopAll();

      if (this.isActive) {
        // Attempt reconnection if session wasn't manually stopped
        this.attemptReconnect();
      } else {
        this.updateState('IDLE');
      }
    };

    return true;
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.isActive = false;
      this.updateState('IDLE');
      return;
    }

    this.reconnectAttempts++;
    this.updateState('CONNECTING');

    this.reconnectTimer = setTimeout(() => {
      if (this.isActive) {
        this.start();
      }
    }, 1500);
  }

  /**
   * Barge-in interruption: Immediately cuts off playback and resets back to listening
   */
  public interrupt() {
    if (this.audioPlayer.getIsPlaying() || this.currentState === 'SPEAKING') {
      console.log('[AURA LiveSession] Interruption triggered!');
      this.audioPlayer.stopAll();

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'interrupt' }));
      }

      this.handleInterruption();
    }
  }

  private handleInterruption() {
    this.audioPlayer.stopAll();
    this.updateState('INTERRUPTED');

    // Smooth instantaneous switch back to LISTENING
    setTimeout(() => {
      if (this.isActive) {
        this.updateState('LISTENING');
      }
    }, 80);
  }

  /**
   * Sends a typed text query through the live session
   */
  public sendTextMessage(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.updateState('PROCESSING');
      this.ws.send(
        JSON.stringify({
          type: 'text',
          text,
        })
      );
    }
  }

  /**
   * Pauses the active listening session without discarding permissions
   */
  public pause() {
    this.isActive = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.audioCapture.stop();
    this.audioPlayer.stopAll();

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.updateState('IDLE');
  }

  /**
   * Completely stops and disposes of audio resources
   */
  public stop() {
    this.pause();
    releaseMicrophoneStream();
  }
}

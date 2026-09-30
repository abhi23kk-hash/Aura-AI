import { useState, useEffect, useRef, useCallback } from 'react';
import { AssistantState, UserSettings } from '../types.js';
import { playAssistantChime } from '../utils/assistantAudio.js';
import { prepareTextForSpeech } from '../utils/speechSanitizer.js';
import { LiveSessionManager } from '../lib/voice/liveSession.js';
import { LiveAudioPlayer } from '../lib/voice/audioPlayback.js';
import {
  queryMicrophonePermission,
  getCachedPermissionStatus,
  releaseMicrophoneStream,
} from '../lib/voice/permissions.js';

interface UseVoiceEngineProps {
  settings: UserSettings;
  onUserSpeechFinal: (transcript: string) => void;
  onUserInterrupted?: () => void;
  onToolCall?: (name: string, args: any) => void;
  onAssistantTranscript?: (text: string) => void;
  isHandsFreeActive: boolean;
}

export function useVoiceEngine({
  settings,
  onUserSpeechFinal,
  onUserInterrupted,
  onToolCall,
  onAssistantTranscript,
  isHandsFreeActive,
}: UseVoiceEngineProps) {
  const [state, setState] = useState<AssistantState>('IDLE');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isMicAvailable, setIsMicAvailable] = useState<boolean>(true);
  const [micPermissionDenied, setMicPermissionDenied] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isNoiseFilterActive, setIsNoiseFilterActive] = useState<boolean>(true);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const onUserInterruptedRef = useRef(onUserInterrupted);
  const onToolCallRef = useRef(onToolCall);
  const onAssistantTranscriptRef = useRef(onAssistantTranscript);
  const onUserSpeechFinalRef = useRef(onUserSpeechFinal);
  const standaloneAudioPlayerRef = useRef<LiveAudioPlayer | null>(null);

  useEffect(() => {
    onUserInterruptedRef.current = onUserInterrupted;
    onToolCallRef.current = onToolCall;
    onAssistantTranscriptRef.current = onAssistantTranscript;
    onUserSpeechFinalRef.current = onUserSpeechFinal;
  });

  // Ensure standalone audio player is cleaned up on unmount
  useEffect(() => {
    return () => {
      if (standaloneAudioPlayerRef.current) {
        standaloneAudioPlayerRef.current.close();
        standaloneAudioPlayerRef.current = null;
      }
    };
  }, []);

  // 1. Proactively detect existing browser microphone permission state without triggering prompt
  useEffect(() => {
    queryMicrophonePermission()
      .then((status) => {
        if (status === 'granted') {
          setMicPermissionDenied(false);
        } else if (status === 'denied') {
          setMicPermissionDenied(true);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Initialize the Live Session Manager
  useEffect(() => {
    const liveSession = new LiveSessionManager({
      onStateChange: (newState) => {
        setState(newState);
        if (newState === 'INTERRUPTED') {
          onUserInterruptedRef.current?.();
        }
      },
      onAudioLevel: (level) => {
        setAudioLevel(level);
      },
      onTranscript: (text, role) => {
        if (role === 'assistant') {
          setInterimTranscript(text);
          onAssistantTranscriptRef.current?.(text);
        } else {
          setInterimTranscript(text);
          onUserSpeechFinalRef.current?.(text);
        }
      },
      onToolCall: (name, args) => {
        console.log('[AURA Engine] Executing tool call:', name, args);
        onToolCallRef.current?.(name, args);
      },
      onError: (errMsg) => {
        console.warn('[AURA Engine] Live session message:', errMsg);
        if (errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('blocked')) {
          setMicPermissionDenied(true);
        }
      },
    });

    liveSessionRef.current = liveSession;

    return () => {
      liveSession.stop();
      liveSessionRef.current = null;
    };
  }, []);

  // 3. Start Listening: requests permission once on first use, reuses granted permission subsequently
  const startListening = useCallback(async () => {
    setIsMuted(false);
    playAssistantChime('wake');

    if (!liveSessionRef.current) return;

    try {
      const success = await liveSessionRef.current.start();
      if (success) {
        setMicPermissionDenied(false);
      } else {
        const cached = getCachedPermissionStatus();
        if (cached === 'denied') {
          setMicPermissionDenied(true);
        }
      }
    } catch (err: any) {
      console.warn('[AURA Engine] Start listening error:', err);
      setState('ERROR');
    }
  }, []);

  // 4. Stop / Pause Listening
  const stopListening = useCallback(() => {
    setIsMuted(true);
    playAssistantChime('stop');
    if (liveSessionRef.current) {
      liveSessionRef.current.pause();
    }
    if (standaloneAudioPlayerRef.current) {
      standaloneAudioPlayerRef.current.stopAll();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setState('IDLE');
    setAudioLevel(0);
  }, []);

  // 5. Interrupt Speaking (Barge-in cutoff)
  const interruptSpeaking = useCallback(() => {
    playAssistantChime('stop');
    if (liveSessionRef.current) {
      liveSessionRef.current.interrupt();
    }
    if (standaloneAudioPlayerRef.current) {
      standaloneAudioPlayerRef.current.stopAll();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    onUserInterruptedRef.current?.();
  }, []);

  // 6. Speak: Used for greetings or synthetic speech with GainNode boosting
  const speak = useCallback(
    async (text: string, _lang?: string, onComplete?: () => void) => {
      // Dedicated Speech Sanitization Layer
      // Separates visual rich Markdown/formatting from voice speech synthesis
      const speechText = prepareTextForSpeech(text);
      if (!speechText.trim()) {
        onComplete?.();
        return;
      }

      // 1. Primary path: Streamlined Gemini model voice audio through Web Audio GainNode & Limiter
      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: speechText,
            voiceName: settings.voiceName || 'Kore',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.audio) {
            if (!standaloneAudioPlayerRef.current) {
              standaloneAudioPlayerRef.current = new LiveAudioPlayer();
            }
            setState('SPEAKING');
            standaloneAudioPlayerRef.current.playPcmAudio(data.audio, () => {
              onComplete?.();
              if (liveSessionRef.current?.getIsActive()) {
                setState('LISTENING');
              } else {
                setState('IDLE');
              }
            });
            return;
          }
        }
      } catch (ttsErr) {
        console.debug('[AURA Voice] TTS notice, using browser speech engine:', ttsErr);
      }

      // 2. High-reliability fallback: Browser SpeechSynthesis with maximum audio volume
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.rate = settings.voiceSpeed || 1.05;
        utterance.volume = 1.0; // Full 100% device signal output

        // Set natural voice language when specified
        if (_lang) {
          const langMap: Record<string, string> = {
            te: 'te-IN',
            hi: 'hi-IN',
            ta: 'ta-IN',
            kn: 'kn-IN',
            ml: 'ml-IN',
            mr: 'mr-IN',
            bn: 'bn-IN',
            en: 'en-US',
          };
          utterance.lang = langMap[_lang] || (_lang.includes('-') ? _lang : `${_lang}-IN`);
        }

        utterance.onstart = () => {
          setState('SPEAKING');
        };

        utterance.onend = () => {
          onComplete?.();
          if (liveSessionRef.current?.getIsActive()) {
            setState('LISTENING');
          } else {
            setState('IDLE');
          }
        };

        utterance.onerror = () => {
          onComplete?.();
          setState('IDLE');
        };

        window.speechSynthesis.speak(utterance);
      } else {
        onComplete?.();
      }
    },
    [settings.voiceSpeed, settings.voiceName]
  );

  // 7. Send typed text through the live session
  const sendTextMessage = useCallback((text: string) => {
    if (liveSessionRef.current && liveSessionRef.current.getIsActive()) {
      liveSessionRef.current.sendTextMessage(text);
    }
  }, []);

  const toggleNoiseFilter = useCallback(() => {
    setIsNoiseFilterActive((prev) => !prev);
  }, []);

  return {
    state,
    setState,
    audioLevel,
    interimTranscript,
    finalTranscript: '',
    isMuted,
    isMicAvailable,
    micPermissionDenied,
    isNoiseFilterActive,
    startListening,
    stopListening,
    interruptSpeaking,
    speak,
    sendTextMessage,
    toggleNoiseFilter,
  };
}

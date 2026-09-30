/**
 * Microphone permission detection and lifecycle management
 * Respects browser security boundaries while ensuring zero redundant prompts
 */

export type MicPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

let cachedPermissionStatus: MicPermissionStatus = 'unknown';
let activeStream: MediaStream | null = null;

/**
 * Proactively inspects microphone permission state without triggering a browser prompt
 */
export async function queryMicrophonePermission(): Promise<MicPermissionStatus> {
  if (typeof navigator === 'undefined') return 'unknown';

  if (cachedPermissionStatus === 'granted' && isStreamActive(activeStream)) {
    return 'granted';
  }

  try {
    if (navigator.permissions && navigator.permissions.query) {
      const status = await (navigator.permissions.query as any)({ name: 'microphone' });
      cachedPermissionStatus = status.state as MicPermissionStatus;

      status.onchange = () => {
        cachedPermissionStatus = status.state as MicPermissionStatus;
      };

      return cachedPermissionStatus;
    }
  } catch {
    // navigator.permissions.query for 'microphone' might throw in some browser versions
  }

  return cachedPermissionStatus;
}

export function getCachedPermissionStatus(): MicPermissionStatus {
  return cachedPermissionStatus;
}

export function isStreamActive(stream: MediaStream | null): boolean {
  if (!stream) return false;
  const tracks = stream.getAudioTracks();
  return tracks.length > 0 && tracks.some(t => t.readyState === 'live' && t.enabled);
}

export function getActiveMediaStream(): MediaStream | null {
  if (isStreamActive(activeStream)) {
    return activeStream;
  }
  return null;
}

/**
 * Requests microphone access through standard browser prompt on initial activation,
 * or immediately reuses the granted permission on subsequent activations.
 */
export async function acquireMicrophoneStream(): Promise<{
  stream: MediaStream | null;
  status: MicPermissionStatus;
  error?: string;
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return {
      stream: null,
      status: 'denied',
      error: 'Audio input is not supported in this browser environment.',
    };
  }

  // Reuse existing live stream if already available
  if (isStreamActive(activeStream)) {
    cachedPermissionStatus = 'granted';
    return {
      stream: activeStream,
      status: 'granted',
    };
  }

  try {
    let stream: MediaStream;
    try {
      // 1. Try advanced audio constraints for modern browsers (echoCancellation, noiseSuppression, autoGainControl, mono)
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 16000 },
          // Browser-specific audio enhancements when available
          ...(typeof (window as any).chrome !== 'undefined'
            ? {
                googEchoCancellation: { ideal: true },
                googAutoGainControl: { ideal: true },
                googNoiseSuppression: { ideal: true },
                googHighpassFilter: { ideal: true },
                googTypingNoiseDetection: { ideal: true },
              }
            : {}),
        } as any,
      });
    } catch (constraintErr) {
      console.warn('[AURA Permissions] Advanced audio constraints fallback:', constraintErr);
      // 2. Standard fallback constraints supported universally across all browsers
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (fallbackErr) {
        // 3. Basic audio permission fallback
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    }

    activeStream = stream;
    cachedPermissionStatus = 'granted';

    return {
      stream,
      status: 'granted',
    };
  } catch (err: any) {
    console.warn('[AURA Permissions] Microphone access response:', err?.name || err);
    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      cachedPermissionStatus = 'denied';
      return {
        stream: null,
        status: 'denied',
        error: 'Microphone permission blocked. Click the address bar icon to allow microphone access, then tap to retry.',
      };
    }

    if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
      cachedPermissionStatus = 'denied';
      return {
        stream: null,
        status: 'denied',
        error: 'No microphone was detected on your device. Please plug in a microphone and retry.',
      };
    }

    return {
      stream: null,
      status: 'denied',
      error: 'Unable to access microphone. Please check your system settings and retry.',
    };
  }
}

/**
 * Releases microphone tracks when user completely stops or leaves the session
 */
export function releaseMicrophoneStream() {
  if (activeStream) {
    activeStream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
    });
    activeStream = null;
  }
}

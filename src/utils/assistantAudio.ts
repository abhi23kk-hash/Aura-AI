// Web Audio Sound Synthesizer for AURA Voice Assistant
// Generates clear harmonic tones without external media files

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export type AssistantChimeType = 'wake' | 'complete' | 'stop' | 'timer_alert';

export function playAssistantChime(type: AssistantChimeType = 'wake') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'wake') {
      // Pleasant bright chord (587.33 Hz -> 880 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.2, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.08);
      gain2.gain.setValueAtTime(0.001, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.24, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.38);

    } else if (type === 'complete') {
      // Soft gentle completion tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880.0, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.30);

    } else if (type === 'stop') {
      // Subtle muted tick
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);

    } else if (type === 'timer_alert') {
      // Cheerful repeating alert for completed study timer
      [0, 0.22, 0.44].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(783.99, now + delay);
        gain.gain.setValueAtTime(0.001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.22, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.20);
      });
    }
  } catch (e) {
    console.debug('Assistant sound synthesizer notice:', e);
  }
}

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Volume2, Sparkles, AlertCircle, Radio } from 'lucide-react';
import { AssistantState } from '../../types.js';

interface AssistantOrbProps {
  state: AssistantState;
  audioLevel: number; // 0 to 1
  onClick?: () => void;
  statusText?: string;
  isMicMuted?: boolean;
}

export const AssistantOrb: React.FC<AssistantOrbProps> = ({
  state,
  audioLevel,
  onClick,
  statusText,
  isMicMuted = false,
}) => {
  // State colors and visual glow
  const getStateGlow = () => {
    switch (state) {
      case 'LISTENING':
        return 'from-cyan-400 via-sky-500 to-blue-600 shadow-[0_0_80px_rgba(56,189,248,0.7)]';
      case 'PROCESSING':
        return 'from-violet-400 via-purple-500 to-indigo-600 shadow-[0_0_75px_rgba(168,85,247,0.7)]';
      case 'SPEAKING':
        return 'from-teal-300 via-emerald-400 to-cyan-500 shadow-[0_0_85px_rgba(52,211,153,0.75)]';
      case 'INTERRUPTED':
        return 'from-amber-300 via-cyan-400 to-blue-500 shadow-[0_0_90px_rgba(251,191,36,0.85)]';
      case 'ERROR':
        return 'from-rose-500 via-red-600 to-amber-500 shadow-[0_0_65px_rgba(244,63,94,0.65)]';
      case 'GREETING':
        return 'from-sky-300 via-indigo-400 to-cyan-400 shadow-[0_0_70px_rgba(99,102,241,0.65)]';
      case 'CONNECTING':
        return 'from-cyan-300 via-teal-400 to-indigo-500 animate-pulse shadow-[0_0_70px_rgba(34,211,238,0.6)]';
      case 'IDLE':
      default:
        return 'from-cyan-500 via-blue-600 to-indigo-700 shadow-[0_0_55px_rgba(56,189,248,0.45)]';
    }
  };

  const getStatusLabel = () => {
    if (statusText) return statusText;
    switch (state) {
      case 'GREETING':
        return 'Greeting you...';
      case 'CONNECTING':
        return 'Connecting live voice session...';
      case 'LISTENING':
        return 'Listening naturally... Speak anytime.';
      case 'PROCESSING':
        return 'AURA is thinking and reasoning...';
      case 'SPEAKING':
        return 'AURA is speaking. Speak or tap to interrupt.';
      case 'INTERRUPTED':
        return 'Interrupted! Listening to your question...';
      case 'ERROR':
        return 'Microphone permission blocked. Click the address bar icon to allow access, then tap here to retry.';
      case 'IDLE':
      default:
        return isMicMuted ? 'Microphone paused. Tap to speak.' : 'Ready. Tap to talk or speak naturally.';
    }
  };

  // Dynamic scale based on voice loudness
  const dynamicScale = state === 'LISTENING' 
    ? 1 + Math.min(0.35, audioLevel * 0.45)
    : state === 'SPEAKING'
    ? 1 + Math.min(0.25, audioLevel * 0.3)
    : 1;

  return (
    <div className="flex flex-col items-center justify-center select-none py-4 sm:py-6">
      {/* Orb Stage */}
      <div 
        id="aura-orb-container"
        onClick={onClick}
        title={state === 'SPEAKING' ? 'Tap to interrupt' : state === 'LISTENING' ? 'Tap to mute' : 'Tap to start talking'}
        className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center cursor-pointer group"
      >
        {/* Concentric Ambient Ripples */}
        <AnimatePresence>
          {(state === 'LISTENING' || state === 'SPEAKING') && (
            <>
              <motion.div
                key="ripple-1"
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: 1.6 + audioLevel * 0.4, opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                className={`absolute inset-0 rounded-full border ${
                  state === 'LISTENING' ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-emerald-400/40 bg-emerald-500/10'
                }`}
              />
              <motion.div
                key="ripple-2"
                initial={{ scale: 0.8, opacity: 0.7 }}
                animate={{ scale: 2.1 + audioLevel * 0.5, opacity: 0 }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
                className={`absolute inset-0 rounded-full border ${
                  state === 'LISTENING' ? 'border-sky-400/30' : 'border-teal-400/30'
                }`}
              />
            </>
          )}
        </AnimatePresence>

        {/* Orbiting Quantum Rings (Processing / Thinking State) */}
        {state === 'PROCESSING' && (
          <>
            <div className="absolute inset-2 border-2 border-dashed border-purple-400/50 rounded-full animate-spin-slow pointer-events-none" />
            <div className="absolute inset-8 border border-cyan-400/40 rounded-full animate-spin-reverse pointer-events-none" />
          </>
        )}

        {/* Outer Halo Glow */}
        <div
          className={`absolute inset-4 rounded-full transition-all duration-700 blur-2xl opacity-65 group-hover:opacity-85 ${
            state === 'ERROR' ? 'bg-rose-600' : 'bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600'
          }`}
        />

        {/* Core Sphere */}
        <motion.div
          animate={{
            scale: dynamicScale,
            rotate: state === 'PROCESSING' ? 360 : 0,
          }}
          transition={{
            scale: { type: 'spring', stiffness: 320, damping: 22 },
            rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
          }}
          className={`relative w-44 h-44 sm:w-48 sm:h-48 rounded-full bg-gradient-to-br ${getStateGlow()} p-[3px] transition-colors duration-500 group-hover:scale-105`}
        >
          {/* Internal Holographic Texture & Caustic Mesh */}
          <div className="w-full h-full rounded-full bg-slate-950/85 backdrop-blur-md flex items-center justify-center overflow-hidden relative">
            {/* Ambient Nebula Light Inside */}
            <div className="absolute -top-10 -left-10 w-36 h-36 bg-cyan-400/30 rounded-full blur-xl" />
            <div className="absolute -bottom-10 -right-10 w-36 h-36 bg-indigo-500/30 rounded-full blur-xl" />
            
            {/* Center Visual Waveform / Icon */}
            <div className="relative z-10 flex flex-col items-center justify-center">
              {state === 'LISTENING' && (
                <div className="flex items-center gap-1.5 h-10">
                  {[0.4, 0.9, 0.6, 1.0, 0.7, 0.5].map((factor, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: Math.max(8, (audioLevel * 50 + 10) * factor) }}
                      transition={{ duration: 0.08 }}
                      className="w-1.5 bg-cyan-300 rounded-full shadow-[0_0_10px_#38bdf8]"
                    />
                  ))}
                </div>
              )}

              {state === 'SPEAKING' && (
                <div className="flex items-center gap-1.5 h-10">
                  {[0.5, 0.8, 1.2, 0.9, 1.1, 0.6].map((factor, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [12, Math.max(12, 38 * factor), 10] }}
                      transition={{ duration: 0.6 + i * 0.1, repeat: Infinity, repeatType: 'reverse' }}
                      className="w-1.5 bg-emerald-300 rounded-full shadow-[0_0_10px_#34d399]"
                    />
                  ))}
                </div>
              )}

              {state === 'PROCESSING' && (
                <Sparkles className="w-10 h-10 text-purple-300 animate-pulse" />
              )}

              {state === 'INTERRUPTED' && (
                <Radio className="w-10 h-10 text-amber-300 animate-ping" />
              )}

              {state === 'ERROR' && (
                <AlertCircle className="w-10 h-10 text-rose-400" />
              )}

              {(state === 'IDLE' || state === 'GREETING') && (
                <div className="relative group-hover:scale-110 transition-transform">
                  <div className="w-14 h-14 rounded-full border border-cyan-400/60 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.5)]">
                    <Mic className="w-6 h-6 text-cyan-300 animate-pulse" />
                  </div>
                </div>
              )}
            </div>

            {/* Subtle Glass Highlight */}
            <div className="absolute top-2 left-6 right-6 h-12 bg-gradient-to-b from-white/20 to-transparent rounded-t-full pointer-events-none" />
          </div>
        </motion.div>

        {/* Mic Status Action Badge */}
        <div 
          className={`absolute -bottom-2 bg-slate-900/95 border px-4 py-1.5 rounded-full text-xs font-mono flex items-center gap-2 shadow-xl backdrop-blur-md transition-all group-hover:scale-105 ${
            state === 'ERROR'
              ? 'border-rose-500/60 text-rose-300 bg-rose-950/80 animate-pulse'
              : isMicMuted 
              ? 'border-rose-500/50 text-rose-400' 
              : state === 'LISTENING'
              ? 'border-cyan-400/70 text-cyan-300 bg-cyan-950/60 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
              : state === 'SPEAKING'
              ? 'border-emerald-500/60 text-emerald-300 bg-emerald-950/60'
              : 'border-cyan-500/40 text-cyan-300 bg-slate-900/90 hover:border-cyan-400'
          }`}
        >
          {state === 'ERROR' ? (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Mic blocked - Tap to retry</span>
            </>
          ) : isMicMuted ? (
            <>
              <MicOff className="w-3.5 h-3.5 text-rose-400" />
              <span>Paused (Tap to talk)</span>
            </>
          ) : state === 'LISTENING' ? (
            <>
              <Mic className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Listening... (Tap to pause)</span>
            </>
          ) : state === 'SPEAKING' ? (
            <>
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Speaking (Tap to interrupt)</span>
            </>
          ) : state === 'PROCESSING' ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
              <span>Thinking...</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Tap to talk</span>
            </>
          )}
        </div>
      </div>

      {/* State Caption */}
      <div className="mt-5 text-center px-4 max-w-lg">
        <p className="text-base sm:text-lg font-medium tracking-wide text-slate-200">
          {getStatusLabel()}
        </p>
        {state === 'SPEAKING' && (
          <p className="text-xs text-emerald-300 mt-1 flex items-center justify-center gap-1.5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
            Barge-in active: Just talk to interrupt instantly
          </p>
        )}
        {state === 'LISTENING' && audioLevel > 0.05 && (
          <p className="text-xs text-cyan-300 mt-1 flex items-center justify-center gap-1.5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse inline-block" />
            Voice detected ({Math.round(audioLevel * 100)}% level)
          </p>
        )}
      </div>
    </div>
  );
};

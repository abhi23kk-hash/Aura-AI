import React from 'react';
import { 
  X, 
  Settings as SettingsIcon, 
  Volume2, 
  Mic, 
  Brain, 
  Globe, 
  ShieldCheck, 
  Sparkles,
  Zap,
  Info
} from 'lucide-react';
import { UserSettings } from '../../types.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  isDemoMode: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  isDemoMode,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel-glow rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-6 border border-slate-700 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Assistant & Voice Settings</h3>
              <p className="text-xs text-slate-400">Configure voice engine, interruption sensitivity, and memory</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo Mode Notice */}
        {isDemoMode && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-200">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300">Offline/Local Mode Active:</span>
              <p className="text-slate-300 mt-0.5">
                Operating using local conversational heuristics with fast instant responses.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {/* Section 1: Voice & Speech Engine */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono text-cyan-400 flex items-center gap-1.5 uppercase">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Voice & Acoustic Engine</span>
            </h4>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1.5">
                  Audio Speech Engine
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ttsEngine: 'browser' })}
                    className={`p-3 rounded-xl border text-left text-xs transition ${
                      settings.ttsEngine === 'browser'
                        ? 'border-cyan-400 bg-cyan-500/10 text-white font-medium'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    <div className="font-semibold text-cyan-300">Fast Neural Voice</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Ultra-low latency, instant playback</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ttsEngine: 'gemini' })}
                    className={`p-3 rounded-xl border text-left text-xs transition ${
                      settings.ttsEngine === 'gemini'
                        ? 'border-cyan-400 bg-cyan-500/10 text-white font-medium'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    <div className="font-semibold text-purple-300">Cloud HD Voice</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">High-fidelity natural inflection</div>
                  </button>
                </div>
              </div>

              {/* Voice Speed */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-300">Voice Playback Speed</span>
                  <span className="text-cyan-400 font-mono">{settings.voiceSpeed}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.4"
                  step="0.05"
                  value={settings.voiceSpeed}
                  onChange={(e) => onUpdateSettings({ voiceSpeed: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Voice Persona */}
              {settings.ttsEngine === 'gemini' && (
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Cloud Voice Persona</label>
                  <select
                    value={settings.voiceName || 'Kore'}
                    onChange={(e) => onUpdateSettings({ voiceName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="Kore">Kore (Warm, intellectual female tone)</option>
                    <option value="Zephyr">Zephyr (Clear, balanced assistant)</option>
                    <option value="Puck">Puck (Energetic, engaging tutor)</option>
                    <option value="Fenrir">Fenrir (Authoritative deep baritone)</option>
                    <option value="Charon">Charon (Calm contemplative tone)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Conversational Dynamics & Interruption */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono text-cyan-400 flex items-center gap-1.5 uppercase">
              <Mic className="w-3.5 h-3.5" />
              <span>Voice Interaction & Barge-In</span>
            </h4>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">
                    Continuous Hands-Free Conversation
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Automatically re-opens listening after AURA speaks so you can converse naturally.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.handsFree}
                  onChange={(e) => onUpdateSettings({ handsFree: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400 rounded"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">
                    Real-time Voice Barge-in (Interruption)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Allows you to speak while AURA is talking to instantly interrupt without tapping.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.interruptibility}
                  onChange={(e) => onUpdateSettings({ interruptibility: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400 rounded"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">
                    Language Detection
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Auto-detects spoken language (English, Telugu, Hindi, etc.)
                  </p>
                </div>
                <select
                  value={settings.languageMode}
                  onChange={(e) => onUpdateSettings({ languageMode: e.target.value as any })}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                >
                  <option value="auto">Auto-detect (Recommended)</option>
                  <option value="en">English (US/India)</option>
                  <option value="te">Telugu (తెలుగు)</option>
                  <option value="hi">Hindi (हिन्दी)</option>
                  <option value="ta">Tamil (தமிழ்)</option>
                  <option value="kn">Kannada (ಕನ್ನಡ)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Intelligence & Personalization */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono text-cyan-400 flex items-center gap-1.5 uppercase">
              <Brain className="w-3.5 h-3.5" />
              <span>Intelligence & Memory</span>
            </h4>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">
                    Persistent Memory & Profile RAG
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Allows AURA to remember your goals, strengths, and study context across sessions.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.memoryEnabled}
                  onChange={(e) => onUpdateSettings({ memoryEnabled: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400 rounded"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">
                    Live Web Grounding
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Connects AURA to real-time search data with source link citations.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.webSearchEnabled}
                  onChange={(e) => onUpdateSettings({ webSearchEnabled: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400 rounded"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

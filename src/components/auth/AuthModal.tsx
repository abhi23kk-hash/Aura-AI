import React, { useState } from 'react';
import { 
  X, 
  User as UserIcon, 
  LogIn, 
  UserPlus, 
  Sparkles, 
  Shield, 
  GraduationCap,
  Briefcase
} from 'lucide-react';
import { User } from '../../types.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLoginSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [education, setEducation] = useState('Computer Science Engineering');
  const [careerArea, setCareerArea] = useState('Software Engineering & AI');
  const [interests, setInterests] = useState('DSA, System Design, Algorithms');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDemoLoginAbhishek = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'abhi24cmrit@gmail.com' }),
      });
      const data = await res.json();
      if (data.user) {
        onLoginSuccess(data.user);
        onClose();
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await res.json();
        if (data.user) {
          onLoginSuccess(data.user);
          onClose();
        }
      } else {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim() || email.split('@')[0],
            email: email.trim(),
            education,
            careerArea,
            interests: interests.split(',').map((s) => s.trim()).filter(Boolean),
          }),
        });
        const data = await res.json();
        if (data.user) {
          onLoginSuccess(data.user);
          onClose();
        }
      }
    } catch (e: any) {
      setError(e.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 border border-slate-700 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">User Profile & Session</h3>
              <p className="text-xs text-slate-400">AURA memory and learning maps are unique to your account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Demo Login Option */}
        <div className="bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-cyan-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>DEFAULT PROFILE: ABHISHEK</span>
            </span>
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono">
              PRE-CONFIGURED
            </span>
          </div>
          <p className="text-xs text-slate-300">
            Log in as Abhishek (abhi24cmrit@gmail.com) with pre-seeded learning profile, DSA history, and placement targets.
          </p>
          <button
            type="button"
            onClick={handleDemoLoginAbhishek}
            disabled={loading}
            className="w-full mt-2 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Continue as Abhishek</span>
          </button>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-800" />
          <span className="flex-shrink mx-3 text-[11px] font-mono text-slate-500 uppercase">
            Or Use Your Custom Account
          </span>
          <div className="flex-grow border-t border-slate-800" />
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-2 rounded-lg text-xs font-medium transition ${
              mode === 'login' ? 'bg-slate-800 text-cyan-300 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`py-2 rounded-lg text-xs font-medium transition ${
              mode === 'register' ? 'bg-slate-800 text-cyan-300 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Your Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 block mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60"
            />
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="text-xs text-slate-400 block mb-1 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Education / Field</span>
                </label>
                <input
                  type="text"
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="e.g. Computer Science, 3rd Year"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Target Career Area / Goal</span>
                </label>
                <input
                  type="text"
                  value={careerArea}
                  onChange={(e) => setCareerArea(e.target.value)}
                  placeholder="e.g. Software Engineer, Placements"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-medium text-xs transition shadow-lg shadow-indigo-500/20"
          >
            {mode === 'login' ? 'Sign In & Load Profile' : 'Register & Start Journey'}
          </button>
        </form>
      </div>
    </div>
  );
};

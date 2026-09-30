import React from 'react';
import { 
  Radio, 
  Brain, 
  TrendingUp, 
  FileText, 
  History, 
  Settings as SettingsIcon, 
  User as UserIcon, 
  Eye, 
  Sparkles,
  Volume2,
  ExternalLink
} from 'lucide-react';
import { User, AssistantState } from '../../types.js';

interface HeaderProps {
  currentTab: 'assistant' | 'learning' | 'memory' | 'notes' | 'history';
  onTabChange: (tab: 'assistant' | 'learning' | 'memory' | 'notes' | 'history') => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  onOpenVision: () => void;
  assistantState: AssistantState;
  isDemoMode: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  currentUser,
  onOpenAuth,
  onOpenSettings,
  onOpenVision,
  assistantState,
  isDemoMode,
}) => {
  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand & Assistant Identity */}
        <div 
          onClick={() => onTabChange('assistant')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 group-hover:scale-105 transition">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            {/* Live pulsating dot */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                assistantState === 'SPEAKING' ? 'bg-emerald-400' : 'bg-cyan-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-3 w-3 ${
                assistantState === 'SPEAKING' ? 'bg-emerald-500' : 'bg-cyan-500'
              }`} />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-black tracking-wider text-lg text-white group-hover:text-cyan-300 transition">
                AURA AI
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                VOICE OS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight hidden sm:block">
              INTELLIGENT PERSONAL COMPANION
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => onTabChange('assistant')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
              currentTab === 'assistant'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Assistant</span>
          </button>

          <button
            onClick={() => onTabChange('learning')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
              currentTab === 'learning'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>My Learning</span>
          </button>

          <button
            onClick={() => onTabChange('memory')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
              currentTab === 'memory'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>My Memory</span>
          </button>

          <button
            onClick={() => onTabChange('notes')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
              currentTab === 'notes'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes & Plans</span>
          </button>

          <button
            onClick={() => onTabChange('history')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
              currentTab === 'history'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Archive</span>
          </button>
        </nav>

        {/* Right Action Icons & User Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Vision Studio Trigger */}
          <button
            onClick={onOpenVision}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 text-xs font-medium transition flex items-center gap-1.5"
            title="Upload Diagrams, Code or Documents"
          >
            <Eye className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Vision & Docs</span>
          </button>

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
            title="Voice and Assistant Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* Open in full tab for direct hardware mic access */}
          <a
            href={typeof window !== 'undefined' ? window.location.href : '#'}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 transition hidden sm:flex items-center"
            title="Open in new window for direct microphone access"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* User Profile Pill */}
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 transition group"
            title="Switch User / View Profile"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold font-mono">
              {currentUser?.name?.charAt(0) || 'A'}
            </div>
            <span className="text-xs text-slate-200 font-medium hidden sm:inline group-hover:text-cyan-300">
              {currentUser?.name || 'Abhishek'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Sub-Navigation */}
      <div className="flex md:hidden overflow-x-auto px-4 py-2 border-t border-slate-800/60 gap-2 bg-slate-950/90">
        {[
          { id: 'assistant', label: 'Assistant', icon: Radio },
          { id: 'learning', label: 'Learning', icon: TrendingUp },
          { id: 'memory', label: 'Memory', icon: Brain },
          { id: 'notes', label: 'Notes', icon: FileText },
          { id: 'history', label: 'Archive', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as any)}
              className={`px-3 py-1 rounded-xl text-xs whitespace-nowrap flex items-center gap-1.5 transition ${
                currentTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium'
                  : 'text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};

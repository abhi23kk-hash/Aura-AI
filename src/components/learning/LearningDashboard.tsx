import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  BookOpen, 
  RotateCcw, 
  Award, 
  TrendingUp, 
  HelpCircle,
  Play,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { TopicProgress, MistakeRecord } from '../../types.js';

interface LearningDashboardProps {
  userId: string;
  onStartRevisionTopic: (topic: string) => void;
}

export const LearningDashboard: React.FC<LearningDashboardProps> = ({
  userId,
  onStartRevisionTopic,
}) => {
  const [topics, setTopics] = useState<TopicProgress[]>([]);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizTopic, setQuizTopic] = useState<string | null>(null);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'mistakes' | 'revision'>('overview');

  const fetchLearningData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/learning?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      setTopics(data.topics || []);
      setMistakes(data.mistakes || []);
    } catch (e) {
      console.error('Failed to load learning data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLearningData();
  }, [userId]);

  const strongTopics = topics.filter((t) => t.level === 'strong');
  const developingTopics = topics.filter((t) => t.level === 'developing');
  const needsPracticeTopics = topics.filter((t) => t.level === 'needs_practice');
  const revisionRecommended = topics.filter((t) => t.needsRevision);

  const handleMarkMistakeRevised = async (id: string) => {
    try {
      await fetch('/api/learning/mark-revised', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, userId }),
      });
      fetchLearningData();
    } catch (e) {
      console.error('Error marking mistake revised:', e);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>ADAPTIVE LEARNING MODEL</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-white">
            Your Learning Profile
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl">
            AURA continuously maps your strengths, developing skills, and areas needing reinforcement based on actual conversation and practice evidence.
          </p>
        </div>

        <div className="relative z-10 flex gap-4 w-full md:w-auto">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex-1 text-center">
            <div className="text-2xl font-bold text-emerald-400">{strongTopics.length}</div>
            <div className="text-xs text-slate-400 font-mono">Strong</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex-1 text-center">
            <div className="text-2xl font-bold text-amber-400">{developingTopics.length}</div>
            <div className="text-xs text-slate-400 font-mono">Developing</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex-1 text-center">
            <div className="text-2xl font-bold text-rose-400">{needsPracticeTopics.length}</div>
            <div className="text-xs text-slate-400 font-mono">Practice</div>
          </div>
        </div>

        {/* Ambient background blur */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
            activeTab === 'overview'
              ? 'bg-slate-800 text-cyan-300 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Skill Mastery Matrix
        </button>
        <button
          onClick={() => setActiveTab('mistakes')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'mistakes'
              ? 'bg-slate-800 text-cyan-300 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Mistake Journal</span>
          {mistakes.filter((m) => !m.revised).length > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 text-xs flex items-center justify-center font-mono">
              {mistakes.filter((m) => !m.revised).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('revision')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'revision'
              ? 'bg-slate-800 text-cyan-300 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Spaced Revision</span>
          {revisionRecommended.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-xs flex items-center justify-center font-mono">
              {revisionRecommended.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB CONTENT */}

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Strong Areas */}
          <div className="glass-panel rounded-2xl p-5 border-t-2 border-t-emerald-400/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-slate-200 text-base">Strong Areas</h3>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                High Confidence
              </span>
            </div>

            <div className="space-y-3">
              {strongTopics.map((topic, i) => (
                <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-slate-100 text-sm">{topic.topic}</span>
                    <span className="text-xs text-slate-400 font-mono">
                      {topic.correct}/{topic.questionsAttempted} correct
                    </span>
                  </div>
                  {/* Accuracy Bar */}
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full"
                      style={{
                        width: `${Math.round((topic.correct / (topic.questionsAttempted || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                    <span>{topic.category}</span>
                    <button
                      onClick={() => onStartRevisionTopic(topic.topic)}
                      className="text-emerald-300 hover:text-emerald-200 flex items-center gap-0.5"
                    >
                      <span>Practice</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Developing Areas */}
          <div className="glass-panel rounded-2xl p-5 border-t-2 border-t-amber-400/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-slate-200 text-base">Developing</h3>
              </div>
              <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                In Progress
              </span>
            </div>

            <div className="space-y-3">
              {developingTopics.map((topic, i) => (
                <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-slate-100 text-sm">{topic.topic}</span>
                    <span className="text-xs text-slate-400 font-mono">
                      {topic.correct}/{topic.questionsAttempted} correct
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full"
                      style={{
                        width: `${Math.round((topic.correct / (topic.questionsAttempted || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  {topic.commonMistakes.length > 0 && (
                    <p className="text-xs text-amber-300/80 italic">
                      Note: {topic.commonMistakes[0]}
                    </p>
                  )}
                  <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                    <span>{topic.category}</span>
                    <button
                      onClick={() => onStartRevisionTopic(topic.topic)}
                      className="text-amber-300 hover:text-amber-200 flex items-center gap-0.5 font-medium"
                    >
                      <span>Revise now</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Needs Practice */}
          <div className="glass-panel rounded-2xl p-5 border-t-2 border-t-rose-500/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="font-semibold text-slate-200 text-base">Needs Practice</h3>
              </div>
              <span className="text-xs font-mono text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded">
                Priority
              </span>
            </div>

            <div className="space-y-3">
              {needsPracticeTopics.map((topic, i) => (
                <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-slate-100 text-sm">{topic.topic}</span>
                    <span className="text-xs text-slate-400 font-mono">
                      {topic.correct}/{topic.questionsAttempted} correct
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-400 h-full rounded-full"
                      style={{
                        width: `${Math.round((topic.correct / (topic.questionsAttempted || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  {topic.commonMistakes.length > 0 && (
                    <p className="text-xs text-rose-300/80 italic">
                      Struggle: {topic.commonMistakes[0]}
                    </p>
                  )}
                  <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                    <span>{topic.category}</span>
                    <button
                      onClick={() => onStartRevisionTopic(topic.topic)}
                      className="text-rose-300 hover:text-rose-200 flex items-center gap-0.5 font-medium"
                    >
                      <span>Tutor Me</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'mistakes' && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">Mistake Journal</h3>
            <span className="text-xs text-slate-400">
              AURA records specific conceptual gaps and revision milestones
            </span>
          </div>

          <div className="divide-y divide-slate-800">
            {mistakes.map((m) => (
              <div key={m.id} className="py-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {m.subject} • {m.topic}
                    </span>
                    {m.revised && (
                      <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Revised</span>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-200 font-medium">{m.mistakeDescription}</p>
                  <p className="text-xs text-slate-500">
                    Observed: {new Date(m.date).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!m.revised && (
                    <button
                      onClick={() => handleMarkMistakeRevised(m.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    >
                      Mark Revised
                    </button>
                  )}
                  <button
                    onClick={() => onStartRevisionTopic(m.topic)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Revise with AURA</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'revision' && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-100">Spaced Revision Schedule</h3>
          <p className="text-sm text-slate-400">
            Based on the Ebbinghaus forgetting curve, AURA prompts timely reviews before learned concepts fade.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {revisionRecommended.map((topic, i) => (
              <div key={i} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-base">{topic.topic}</span>
                  <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                    Due for review
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Last studied: {new Date(topic.lastStudied).toLocaleDateString()}
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => onStartRevisionTopic(topic.topic)}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white text-xs font-medium transition flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Start 10-Minute Spaced Review</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

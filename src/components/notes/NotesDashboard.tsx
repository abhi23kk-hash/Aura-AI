import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Sun, 
  Sparkles,
  Bookmark
} from 'lucide-react';
import { VoiceNote } from '../../types.js';

interface NotesDashboardProps {
  userId: string;
  userName: string;
}

export const NotesDashboard: React.FC<NotesDashboardProps> = ({
  userId,
  userName,
}) => {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [briefing, setBriefing] = useState<{ text: string; goals: string[]; priorityTopics: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState('DSA, Study');

  const fetchNotesAndBriefing = async () => {
    try {
      setLoading(true);
      const [notesRes, briefingRes] = await Promise.all([
        fetch(`/api/notes?userId=${encodeURIComponent(userId)}`),
        fetch(`/api/briefing?userId=${encodeURIComponent(userId)}`),
      ]);
      const notesData = await notesRes.json();
      const briefingData = await briefingRes.json();
      setNotes(notesData.notes || []);
      setBriefing(briefingData || null);
    } catch (e) {
      console.error('Error fetching notes/briefing:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotesAndBriefing();
  }, [userId]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/notes/${id}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      setNotes(notes.filter((n) => n.id !== id));
    } catch (e) {
      console.error('Error deleting note:', e);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: noteTitle || 'Study Note',
          content: noteContent.trim(),
          tags: noteTags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.note) {
        setNotes([data.note, ...notes]);
        setNewModalOpen(false);
        setNoteTitle('');
        setNoteContent('');
      }
    } catch (e) {
      console.error('Error creating note:', e);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Daily Briefing Card */}
      <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono mb-2">
          <Sun className="w-4 h-4" />
          <span>DAILY BRIEFING & ACTION ORIENTATION</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold font-display text-white mb-3">
          Good day, {userName}
        </h2>
        <p className="text-slate-200 text-sm sm:text-base leading-relaxed max-w-3xl">
          {briefing?.text ||
            `You have active preparation goals. Dedicating 30 minutes to structured review today will maximize retention and interview readiness.`}
        </p>

        {briefing && briefing.priorityTopics.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">Target Focus Today:</span>
            {briefing.priorityTopics.map((topic, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono"
              >
                {topic}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Voice Notes Section */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-cyan-400" />
            <span>Voice & Study Notes</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Captured automatically whenever you say "AURA, take a note" or saved directly
          </p>
        </div>

        <button
          onClick={() => setNewModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Note</span>
        </button>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.map((note) => (
          <div
            key={note.id}
            className="glass-panel rounded-2xl p-5 space-y-3 flex flex-col justify-between hover:border-cyan-500/40 transition group"
          >
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 transition"
                  title="Delete note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <h4 className="font-semibold text-slate-100 text-sm mb-1">{note.title}</h4>
              <p className="text-slate-300 text-xs leading-relaxed line-clamp-4">{note.content}</p>
            </div>

            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-800/60">
                {note.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {notes.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 glass-panel rounded-2xl">
            <p>No notes saved yet. Tell AURA: "Take a note: revise binary trees tonight"</p>
          </div>
        )}
      </div>

      {/* 7-Day Study Plan Preview */}
      <div className="glass-panel rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-slate-100 text-base">Adaptive 7-Day Sprint Plan</h3>
          </div>
          <span className="text-xs font-mono text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/30">
            Auto-Balanced
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 pt-2">
          {[
            { day: 'Day 1', topic: 'Binary Trees', task: 'Inorder & Preorder traversal', status: 'done' },
            { day: 'Day 2', topic: 'BST', task: 'Insertion & Search validation', status: 'done' },
            { day: 'Day 3', topic: 'Graphs', task: 'BFS & Shortest path logic', status: 'current' },
            { day: 'Day 4', topic: 'Graphs DFS', task: 'Cycle detection in directed', status: 'upcoming' },
            { day: 'Day 5', topic: 'DP Basics', task: 'Fibonacci & Climbing stairs', status: 'upcoming' },
            { day: 'Day 6', topic: 'DP 2D', task: 'Knapsack 0/1 state matrix', status: 'upcoming' },
            { day: 'Day 7', topic: 'Mock Interview', task: 'Interactive verbal quiz with AURA', status: 'upcoming' },
          ].map((item, idx) => (
            <div
              key={idx}
              className={`rounded-2xl p-3 border text-xs flex flex-col justify-between h-28 ${
                item.status === 'done'
                  ? 'bg-slate-900/60 border-emerald-500/30 text-slate-300'
                  : item.status === 'current'
                  ? 'bg-cyan-950/40 border-cyan-400/60 text-white shadow-lg shadow-cyan-500/10'
                  : 'bg-slate-900/40 border-slate-800 text-slate-400'
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-1 font-mono text-[11px]">
                  <span className={item.status === 'current' ? 'text-cyan-300 font-bold' : ''}>{item.day}</span>
                  {item.status === 'done' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="font-semibold truncate">{item.topic}</div>
                <div className="text-[10px] text-slate-400 line-clamp-2 mt-1">{item.task}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Note Modal */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-glow rounded-3xl p-6 max-w-lg w-full space-y-4 border border-slate-700">
            <h3 className="text-lg font-bold text-white">Create New Study Note</h3>
            <form onSubmit={handleCreateNote} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Title</label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Binary Search Tree Invariant"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Content</label>
                <textarea
                  rows={4}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Type or dictate your note..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={noteTags}
                  onChange={(e) => setNoteTags(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

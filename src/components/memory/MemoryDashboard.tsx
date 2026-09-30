import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Trash2, 
  Edit3, 
  Plus, 
  ShieldCheck, 
  Sparkles, 
  Target, 
  Heart, 
  Zap, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { MemoryItem, MemoryCategory } from '../../types.js';

interface MemoryDashboardProps {
  userId: string;
  userName: string;
}

export const MemoryDashboard: React.FC<MemoryDashboardProps> = ({
  userId,
  userName,
}) => {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [isMemoryActive, setIsMemoryActive] = useState(true);

  // New Memory Form State
  const [formCategory, setFormCategory] = useState<MemoryCategory>('GOAL');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');

  const fetchMemories = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/memory?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (e) {
      console.error('Error fetching memories:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [userId]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/memory/${id}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      setMemories(memories.filter((m) => m.id !== id));
    } catch (e) {
      console.error('Error deleting memory:', e);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all learned memories for your profile?')) return;
    try {
      await fetch(`/api/memory-clear?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      setMemories([]);
    } catch (e) {
      console.error('Error clearing memories:', e);
    }
  };

  const handleSaveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) return;

    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          category: formCategory,
          title: formTitle || `${formCategory} Note`,
          content: formContent.trim(),
        }),
      });
      const data = await res.json();
      if (data.memory) {
        setMemories([data.memory, ...memories]);
        setNewModalOpen(false);
        setFormTitle('');
        setFormContent('');
      }
    } catch (e) {
      console.error('Error adding memory:', e);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemory) return;

    try {
      const res = await fetch(`/api/memory/${editingMemory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: editingMemory.title,
          content: editingMemory.content,
          category: editingMemory.category,
        }),
      });
      const data = await res.json();
      if (data.memory) {
        setMemories(memories.map((m) => (m.id === data.memory.id ? data.memory : m)));
        setEditingMemory(null);
      }
    } catch (e) {
      console.error('Error updating memory:', e);
    }
  };

  const categories = ['ALL', 'GOAL', 'INTEREST', 'PREFERENCE', 'MISTAKE', 'OBSERVED_PATTERN', 'FACT'];

  const filteredMemories = selectedCategory === 'ALL'
    ? memories
    : memories.filter((m) => m.category === selectedCategory);

  const getCategoryBadge = (category: MemoryCategory) => {
    switch (category) {
      case 'GOAL':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'INTEREST':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'PREFERENCE':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/30';
      case 'MISTAKE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'OBSERVED_PATTERN':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header Panel */}
      <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <Brain className="w-3.5 h-3.5" />
            <span>USER-SPECIFIC RAG STORE</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-white">
            What AURA Knows About You
          </h2>
          <p className="text-slate-300 text-sm max-w-xl">
            AURA continuously learns from your spoken goals, study patterns, and feedback. You retain absolute privacy and full control over every memory.
          </p>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setNewModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white text-xs font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Memory</span>
          </button>
          <button
            onClick={handleClearAll}
            className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Memory Status Bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <div className="text-xs">
            <span className="text-slate-200 font-medium">Memory Isolation: Active for {userName}</span>
            <p className="text-slate-500">Cross-user retrieval is strictly prevented by isolated user-id indexing.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Memory Engine:</span>
          <button
            onClick={() => setIsMemoryActive(!isMemoryActive)}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition ${
              isMemoryActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {isMemoryActive ? 'ENABLED' : 'PAUSED'}
          </button>
        </div>
      </div>

      {/* Categories Filter */}
      <div className="flex flex-wrap gap-2 pt-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition ${
              selectedCategory === cat
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/30'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Memories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMemories.map((mem) => (
          <div
            key={mem.id}
            className="glass-panel rounded-2xl p-5 space-y-3 relative group hover:border-cyan-500/40 transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${getCategoryBadge(mem.category)}`}>
                  {mem.category}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Confidence: {Math.round(mem.confidence * 100)}%
                </span>
              </div>

              <h4 className="font-semibold text-slate-100 text-base">{mem.title}</h4>
              <p className="text-slate-300 text-sm mt-1 leading-relaxed">{mem.content}</p>
            </div>

            <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
              <span className="italic truncate max-w-[200px]">Source: {mem.source}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingMemory(mem)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition"
                  title="Edit Memory"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(mem.id)}
                  className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                  title="Forget Memory"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Memory Modal */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-glow rounded-3xl p-6 max-w-lg w-full space-y-4 border border-slate-700">
            <h3 className="text-lg font-bold text-white">Add Explicit Memory</h3>
            <form onSubmit={handleSaveNew} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as MemoryCategory)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200"
                >
                  <option value="GOAL">GOAL (Target to achieve)</option>
                  <option value="INTEREST">INTEREST (Topic of enthusiasm)</option>
                  <option value="PREFERENCE">PREFERENCE (Learning/interaction style)</option>
                  <option value="SKILL">SKILL (Demonstrated mastery)</option>
                  <option value="MISTAKE">MISTAKE (Observed conceptual gap)</option>
                  <option value="FACT">FACT (Explicit personal detail)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Campus Placement Goal"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Content</label>
                <textarea
                  rows={3}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Describe what AURA should remember..."
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
                  Save Memory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Memory Modal */}
      {editingMemory && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-glow rounded-3xl p-6 max-w-lg w-full space-y-4 border border-slate-700">
            <h3 className="text-lg font-bold text-white">Edit Memory</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Category</label>
                <select
                  value={editingMemory.category}
                  onChange={(e) => setEditingMemory({ ...editingMemory, category: e.target.value as MemoryCategory })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200"
                >
                  <option value="GOAL">GOAL</option>
                  <option value="INTEREST">INTEREST</option>
                  <option value="PREFERENCE">PREFERENCE</option>
                  <option value="SKILL">SKILL</option>
                  <option value="MISTAKE">MISTAKE</option>
                  <option value="FACT">FACT</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Title</label>
                <input
                  type="text"
                  value={editingMemory.title}
                  onChange={(e) => setEditingMemory({ ...editingMemory, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Content</label>
                <textarea
                  rows={3}
                  value={editingMemory.content}
                  onChange={(e) => setEditingMemory({ ...editingMemory, content: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMemory(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  History, 
  MessageSquare, 
  ArrowRight, 
  Clock, 
  Sparkles,
  Calendar
} from 'lucide-react';
import { ConversationSession } from '../../types.js';

interface ConversationHistoryProps {
  userId: string;
  onResumeSession: (messages: any[]) => void;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  userId,
  onResumeSession,
}) => {
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/history?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        setConversations(data.conversations || []);
      } catch (e) {
        console.error('Error fetching history:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [userId]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display text-white flex items-center gap-2">
            <History className="w-6 h-6 text-cyan-400" />
            <span>Conversation Archive</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Review past voice dialogues and resume context where you left off
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className="glass-panel rounded-2xl p-5 hover:border-cyan-500/40 transition group cursor-pointer"
            onClick={() => onResumeSession(conv.messages)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded">
                    {conv.messages.length} messages
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {new Date(conv.updatedAt).toLocaleString()}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-slate-100 group-hover:text-cyan-300 transition">
                  {conv.title}
                </h3>
                {conv.messages.length > 0 && (
                  <p className="text-xs text-slate-400 line-clamp-2 italic">
                    "{conv.messages[conv.messages.length - 1].text}"
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 text-cyan-400 opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition text-xs font-medium">
                <span>Resume</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}

        {conversations.length === 0 && (
          <div className="py-16 text-center text-slate-500 glass-panel rounded-2xl">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40 text-cyan-400" />
            <p>No past conversations recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

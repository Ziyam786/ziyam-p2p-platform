'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import Modal from '../../components/Modal';
import { adminApi } from '../../lib/api';
import type { ChatConversationSummary, ChatMessageRow } from '../../lib/types';

export default function AiConversationsPage() {
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<ChatMessageRow[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  useEffect(() => {
    adminApi.aiConversations().then((res) => setConversations(res.data)).finally(() => setLoading(false));
  }, []);

  function openTranscript(sessionId: string) {
    setActiveSession(sessionId);
    setTranscriptLoading(true);
    adminApi.aiConversation(sessionId).then((res) => setTranscript(res.data)).finally(() => setTranscriptLoading(false));
  }

  return (
    <AdminShell title="AI Assistant" subtitle={`${conversations.length} conversations with lessees/hosts`}>
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : conversations.length === 0 ? (
        <p className="text-slate-500">No conversations yet — they'll show up here once lessees use the chat widget.</p>
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => (
            <button
              key={c.sessionId}
              onClick={() => openTranscript(c.sessionId)}
              className="w-full text-left bg-slate-900 border border-slate-800 hover:border-brand-600 rounded-2xl p-4 transition flex justify-between items-center gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm text-slate-200 truncate">{c.lastMessage}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {c.messageCount} messages · {c.userId ? 'logged-in user' : 'guest'} · {new Date(c.lastMessageAt).toLocaleString()}
                </p>
              </div>
              <span className="text-xs text-brand-400 shrink-0">View →</span>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!activeSession} onClose={() => setActiveSession(null)} title="Conversation Transcript">
        {transcriptLoading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : (
          <div className="space-y-3">
            {transcript.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </AdminShell>
  );
}

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { aiApi, ApiError } from '../lib/api';

interface Message { role: 'user' | 'assistant'; content: string; }

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('ziyam_chat_session');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('ziyam_chat_session', id);
  }
  return id;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm Avya, Ziyam's AI assistant. Ask me about bookings, KYC, payouts, or anything else — I can look up real car availability and your bookings, not just answer generically." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setSending(true);

    try {
      const res = await aiApi.chat(getSessionId(), text);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      setMessages((m) => [...m, { role: 'assistant', content: msg }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[80]">
      {open && (
        <div className="mb-3 w-[340px] sm:w-[380px] h-[480px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
          <div className="bg-gray-950 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <div>
                <p className="font-bold text-sm leading-tight">Avya AI</p>
                <p className="text-[10px] text-gray-400">Ziyam's AI assistant</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-lg leading-none" aria-label="Close chat">
              ×
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.role === 'user' ? 'bg-amber-500 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-700 rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm text-gray-400">
                  Typing…
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-3 border-t border-gray-100 flex gap-2 shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="btn-gradient disabled:!bg-none disabled:bg-gray-200 disabled:!shadow-none text-white font-bold px-4 py-2 rounded-xl text-sm transition"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full btn-gradient text-white shadow-xl flex items-center justify-center text-2xl transition"
        aria-label="Toggle support chat"
      >
        {open ? '×' : '💬'}
      </button>
    </div>
  );
}

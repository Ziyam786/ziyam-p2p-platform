'use client';

import React, { useEffect, useRef, useState } from 'react';
import { bookingsApi, ApiError, type TripMessage } from '../lib/api';
import { useAuth } from '../lib/auth-context';

const POLL_MS = 8000;

export default function TripChat({ bookingId, otherPartyName }: { bookingId: string; otherPartyName?: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function load(silent = false) {
    if (!silent) setLoading(true);
    bookingsApi
      .messages(bookingId)
      .then((res) => setMessages(res.data))
      .catch(() => {})
      .finally(() => !silent && setLoading(false));
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await bookingsApi.sendMessage(bookingId, body);
      setMessages((m) => [...m, res.data]);
      setInput('');
    } catch (err) {
      // Non-critical — the poll loop will pick up the true state either way.
      console.error('Failed to send message', err instanceof ApiError ? err.message : err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col h-[420px]">
      <div className="px-5 py-3 border-b border-gray-100 shrink-0">
        <p className="font-bold text-gray-900 text-sm">💬 Message {otherPartyName ?? 'the other party'}</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No messages yet — say hello 👋</p>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === user?.id;
            return (
              <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  isMine ? 'bg-amber-500 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-700 rounded-bl-sm'
                }`}>
                  {m.body}
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-amber-100' : 'text-gray-400'}`}>
                    {new Date(m.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            );
          })
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
  );
}

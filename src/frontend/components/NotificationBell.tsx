'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { notificationsApi } from '../lib/api';
import type { AppNotification } from '../lib/types';

const TYPE_ICONS: Record<string, string> = {
  BOOKING_CONFIRMED: '✅',
  TRIP_STARTED: '🚗',
  REVIEW_RECEIVED: '⭐',
  KYC_VERIFIED: '🪪',
  PAYOUT_SETTLED: '💸',
  PROMO: '🎟️',
  GENERIC: '🔔',
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function load() {
    setLoading(true);
    notificationsApi
      .list()
      .then((res) => {
        setNotifications(res.data);
        setUnreadCount(res.unreadCount);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!user) return;
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleOpen() {
    setOpen((o) => !o);
  }

  async function handleNotificationClick(n: AppNotification) {
    if (!n.read) {
      await notificationsApi.markRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.link) window.location.href = n.link;
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative w-9 h-9 flex items-center justify-center text-gray-500 hover:text-amber-500 transition"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 max-h-96 overflow-y-auto z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
            <span className="font-bold text-gray-900 text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-amber-500 hover:text-amber-600 font-semibold">
                Mark all read
              </button>
            )}
          </div>
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition flex gap-3 ${
                  !n.read ? 'bg-amber-50/50' : ''
                }`}
              >
                <span className="text-lg shrink-0">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                <div className="min-w-0">
                  <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

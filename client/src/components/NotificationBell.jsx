import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ensureAudioUnlockedOnGesture,
  playNotificationChime,
  unlockAudio
} from '../utils/audio';

/**
 * Shared panel notification bell.
 * Sound plays when unread count increases (after browser audio is unlocked by a click).
 */
export default function NotificationBell({
  fetchInbox,
  onItemClick,
  onMarkAllRead,
  onMarkRead,
  pollMs = 20000,
  title = 'Notifications'
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const unreadRef = useRef(0);
  const primedRef = useRef(false);

  const load = useCallback(async () => {
    if (!fetchInbox) return;
    try {
      const res = await fetchInbox();
      const rows = Array.isArray(res?.items) ? res.items : [];
      const nextUnread = Number(res?.unread ?? rows.filter((n) => !n.read).length);
      setItems(rows);
      setUnread(nextUnread);
      if (primedRef.current && nextUnread > unreadRef.current) {
        playNotificationChime();
      }
      primedRef.current = true;
      unreadRef.current = nextUnread;
    } catch {
      /* ignore */
    }
  }, [fetchInbox]);

  useEffect(() => {
    const cleanup = ensureAudioUnlockedOnGesture();
    load();
    const t = setInterval(load, pollMs);
    return () => {
      cleanup();
      clearInterval(t);
    };
  }, [load, pollMs]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          // First click unlocks browser audio so later alerts can play
          unlockAudio();
          setOpen((o) => !o);
          load();
        }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
        title={`${title} (click once to enable sound)`}
        aria-label={title}
      >
        <span className="text-base leading-none" aria-hidden>
          🔔
        </span>
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-[1.1rem] rounded-full bg-rose-600 px-1 text-center text-[10px] font-black text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-black text-slate-900">{title}</p>
            {onMarkAllRead ? (
              <button
                type="button"
                className="text-[10px] font-bold text-emerald-700 underline"
                onClick={async () => {
                  try {
                    await onMarkAllRead();
                    await load();
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs font-semibold text-slate-500">
                No notifications
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id || n._id}
                  type="button"
                  className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 ${
                    n.read ? 'opacity-70' : 'bg-amber-50/40'
                  }`}
                  onClick={async () => {
                    try {
                      if (!n.read && onMarkRead) await onMarkRead(n);
                      setOpen(false);
                      onItemClick?.(n);
                      await load();
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  <p className="text-[11px] font-black text-slate-900">{n.title}</p>
                  <p className="text-[10px] font-semibold text-slate-600 mt-0.5 line-clamp-2">
                    {n.body || n.message || ''}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 mt-1">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                    {!n.read ? ' · New' : ''}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

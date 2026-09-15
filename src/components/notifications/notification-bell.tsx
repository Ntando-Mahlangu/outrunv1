"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

type Notification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const body = await res.json();
    setNotifications(body.notifications);
    setUnreadCount(body.unreadCount);
  }

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!body) return;
        setNotifications(body.notifications);
        setUnreadCount(body.unreadCount);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleToggle() {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening) await refresh();
  }

  async function handleNotificationClick(notification: Notification) {
    if (!notification.readAt) {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      });
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
    }
    setIsOpen(false);
    if (notification.link) router.push(notification.link);
  }

  async function handleMarkAllRead() {
    await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="glass-sheen absolute right-0 z-20 mt-2 w-80 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-glass-menu)] shadow-[var(--shadow-glass)] backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-[var(--color-accent-text)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
                Nothing yet — we&apos;ll let you know when something needs your attention.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "block w-full border-b border-[var(--color-border)] px-4 py-3 text-left last:border-0 hover:bg-[var(--color-bg-secondary)]",
                    !n.readAt && "bg-[var(--color-accent)]/5",
                  )}
                >
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{n.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{n.body}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

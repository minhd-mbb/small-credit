"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  time: string;
  senderName: string;
  senderAccountNo: string;
  senderBankName: string;
  recipientAccountNo: string;
  amount: string;
};

const LAST_VIEWED_KEY = "credit-app.notifications.lastViewedAt";
const amountFormatter = new Intl.NumberFormat("vi-VN");

function formatAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amountFormatter.format(amount)} VNĐ` : "0 VNĐ";
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [lastViewedAt, setLastViewedAt] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function countUnread(nextItems: NotificationItem[], viewedAt: number) {
    return nextItems.filter((item) => new Date(item.time).getTime() > viewedAt)
      .length;
  }

  const loadNotifications = useCallback(async () => {
    const response = await fetch("/api/notifications");

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const nextItems = payload.data ?? [];
    const viewedAt = Number(window.localStorage.getItem(LAST_VIEWED_KEY) ?? 0);

    setLastViewedAt(viewedAt);
    setUnreadCount(countUnread(nextItems, viewedAt));
    setItems(nextItems);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadNotifications, 0);
    const interval = window.setInterval(loadNotifications, 5000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadNotifications]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function openNotifications() {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (!nextOpen) {
      return;
    }

    const viewedAt = Date.now();
    window.localStorage.setItem(LAST_VIEWED_KEY, String(viewedAt));
    setLastViewedAt(viewedAt);
    setUnreadCount(0);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        aria-label="Notifications"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-white text-[var(--color-text)] shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary-lt)] hover:bg-[var(--color-primary-bg)] hover:text-[var(--color-primary)] active:scale-[0.97]"
        type="button"
        onClick={openNotifications}
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed right-4 top-4 z-[120] w-[min(520px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.18)] md:right-6 md:top-6">
          <div className="border-b border-[var(--border-card)] px-4 py-3">
            <p className="font-display text-base font-bold text-[var(--text-primary)]">
              Chuyển khoản tới
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">
              5 lệnh chuyển khoản gần nhất
            </p>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-4 text-sm font-semibold text-[var(--text-secondary)]">
              Chưa có chuyển khoản tới.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`border-b border-[var(--border-card)] px-4 py-3 last:border-0 ${
                    new Date(item.time).getTime() > lastViewedAt
                      ? "bg-[var(--primary-light)] font-bold"
                      : "font-semibold"
                  }`}
                >
                  <p className="text-sm text-[var(--text-primary)]">
                    {formatAmount(item.amount)} -{" "}
                    {item.senderName || "Không xác định"} -{" "}
                    {item.senderAccountNo || "Không xác định"} -{" "}
                    {item.senderBankName || "Không xác định"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

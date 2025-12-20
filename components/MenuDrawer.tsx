"use client";
import React, { useEffect } from "react";

type NavTab = { id: string; label: string; icon: string; path: string };

export default function MenuDrawer({
  open,
  onClose,
  tabs,
}: {
  open: boolean;
  onClose: () => void;
  tabs: NavTab[];
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      // prevent body scroll when open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${
          open ? "opacity-60 pointer-events-auto" : "opacity-0 pointer-events-none"
        } bg-black`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={`fixed top-0 right-0 z-50 h-full w-[92%] max-w-[420px] transform bg-[var(--card-bg)] shadow-2xl transition-all duration-300
          ${open ? "translate-x-0" : "translate-x-full"}
          rounded-l-2xl overflow-auto text-[var(--text-primary)]`}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-3xl font-extrabold">Menu</h2>
            <button
              aria-label="Close menu"
              onClick={onClose}
              className="p-2 rounded-md hover:bg-[var(--bg-primary)] transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Search bar */}
          <div className="mb-6">
            <div className="flex items-center gap-2 bg-[var(--bg-primary)] rounded-full px-4 py-3">
              <svg className="w-5 h-5 text-[var(--text-secondary)]" viewBox="0 0 24 24" fill="none">
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                className="bg-transparent outline-none w-full text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
                placeholder="Search menu"
                aria-label="Search menu"
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>

          {/* Section title */}
          <h3 className="text-xl font-bold mb-4">Social</h3>

          {/* Tabs list */}
          <nav className="space-y-6">
            {tabs.map((t) => (
              <a
                key={t.id}
                href={t.path}
                className="flex items-start gap-4 group"
                onClick={onClose}
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[var(--bg-primary)] shadow flex items-center justify-center">
                  <img src={t.icon} alt={`${t.label} icon`} className="h-9 w-9 svg-icon" />
                </div>

                <div>
                  <div className="font-semibold text-lg group-hover:underline">{t.label}</div>
                  <div className="text-sm text-[var(--text-secondary)] max-w-[260px] leading-5">
                    {/* Basic descriptions — replace or localize per tab */}
                    {t.id === "events" && "Organize or find events and other things to do online and nearby."}
                    {t.id === "chats" && "Message your friends and groups in private or group chats."}
                    {t.id === "pages" && "Discover and connect with businesses and public Pages."}
                    {t.id === "gaming" && "Play games, watch streams, and connect with players."}
                    {t.id === "home" && "See relevant posts from people and Pages you follow."}
                    {t.id === "notifications" && "View and manage your notifications and updates."}
                  </div>
                </div>
              </a>
            ))}
          </nav>

          {/* Bottom spacing so rounded corner looks neat */}
          <div className="h-8" />
        </div>
      </aside>
    </>
  );
}

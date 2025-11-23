// app/components/Navbar.tsx
import React from "react";

const navTabs = [
  { id: "home", label: "Home", icon: "svgs/home.svg", active: true },
  { id: "chats", label: "Chats", icon: "svgs/chat.svg" },
  { id: "groups", label: "Groups", icon: "svgs/groups.svg" },
  { id: "pages", label: "Pages", icon: "svgs/pages.svg" },
  { id: "gaming", label: "Gaming", icon: "svgs/gaming.svg" },
];

export const Navbar: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-black/5 bg-white px-3 shadow-sm">
      {/* LEFT: logo + search */}
      <div className="flex min-w-[260px] items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0866ff] text-2xl font-bold text-white">
          In
        </div>

        <div className="hidden h-10 items-center rounded-full bg-[#f0f2f5] px-3 md:flex">
          <span className="text-sm text-neutral-500">🔍</span>
          <input
            type="text"
            placeholder="Search Innr"
            className="ml-2 w-40 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none"
          />
        </div>
      </div>

      {/* CENTER: tabs */}
      <nav className="flex flex-1 items-stretch justify-center gap-1">
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            className={`relative flex w-28 items-center justify-center rounded-xl text-2xl transition hover:bg-[#f0f2f5] ${
              tab.active ? "text-[#0866ff]" : "text-neutral-500"
            }`}
            aria-label={tab.label}
          >
            <img src={tab.icon} alt={tab.label} className="h-5 w-5" />
            {tab.active && (
              <span className="absolute -bottom-2 h-0.5 w-4/5 rounded-full bg-[#0866ff]" />
            )}
          </button>
        ))}
      </nav>

      {/* RIGHT: icon buttons */}
      <div className="flex min-w-[220px] items-center justify-end gap-2">
        {/* square grid / menu */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e4e6eb] text-lg text-neutral-900 transition hover:bg-[#d8dadf] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-400"
          aria-label="Menu"
        >
          <img src="/svgs/menu.svg" alt="Menu" className="h-5 w-5" />
        </button>

        {/* notifications + badge */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#e4e6eb] text-lg text-neutral-900 transition hover:bg-[#d8dadf]"
          aria-label="Notifications"
        >
          <img src="/svgs/notification.svg" alt="notification" className="h-5 w-5" />
        </button>

        {/* avatar */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full"
          aria-label="Profile"
        >
          <img
            src="images/avatar_placeholder.png"
            alt="Profile"
            className="h-8 w-8 rounded-full object-cover"
          />
        </button>
      </div>
    </header>
  );
};

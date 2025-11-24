'use client'
import React, { useEffect, useRef, useState } from "react";

const navTabs = [
  { id: "home", label: "Home", icon: "/svgs/home.svg", active: true },
  { id: "chats", label: "Chats", icon: "/svgs/chat.svg" },
  { id: "groups", label: "Groups", icon: "/svgs/groups.svg" },
  { id: "pages", label: "Pages", icon: "/svgs/pages.svg" },
  { id: "gaming", label: "Gaming", icon: "/svgs/gaming.svg"},
];

export const Navbar: React.FC = () => {
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  const [searchExpanded, setSearchExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (searchExpanded && inputRef.current) inputRef.current.focus();
  }, [searchExpanded]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!searchExpanded) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSearchExpanded(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (!searchExpanded) return;
      if (e.key === "Escape") setSearchExpanded(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [searchExpanded]);

  const isWide = windowWidth >= 928;
  const isMedium = windowWidth >= 768 && windowWidth < 928;

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-black/5 shadow-sm">
      <div className="grid grid-cols-[1fr_minmax(0,670px)_1fr] items-center px-3 sm:px-4 lg:px-6 h-14">

        {/* LEFT: logo + search */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0866ff] text-lg font-bold text-white sm:h-10 sm:w-10 flex-shrink-0">
            In
          </div>

          {/* Wide: full search */}
          {isWide && (
            <div className="flex h-9 items-center rounded-full bg-[#f0f2f5] px-3">
              <span className="text-sm text-neutral-500">
                <img src="svgs/search.svg" alt="Menu" className="h-4 w-4" />
              </span>
              <input
                type="search"
                placeholder="Search Innr"
                className="ml-2 w-44 max-w-[80vw] bg-transparent text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none"
              />
            </div>
          )}

          {/* Medium & small: search icon */}
          {(isMedium || !isWide) && (
            <div ref={containerRef} className="relative flex-shrink-0">
              <button
                onClick={() => setSearchExpanded((s) => !s)}
                aria-expanded={searchExpanded}
                aria-label={searchExpanded ? "Close search" : "Open search"}
                className="ml-2 p-2 rounded-full text-neutral-600 hover:bg-[#f0f2f5] transition flex-shrink-0"
              >
                <img src="svgs/search.svg" alt="Menu" className="h-4 w-4" />
              </button>

              {searchExpanded && (
                <div className="absolute left-0 top-10 z-50 w-[260px] max-w-[90vw] rounded-md bg-white p-2 shadow-lg">
                  <div className="flex items-center rounded-md bg-[#f5f7f9] px-2 py-1">
                    <span className="text-neutral-500">
                        <img src="svgs/search.svg" alt="Menu" className="h-4 w-4" />
                    </span>
                    <input
                      ref={inputRef}
                      type="search"
                      placeholder="Search Innr"
                      className="ml-2 w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none"
                      aria-label="Search Innr"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CENTER tabs aligned with post width */}
        <div className="hidden md:flex flex-1 justify-center">
          <div className="flex w-full max-w-[768px] ">
            {navTabs.map((tab) => (
              <button
                key={tab.id}
                className={`flex-1 flex flex-col items-center text-xl transition py-1 ${
                  tab.active ? "text-[#0866ff]" : "text-neutral-500"
                }`}
                aria-label={tab.label}
              >
                <img src={tab.icon} alt={tab.label} className="h-6 w-6" />
                {tab.active && <span className="mt-1 h-0.5 w-full bg-[#0866ff] rounded-full" />}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT icons */}
        <div className="flex items-center gap-2 flex-shrink-0 justify-self-end">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e4e6eb] transition hover:bg-[#d8dadf]"
            aria-label="Menu"
          >
            <img src="/svgs/menu.svg" alt="Menu" className="h-4 w-4" />
          </button>

          <button
            className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#e4e6eb] transition hover:bg-[#d8dadf]"
            aria-label="Notifications"
          >
            <img src="/svgs/notification.svg" alt="Notifications" className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              3
            </span>
          </button>

          <button className="flex h-8 w-8 items-center justify-center rounded-full" aria-label="Profile">
            <img src="/images/avatar_placeholder.png" alt="Profile" className="h-8 w-8 rounded-full object-cover" />
          </button>
        </div>
      </div>
    </header>
  );
};

"use client";
import React, { useEffect, useRef, useState } from "react";
import TooltipButton from "./TooltipButton";
import { useRouter } from "next/navigation";
import MenuDrawer from "./MenuDrawer";
import { usePathname } from "next/navigation";

const navTabs = [
  { id: "home", label: "Home", icon: "/svgs/home.svg", path: "/" },
  { id: "chats", label: "Chats", icon: "/svgs/chat.svg", path: "/chats" },
  { id: "events", label: "Events", icon: "/svgs/events.svg", path: "/events" },
  { id: "pages", label: "Pages", icon: "/svgs/pages.svg", path: "/pages" },
  { id: "gaming", label: "Gaming", icon: "/svgs/gaming.svg", path: "/gaming" },
];

export const Navbar: React.FC = () => {
  // NOTE: initialize to null so server and client initial render match
  const [windowWidth, setWindowWidth] = useState<number | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  useEffect(() => {
    // set initial width on mount and subscribe to resize
    const setWidth = () => setWindowWidth(window.innerWidth);
    setWidth();

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
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
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

  // compute breakpoints only when we have a real width
  const isWide = windowWidth !== null ? windowWidth >= 928 : false;
  const isMedium = windowWidth !== null ? windowWidth >= 768 && windowWidth < 928 : false;

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-black/5 shadow-sm">
      <div className="grid grid-cols-[1fr_minmax(0,670px)_1fr] items-center px-3 sm:px-4 lg:px-6 h-14">
        {/* LEFT: logo + search */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-gray-100 cursor-pointer overflow-hidden">
            <img
              src="/images/logo.png"
              alt="logo"
              className="object-contain h-full w-full"
            />
          </div>

          {/* Wide: full search (renders only when we know width and it's wide) */}
          {windowWidth !== null && isWide && (
            <div className="flex h-9 items-center rounded-full bg-[#f0f2f5] px-3">
              <span className="text-sm text-neutral-500">
                <img src="/svgs/search.svg" alt="Menu" className="h-4 w-4" />
              </span>
              <input
                type="search"
                placeholder="Search Innr"
                className="ml-2 w-44 max-w-[80vw] bg-transparent text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none"
              />
            </div>
          )}

          {/* Medium & small: search icon (stable fallback rendered on server and initial client) */}
          {!isWide && (
            <div ref={containerRef} className="relative flex-shrink-0">
              <button
                onClick={() => setSearchExpanded((s) => !s)}
                aria-expanded={searchExpanded}
                aria-label={searchExpanded ? "Close search" : "Open search"}
                className="ml-2 p-2 rounded-full text-neutral-600 hover:bg-[#f0f2f5] transition flex-shrink-0"
              >
                <img src="/svgs/search.svg" alt="Menu" className="h-4 w-4" />
              </button>

              {searchExpanded && (
                <div className="absolute left-0 top-10 z-50 w-[260px] max-w-[90vw] rounded-md bg-white p-2 shadow-lg">
                  <div
                    className="flex items-center rounded-md bg-[#f5f7f9] px-2 py-1"
                    title="Menu"
                  >
                    <span className="text-neutral-500"></span>
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
          <div className="flex w-full max-w-[768px]">
            {navTabs.map((tab) => {
              const isActive =
                pathname === tab.path || (tab.path !== "/" && pathname.startsWith(tab.path));

              return (
                <TooltipButton
                  key={tab.id}
                  label={tab.label}
                  fullWidth
                  as="button"
                  onClick={() => {
                    // we derive active from pathname so no need to set local activeTab
                    router.push(tab.path);
                  }}
                >
                  <div
                    className={`flex-1 flex flex-col items-center text-xl transition py-1 ${
                      isActive ? "text-[#0866ff]" : "text-neutral-500"
                    }`}
                    aria-label={tab.label}
                  >
                    <img src={tab.icon} alt={tab.label} className="h-6 w-6" />
                    {isActive && (
                      <span className="mt-1 h-0.5 w-full bg-[#0866ff] rounded-full" />
                    )}
                  </div>
                </TooltipButton>
              );
            })}
          </div>
        </div>

        {/* RIGHT icons */}
        <div className="flex items-center gap-3 flex-shrink-0 justify-self-end relative">
          {/* Menu Button */}
          <TooltipButton label="Menu" iconSrc="/svgs/menu.svg" onClick={() => setIsMenuOpen(true)}>
            <div
              className="relative flex h-9 w-9 items-center justify-center shrink-0 rounded-full bg-[#e4e6eb] transition hover:bg-[#d8dadf]"
              aria-label="Menu"
            >
              <img src="/svgs/menu.svg" className="h-5 w-5" />
            </div>
          </TooltipButton>
          <MenuDrawer open={isMenuOpen} onClose={() => setIsMenuOpen(false)} tabs={navTabs} />

          {/* Notifications Button */}
          <TooltipButton label="Notification" iconSrc="/svgs/notification.svg">
            <div
              className="relative flex h-9 w-9 items-center justify-center shrink-0 rounded-full bg-[#e4e6eb] transition hover:bg-[#d8dadf]"
              aria-label="Notifications"
            >
              <img src="/svgs/notification.svg" />
              <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                3
              </span>
            </div>
          </TooltipButton>

          {/* Profile Button */}
          <TooltipButton
            label="Profile"
            iconSrc="/images/avatar_placeholder.png"
          >
            <img
              src="/images/avatar_placeholder.png"
              alt="Profile"
              className="h-9 w-9 scale-110 rounded-full shrink-0 object-cover"
            />
          </TooltipButton>
        </div>
      </div>
    </header>
  );
};

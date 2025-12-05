"use client";
import React, { useEffect, useRef, useState } from "react";
import TooltipButton from "./TooltipButton";
import { useRouter } from "next/navigation";
import MenuDrawer from "./MenuDrawer";
import { usePathname } from "next/navigation";
import ProfileSidebar from "./ProfileSideBar";
import { useUserAvatar } from "@/hooks/useUserAvatar";

const navTabs = [
  { id: "home", label: "Home", icon: "/svgs/home.svg", path: "/" },
  { id: "chats", label: "Chats", icon: "/svgs/chat.svg", path: "/chats" },
  { id: "events", label: "Events", icon: "/svgs/events.svg", path: "/events" },
  {
    id: "notifications",
    label: "Notifications",
    icon: "/svgs/notification.svg",
    path: "/notifications",
  },
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
  const [openProfile, setOpenProfile] = useState(false);
  const router = useRouter();
  const avatar = useUserAvatar();

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
  const isMedium =
    windowWidth !== null ? windowWidth >= 768 && windowWidth < 928 : false;

  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--card-bg)] border-b border-[var(--card-border)] shadow-sm transition-colors">
      <div className="grid grid-cols-[1fr_minmax(0,670px)_1fr] items-center px-3 sm:px-4 lg:px-6 h-14">
        {/* LEFT: logo + search */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div 
            onClick={() => router.push("/")}
            className="flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-[var(--bg-primary)] cursor-pointer overflow-hidden hover:bg-[var(--card-bg)] transition-colors"
          >
            <img
              src="/images/logo.png"
              alt="logo"
              className="object-contain h-full w-full"
            />
          </div>

          {/* Wide: full search (renders only when we know width and it's wide) */}
          {windowWidth !== null && isWide && (
            <div className="flex h-9 items-center rounded-full bg-[var(--bg-primary)] px-3">
              <span className="text-sm text-[var(--text-secondary)]">
                <img src="/svgs/search.svg" alt="Menu" className="h-4 w-4 svg-icon" />
              </span>
              <input
                type="search"
                placeholder="Search Innr"
                className="ml-2 w-44 max-w-[80vw] bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none"
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
                className="ml-2 p-2 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition flex-shrink-0"
              >
                <img src="/svgs/search.svg" alt="Menu" className="h-4 w-4 svg-icon" />
              </button>

              {searchExpanded && (
                <div className="absolute left-0 top-10 z-50 w-[260px] max-w-[90vw] rounded-md bg-[var(--card-bg)] border border-[var(--card-border)] p-2 shadow-lg transition-colors">
                  <div
                    className="flex items-center rounded-md bg-[var(--bg-primary)] px-2 py-1"
                    title="Menu"
                  >
                    <span className="text-[var(--text-secondary)]"></span>
                    <input
                      ref={inputRef}
                      type="search"
                      placeholder="Search Innr"
                      className="ml-2 w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none"
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
                pathname === tab.path ||
                (tab.path !== "/" && pathname.startsWith(tab.path));

              const isNotifications = tab.label === "Notifications";

              return (
                <TooltipButton
                  key={tab.id}
                  label={tab.label}
                  fullWidth
                  as="button"
                  onClick={() => router.push(tab.path)}
                >
                  <div
                    className={`relative flex-1 flex flex-col items-center text-xl transition py-1 ${
                      isActive ? "text-[var(--color-accent)]" : "text-[var(--text-secondary)]"
                    }`}
                    aria-label={tab.label}
                  >
                    <div className="relative">
                      <img src={tab.icon} alt={tab.label} className="h-6 w-6 svg-icon" />

                      {/* BADGE attached directly to the image */}
                      {isNotifications && (
                        <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                          3
                        </span>
                      )}
                    </div>

                    {/* underline if active */}
                    {isActive && (
                      <span className="mt-1 h-0.5 w-full bg-[var(--color-accent)] rounded-full" />
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
          <TooltipButton
            label="Menu"
            iconSrc="/svgs/menu.svg"
            onClick={() => setIsMenuOpen(true)}
            className="flex md:hidden"
          >
            <div
              className="relative flex h-9 w-9 items-center justify-center shrink-0 rounded-full bg-[var(--bg-primary)] transition hover:bg-[var(--card-bg)]"
              aria-label="Menu"
            >
              <img src="/svgs/menu.svg" className="h-5 w-5 svg-icon" />
            </div>
          </TooltipButton>
          <MenuDrawer
            open={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            tabs={navTabs}
          />

          {/* Notifications Button */}
          <TooltipButton
            label="Notification"
            iconSrc="/svgs/notification.svg"
            className="flex md:hidden"
          >
            <div
              className="relative flex h-9 w-9 items-center justify-center shrink-0 rounded-full bg-[var(--bg-primary)] transition hover:bg-[var(--card-bg)]"
              aria-label="Notifications"
            >
              <img src="/svgs/notification.svg" className="svg-icon" />
              <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                3
              </span>
            </div>
          </TooltipButton>

          {/* Profile Button */}
          <div onClick={() => setOpenProfile((prev) => !prev)}>
            <TooltipButton
              label="Profile"
              iconSrc={avatar}
              className="transition-transform flex-shrink-0 duration-150 ease-in-out active:scale-95"
            >
              <img
                src={avatar}
                alt="Profile"
                className="h-9 w-9 scale-110 rounded-full flex-shrink-0 object-cover"
              />
            </TooltipButton>
          </div>

          <ProfileSidebar isOpen={openProfile} setIsOpen={setOpenProfile} />
        </div>
      </div>
    </header>
  );
};

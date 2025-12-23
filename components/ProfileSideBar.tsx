"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { useUserAvatar } from "@/hooks/useUserAvatar";
import { useProfile } from "@/hooks/useProfile";
import { useRouter } from "next/navigation";

type NavItem = {
  label: string;
  icon: string;
  path: string;
};

type Props = {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const navItems: NavItem[] = [
  { label: "Profile", icon: "/svgs/profile.svg", path: "/profile" },
  { label: "Lists", icon: "/svgs/lists.svg", path: "/profile" },
  { label: "Saves", icon: "/svgs/save.svg", path: "/profile" },
  { label: "Logout", icon: "/svgs/logout.svg", path: "/signin" },
];

export default function ProfileSidebar({ isOpen, setIsOpen }: Props) {
  const avatar = useUserAvatar();
  const router = useRouter();
  const [clickedIndex, setClickedIndex] = useState<number | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Use React Query hook for cached profile data
  const { data: profile, isLoading: profileLoading } = useProfile();

  // Prevent hydration mismatch by only showing profile data after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEsc);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen, setIsOpen]);


  // Click handler with animation + optional logout logic
  async function handleClick(i: number, item: NavItem): Promise<void> {
    setClickedIndex(i);

    // logout special handling
    if (item.label === "Logout") {
      setTimeout(async () => {
        try {
          // 1. Clear server-side cookies
          await fetch("/api/auth/clearCookie", { method: "POST" });

          // 2. Clear client-side Supabase session as well
          await supabase.auth.signOut();
        } catch (err) {
          console.error("Error signing out:", err);
        } finally {
          // 3. Close dropdown
          setIsOpen(false);

          // 4. Redirect to signin page
          router.push("/signin");
        }
      }, 150);

      return;
    }

    if (item.path) {
      setTimeout(() => {
        setIsOpen(false);
        // Special handling for Saves button - navigate to activity tab with saves type
        if (item.label === "Saves") {
          router.push("/profile?tab=activity&type=saves");
        } else {
          router.push(item.path);
        }
      }, 150);
    }
  }

  return (
    <div
      ref={sidebarRef}
      className={`
        fixed top-0 right-0 h-full w-80 bg-[var(--card-bg)] shadow-xl transition-all duration-300 z-50
        ${isOpen ? "translate-x-0" : "translate-x-full"}
      `}
      aria-hidden={!isOpen}
    >
      <aside
        className="
          mt-14 mx-0
          w-full bg-[var(--card-bg)] text-[var(--text-primary)]
          rounded-l-xl
          p-6
          overflow-auto
          h-[calc(100vh-56px)]
          transition-colors
        "
        style={{ borderLeft: "3px solid var(--card-border)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <Image
            src={avatar || "/images/avatar_placeholder.png"}
            alt="avatar"
            width={64}
            height={64}
            className="w-16 h-16 rounded-full bg-black shrink-0 object-cover"
            priority
            unoptimized={!avatar || avatar.startsWith("/images/")}
          />
          <div>
            {!mounted || profileLoading ? (
              <>
                <div className="text-lg font-semibold leading-5 text-[var(--text-primary)]">
                  Loading...
                </div>
                <div className="text-sm text-[var(--text-secondary)] mt-1">
                  &nbsp;
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-semibold leading-5 text-[var(--text-primary)]">
                  {profile?.full_name ?? "Not Logged in"}
                </div>
                <div className="text-sm text-[var(--text-secondary)] mt-1">
                  {profile?.username ? `@${profile.username}` : "No username"}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Nav */}
        <div className="mt-10 space-y-8">
          {navItems.map((item, i) => (
            <button
              key={item.label}
              onClick={() => handleClick(i, item)}
              className={`
                flex items-center gap-4 w-full text-left
                text-base font-medium
                px-1 py-2
                transition-all duration-150
                hover:bg-[var(--bg-primary)]
                ${clickedIndex === i ? "scale-95 opacity-70" : ""}
              `}
              type="button"
              aria-pressed={clickedIndex === i}
            >
              <img
                src={item.icon}
                className="h-6 w-6 svg-icon"
                alt={`${item.label} icon`}
              />
              <span className="text-[var(--text-primary)]">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1" />
      </aside>
    </div>
  );
}

"use client";
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserAvatar } from "@/hooks/useUserAvatar";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

type NavItem = {
  label: string;
  icon: string;
  path: string;
};

type Profile = {
  full_name?: string | null;
  username?: string | null;
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const avatar = useUserAvatar();
  const router = useRouter();
  const [clickedIndex, setClickedIndex] = useState<number | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
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

  // Fetch profile when the sidebar opens
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;

    async function fetchProfile(): Promise<void> {
      try {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          console.error("Error getting auth user:", authError);
          return;
        }
        if (!authUser) return;

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, username")
          .eq("id", (authUser as User).id)
          .single();

        if (profileError) {
          console.error("Error fetching profile:", profileError);
          return;
        }

        if (mounted && data) {
          setProfile({ full_name: data.full_name ?? null, username: data.username ?? null });
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      }
    }

    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // Click handler with animation + optional logout logic
  async function handleClick(i: number, item: NavItem): Promise<void> {
    setClickedIndex(i);

    // logout special handling
    if (item.label === "Logout") {
      setTimeout(async () => {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.error("Error signing out:", err);
        } finally {
          setIsOpen(false);
          router.push(item.path);
        }
      }, 150);
      return;
    }

    if (item.path) {
      setTimeout(() => {
        setIsOpen(false);
        router.push(item.path);
      }, 150);
    }
  }

  return (
    <div
      ref={sidebarRef}
      className={`
        fixed top-0 right-0 h-full w-80 bg-white shadow-xl transition-transform duration-300 z-50
        ${isOpen ? "translate-x-0" : "translate-x-full"}
      `}
      aria-hidden={!isOpen}
    >
      <aside
        className="
          mt-14 mx-0
          w-full bg-white text-gray-900
          rounded-l-xl
          p-6
          overflow-auto
          h-[calc(100vh-56px)]
        "
        style={{ borderLeft: "3px solid rgba(0,0,0,0.03)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <img
            src={avatar}
            alt="avatar"
            className="w-16 h-16 rounded-full bg-black shrink-0 object-cover"
          />
          <div>
            <div className="text-lg font-semibold leading-5">
              {profile?.full_name ?? "Not Logged in"}
            </div>
            <div className="text-sm text-black mt-1">
              {profile?.username ? `@${profile.username}` : "No username"}
            </div>
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
                hover:bg-gray-50
                ${clickedIndex === i ? "scale-95 opacity-70" : ""}
              `}
              type="button"
              aria-pressed={clickedIndex === i}
            >
              <img src={item.icon} className="text-gray-400 h-6 w-6" alt={`${item.label} icon`} />
              <span className="text-gray-800">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1" />
      </aside>
    </div>
  );
}

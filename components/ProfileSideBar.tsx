"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserAvatar } from "@/hooks/useUserAvatar";

const navItems = [
  { label: "Profile", icon: "/svgs/profile.svg" },
  { label: "Lists", icon: "/svgs/lists.svg" },
  { label: "Saves", icon: "/svgs/save.svg" },
  { label: "Logout", icon: "/svgs/logout.svg" },
];

export default function ProfileSidebar() {
  const [user, setUser] = useState<{ name: string; username: string } | null>(
    null
  );
  const avatar = useUserAvatar();

  //   useEffect(() => {
  //     async function fetchUser() {
  //       try {
  //         const {
  //           data: { user },
  //         } = await supabase.auth.getUser();
  //       

  //         if (!user) return;

  //         const { data, error } = await supabase
  //           .from("profiles")
  //           .select("name, username")
  //           .eq("id", user.id)
  //           .single();
  //         console.log("Profile data:", data);
  //         if (error) {
  //           console.error("Error fetching profile:", error);
  //         } else if (data) {
  //           setUser({ name: data.name, username: data.username });
  //         }
  //       } catch (err) {
  //         console.error("Unexpected error fetching user:", err);
  //       }
  //     }

  //     fetchUser();
  //   }, []);

  useEffect(() => {
  async function fetchProfile() {
    try {
      // Get the authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        console.error("Error getting auth user:", authError);
        return;
      }

      if (!user) return;

      // Fetch the user's profile from the profiles table
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*") // select all columns
        .eq("id", user.id); // match profile to auth user

      if (profileError) {
        console.error("Error fetching profile:", profileError);
      } else {
        console.log("Profile data:", profileData); // ✅ logs the profile record(s)
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  }

  fetchProfile();
}, []);


  return (
    <aside
      className="
        fixed top-14 right-4 bottom-110 z-40
        w-80 max-w-full bg-white text-gray-900
        shadow-sm
        rounded-xl
        p-6
        overflow-auto
      "
      style={{ borderRight: "3px solid rgba(0,0,0,0.03)" }}
    >
      {/* Big avatar + header */}
      <div className="flex items-center gap-4">
        <img
          src={avatar}
          className="w-16 h-16 rounded-full bg-black shrink-0"
        />
        <div>
          <div className="text-lg font-semibold leading-5">
            {user ? user.name : "Not Logged in"}
          </div>
          <div className="text-sm text-black mt-1">
            {user ? `@${user.username}` : "No username"}
          </div>
        </div>
      </div>

      {/* spacing like the screenshot */}
      <div className="mt-10 space-y-8">
        {navItems.map((item) => (
          <NavItem key={item.label} icon={item.icon}>
            {item.label}
          </NavItem>
        ))}
      </div>

      <div className="flex-1" />
    </aside>
  );
}

function NavItem({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className="
        flex items-center gap-4 w-full text-left
        text-base font-medium
        hover:bg-gray-50
        transition-colors duration-150
        px-1 py-2
      "
    >
      <img src={icon} className="text-gray-400 h-6 w-6" />
      <span className="text-gray-800">{children}</span>
    </button>
  );
}

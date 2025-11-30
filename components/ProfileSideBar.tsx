"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserAvatar } from "@/hooks/useUserAvatar";

export default function ProfileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [fullName, setFullName] = useState<string | null>(null);
  const avatar = useUserAvatar();
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user) return;

      setFullName(user.user_metadata.full_name ?? "Profile");
    };

    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/signin");
  };

  return (
    <div
      className={`fixed top-0 text-black right-0 h-full w-64 bg-white shadow-xl p-6 transition-transform duration-300
        ${open ? "translate-x-0" : "translate-x-full"}
      `}
    >
      {/* Close button */}
      <button className="text-gray-500 mb-4" onClick={onClose}>
        ✕
      </button>

      {/* Avatar */}
      <div className="flex justify-center mb-4">
        <img
          src={avatar}
          alt="Profile Picture"
          className="w-20 h-20 rounded-full object-cover border"
        />
      </div>

      {/* Clickable Name */}
      <div
        className="text-xl font-semibold text-center cursor-pointer hover:text-blue-600"
        onClick={() => {
          onClose(); // close sidebar
          router.push("/profile");
        }}
      >
        {fullName}
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="mt-8 bg-red-500 text-white w-full py-2 rounded-lg hover:bg-red-600 transition"
      >
        Log Out
      </button>
    </div>
  );
}

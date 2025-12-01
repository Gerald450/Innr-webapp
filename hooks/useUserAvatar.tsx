"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useUserAvatar() {
  const [avatar, setAvatar] = useState<string>("/images/avatar_placeholder.png");

  useEffect(() => {
    const loadAvatar = async () => {
      try {
        // Get current user
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          console.error("Auth error:", authError);
          return;
        }
        const user = authData?.user;
        if (!user) return;

        // Fetch avatar from 'profiles' table
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Profile fetch error:", profileError);
          return;
        }

        if (profileData?.avatar_url) {
          setAvatar(profileData.avatar_url);
        }
      } catch (err) {
        console.error("Unexpected error fetching avatar:", err);
      }
    };

    loadAvatar();
  }, []);

  return avatar;
}

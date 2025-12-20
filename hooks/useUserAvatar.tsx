"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCachedProfile } from "@/utils/storage";

export function useUserAvatar() {
  const { data: avatar } = useQuery({
    queryKey: ["avatar"],
    queryFn: async (): Promise<string> => {
      // Check cache first
      const cached = getCachedProfile();
      if (cached?.avatar_url) {
        return cached.avatar_url;
      }

      // Get current user
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw new Error("Auth error");
      }
      const user = authData?.user;
      if (!user) {
        return "/images/avatar_placeholder.png";
      }

      // Fetch avatar from 'profiles' table
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .single();

      if (profileError) {
        // If profile not found, return placeholder
        if (profileError.code === "PGRST116") {
          return "/images/avatar_placeholder.png";
        }
        throw profileError;
      }

      return profileData?.avatar_url || "/images/avatar_placeholder.png";
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    placeholderData: "/images/avatar_placeholder.png",
  });

  return avatar || "/images/avatar_placeholder.png";
}

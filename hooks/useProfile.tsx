"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCachedProfile, setCachedProfile, setCachedUniversityId, setCachedUserRole } from "@/utils/storage";

type Profile = {
  id: string;
  full_name: string | null;
  graduation_year: number | null;
  avatar_url: string | null;
  role: string | null;
  university_id: string | null;
  program_of_study?: string | null;
  bio?: string | null;
  student_type?: string | null;
};

export function useProfile() {
  // Get cached profile for initial data
  const cachedProfile = getCachedProfile();

  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      // Get current authenticated user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Not authenticated");
      }

      // Fetch profile from Supabase
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, graduation_year, avatar_url, role, university_id, program_of_study, bio, student_type")
        .eq("id", user.id)
        .single();

      if (profileError) {
        // Check if it's a "not found" error
        if (profileError.code === "PGRST116" || profileError.message?.includes("No rows")) {
          return null; // Profile not found is a valid state
        }
        throw profileError;
      }

      // Cache the profile and related data
      if (profile) {
        setCachedProfile(profile);
        if (profile.university_id) {
          setCachedUniversityId(profile.university_id);
        }
        if (profile.role) {
          setCachedUserRole(profile.role);
        }
      }

      return profile;
    },
    placeholderData: cachedProfile || undefined, // Use cached data as placeholder
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors or not found errors
      if (error?.message === "Not authenticated" || error?.code === "PGRST116") {
        return false;
      }
      return failureCount < 3;
    },
  });
}


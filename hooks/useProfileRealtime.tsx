"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { invalidateProfile } from "@/utils/cacheInvalidation";
import { setCachedProfile } from "@/utils/storage";

/**
 * Hook to set up real-time subscription for profile changes
 * This ensures that when a user's profile (including avatar) is updated,
 * all components using the profile data will update in real-time
 */
export function useProfileRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let mounted = true;

    const setupSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      const userId = user.id;

      // Set up real-time subscription for profile changes
      channel = supabase
        .channel(`profile:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            // When profile is updated, invalidate React Query cache
            const updatedProfile = payload.new as any;
            
            // Invalidate profile and avatar queries
            invalidateProfile(queryClient, userId);
            queryClient.invalidateQueries({ queryKey: ["avatar"] });
            
            // Update cached profile in localStorage
            setCachedProfile(updatedProfile);
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);
}


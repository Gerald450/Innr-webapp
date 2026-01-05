"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useUnreadNotifications() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let channel: any = null;

    const loadUnreadCount = async () => {
      try {
        // Get current user
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          console.error("Auth error:", authError);
          if (mounted) {
            setLoading(false);
            setUnreadCount(0);
          }
          return;
        }
        const user = authData?.user;
        if (!user) {
          if (mounted) {
            setLoading(false);
            setUnreadCount(0);
          }
          return;
        }

        // Count unread notifications
        const { count, error: countError } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_read", false);

        if (countError) {
          console.error("Error fetching unread notifications count:", countError);
          if (mounted) {
            setLoading(false);
            setUnreadCount(0);
          }
          return;
        }

        if (mounted) {
          setUnreadCount(count || 0);
          setLoading(false);
        }
      } catch (err) {
        console.error("Unexpected error fetching unread notifications count:", err);
        if (mounted) {
          setLoading(false);
          setUnreadCount(0);
        }
      }
    };

    // Initial load
    loadUnreadCount();

    // Set up real-time subscription to listen for changes
    const setupSubscription = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      
      if (!user || !mounted) return;

      channel = supabase
        .channel(`notifications-changes-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            // Refetch count when notifications change
            // Add a small delay to ensure database transaction has completed
            if (mounted) {
              setTimeout(() => {
                if (mounted) {
                  loadUnreadCount();
                }
              }, 200);
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    // Listen for custom refresh events (e.g., when notifications are marked as read)
    const handleRefresh = () => {
      if (mounted) {
        // Add a small delay to ensure database update has completed
        setTimeout(() => {
          if (mounted) {
            loadUnreadCount();
          }
        }, 200);
      }
    };

    window.addEventListener("notifications-refresh", handleRefresh);

    return () => {
      mounted = false;
      window.removeEventListener("notifications-refresh", handleRefresh);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return { unreadCount, loading };
}

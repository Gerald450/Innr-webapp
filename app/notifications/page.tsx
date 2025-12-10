"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getRelativeTime } from "@/utils/relativeTime";

type NotificationType =
  | "new_follower"
  | "post_liked"
  | "comment_added"
  | "comment_replied"
  | "mentioned"
  | "system_announcement"
  | "event_created"
  | "event_reminder"
  | "message_received";

type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  event_id: string | null;
  conversation_id: string | null;
  is_read: boolean;
  metadata: any;
  created_at: string;
  actor?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
};

type GroupedNotification = {
  id: string; // Use the most recent notification's ID as the group ID
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  event_id: string | null;
  conversation_id: string | null;
  is_read: boolean;
  metadata: any;
  created_at: string; // Most recent timestamp
  actors: Array<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  }>;
  notificationIds: string[]; // All notification IDs in this group
};

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case "new_follower":
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case "post_liked":
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case "comment_added":
    case "comment_replied":
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case "mentioned":
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      );
    case "system_announcement":
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      );
    case "event_created":
    case "event_reminder":
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "message_received":
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      );
  }
};

const getNotificationText = (type: NotificationType, metadata: any = {}): string => {
  const safeMetadata = metadata || {};
  const snippet = safeMetadata.snippet ? `: "${safeMetadata.snippet}"` : "";

  switch (type) {
    case "new_follower":
      return "started following you";
    case "post_liked":
      return "liked your post";
    case "comment_added":
      return `commented on your post${snippet}`;
    case "comment_replied":
      return `replied to your comment${snippet}`;
    case "mentioned":
      return `mentioned you${snippet}`;
    case "system_announcement":
      return safeMetadata.title || "System announcement";
    case "event_created":
      return "created an event";
    case "event_reminder":
      return "Reminder: Event is coming up soon";
    case "message_received":
      return `sent you a message${snippet}`;
    default:
      return "New notification";
  }
};

const formatActorNames = (actors: Array<{ full_name: string | null }>, count: number): string => {
  if (count === 0) return "Someone";
  
  const validActors = actors.filter(a => a.full_name && a.full_name.trim()).map(a => a.full_name!);
  
  if (count === 1) {
    return validActors[0] || "Someone";
  } else if (count === 2) {
    if (validActors.length >= 2) {
      return `${validActors[0]} and ${validActors[1]}`;
    } else if (validActors.length === 1) {
      return `${validActors[0]} and 1 other`;
    } else {
      return "Someone and 1 other";
    }
  } else {
    const first = validActors[0] || "Someone";
    const others = count - 1;
    return `${first} and ${others} other${others > 1 ? "s" : ""}`;
  }
};

// Groups notifications by type and the relevant resource ID
const groupNotifications = (notifications: Notification[]): GroupedNotification[] => {
  // Types that should be grouped together
  const groupableTypes: NotificationType[] = [
    "post_liked",
    "comment_added",
    "comment_replied",
    "new_follower",
    "mentioned",
  ];

  const groups = new Map<string, Notification[]>();

  notifications.forEach((notification) => {
    // Only group certain types
    if (!groupableTypes.includes(notification.type)) {
      // Create a single-item group for non-groupable notifications
      const key = `single_${notification.id}`;
      groups.set(key, [notification]);
      return;
    }

    // Create a grouping key based on type and the relevant resource
    let groupKey = notification.type;
    
    if (notification.post_id) {
      groupKey += `_post_${notification.post_id}`;
    } else if (notification.comment_id) {
      groupKey += `_comment_${notification.comment_id}`;
    } else if (notification.event_id) {
      groupKey += `_event_${notification.event_id}`;
    } else if (notification.type === "new_follower") {
      // For followers, group all together (no specific resource)
      groupKey += "_followers";
    } else if (notification.type === "mentioned") {
      // For mentions, group by post_id if available
      groupKey += notification.post_id ? `_post_${notification.post_id}` : `_mention_${notification.id}`;
    } else {
      // Fallback: create unique group
      groupKey += `_${notification.id}`;
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(notification);
  });

  // Convert groups to GroupedNotification objects
  return Array.from(groups.entries()).map(([_, group]) => {
    // Sort by created_at descending (most recent first)
    const sortedGroup = [...group].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const firstNotification = sortedGroup[0];
    const actors = sortedGroup
      .filter((n) => n.actor)
      .map((n) => n.actor!)
      // Remove duplicates by actor ID
      .filter((actor, index, self) => 
        index === self.findIndex(a => a.id === actor.id)
      );

    return {
      id: firstNotification.id,
      type: firstNotification.type,
      post_id: firstNotification.post_id,
      comment_id: firstNotification.comment_id,
      event_id: firstNotification.event_id,
      conversation_id: firstNotification.conversation_id,
      is_read: sortedGroup.every((n) => n.is_read),
      metadata: firstNotification.metadata,
      created_at: firstNotification.created_at,
      actors,
      notificationIds: sortedGroup.map((n) => n.id),
    };
  });
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [groupedNotifications, setGroupedNotifications] = useState<GroupedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;

    const loadNotifications = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get current authenticated user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          console.error("Auth error while loading notifications:", authError);
          if (!mounted) return;
          setError("Error checking authentication.");
          return;
        }

        if (!user) {
          if (!mounted) return;
          setError("You must be signed in to see notifications.");
          return;
        }

        // Fetch notifications for the current user
        const { data: notificationsData, error: notificationsErr } = await supabase
          .from("notifications")
          .select(
            `
            id,
            user_id,
            type,
            actor_id,
            post_id,
            comment_id,
            event_id,
            conversation_id,
            is_read,
            metadata,
            created_at,
            actor:profiles!actor_id (
              id,
              full_name,
              avatar_url
            )
          `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100);

        if (notificationsErr) {
          console.error("Error loading notifications:", notificationsErr);
          if (!mounted) return;
          setError("Unable to load notifications.");
          return;
        }

        if (!mounted) return;

        // Transform the data to match our type
        const transformed: Notification[] = (notificationsData || []).map((n: any) => ({
          id: n.id,
          user_id: n.user_id,
          type: n.type,
          actor_id: n.actor_id,
          post_id: n.post_id,
          comment_id: n.comment_id,
          event_id: n.event_id,
          conversation_id: n.conversation_id,
          is_read: n.is_read,
          metadata: n.metadata,
          created_at: n.created_at,
          actor: n.actor
            ? {
                id: n.actor.id,
                full_name: n.actor.full_name,
                avatar_url: n.actor.avatar_url,
              }
            : undefined,
        }));

        setNotifications(transformed);
        
        // Group notifications
        const grouped = groupNotifications(transformed);
        // Sort grouped notifications by most recent
        grouped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setGroupedNotifications(grouped);
      } catch (err) {
        console.error("Unexpected error loading notifications:", err);
        if (mounted) setError("Unexpected error loading notifications.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadNotifications();

    return () => {
      mounted = false;
    };
  }, []);

  // Regroup notifications whenever the notifications array changes
  useEffect(() => {
    const grouped = groupNotifications(notifications);
    grouped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setGroupedNotifications(grouped);
  }, [notifications]);

  const handleNotificationClick = async (groupedNotification: GroupedNotification) => {
    // Mark all notifications in the group as read if not already read
    const unreadIds = groupedNotification.notificationIds.filter((id) => {
      const notif = notifications.find((n) => n.id === id);
      return notif && !notif.is_read;
    });

    if (unreadIds.length > 0) {
      const idsToMark = unreadIds.filter((id) => !markingRead.has(id));
      idsToMark.forEach((id) => setMarkingRead((prev) => new Set(prev).add(id)));

      try {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .in("id", idsToMark);

        // Update local state
        setNotifications((prev) =>
          prev.map((n) =>
            idsToMark.includes(n.id) ? { ...n, is_read: true } : n
          )
        );

        // Update grouped notifications
        setGroupedNotifications((prev) =>
          prev.map((g) =>
            g.id === groupedNotification.id
              ? { ...g, is_read: true }
              : g
          )
        );
      } catch (err) {
        console.error("Error marking notifications as read:", err);
      } finally {
        idsToMark.forEach((id) =>
          setMarkingRead((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          })
        );
      }
    }

    // Navigate based on notification type
    if (groupedNotification.post_id) {
      router.push(`/posts/${groupedNotification.post_id}`);
    } else if (groupedNotification.event_id) {
      router.push(`/events/${groupedNotification.event_id}`);
    } else if (groupedNotification.type === "new_follower" && groupedNotification.actors.length > 0) {
      // For new followers, navigate to the first follower's profile
      router.push(`/users/${groupedNotification.actors[0].id}`);
    } else if (groupedNotification.conversation_id) {
      router.push(`/chats`);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );

      // Update grouped notifications
      setGroupedNotifications((prev) =>
        prev.map((g) => ({ ...g, is_read: true }))
      );
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="bg-[var(--bg-primary)] min-h-screen py-10 flex flex-col items-center transition-colors">
        <div className="w-full max-w-2xl px-4">
          <div className="text-center py-12">
            <div className="text-sm text-[var(--text-secondary)]">Loading notifications...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--bg-primary)] min-h-screen py-10 flex flex-col items-center transition-colors">
        <div className="w-full max-w-2xl px-4">
          <div className="text-center py-12">
            <div className="text-sm text-red-500 mb-2">{error}</div>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-primary)] min-h-screen py-10 flex flex-col items-center transition-colors">
      <div className="w-full max-w-2xl px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Notifications</h1>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm text-[var(--color-accent)] hover:underline font-medium"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Notifications List */}
        {groupedNotifications.length === 0 ? (
          <div className="text-center py-12 bg-[var(--card-bg)] rounded-lg border border-[var(--card-border)]">
            <div className="text-sm text-[var(--text-secondary)] mb-2">
              No notifications yet
            </div>
            <div className="text-xs text-[var(--text-secondary)] opacity-70">
              When someone interacts with your content, you'll see it here.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {groupedNotifications.map((groupedNotification) => {
              const actorCount = groupedNotification.actors.length;
              const hasActors = actorCount > 0;
              const firstActor = hasActors ? groupedNotification.actors[0] : undefined;
              const actorNames = formatActorNames(groupedNotification.actors, actorCount);

              return (
                <div
                  key={groupedNotification.id}
                  onClick={() => handleNotificationClick(groupedNotification)}
                  className={`
                    relative flex items-start gap-3 p-4 rounded-lg border transition-all cursor-pointer
                    ${
                      groupedNotification.is_read
                        ? "bg-[var(--card-bg)] border-[var(--card-border)] hover:bg-[var(--bg-primary)]"
                        : "bg-[var(--card-bg)] border-[var(--color-accent)]/30 hover:border-[var(--color-accent)]/50 hover:bg-[var(--bg-primary)]"
                    }
                  `}
                >
                  {/* Actor Avatar */}
                  <div className="relative flex-shrink-0">
                    {!groupedNotification.is_read && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[var(--color-accent)] rounded-full border-2 border-[var(--card-bg)] z-10" />
                    )}
                    {hasActors && firstActor?.avatar_url ? (
                      <img
                        src={firstActor.avatar_url}
                        alt={firstActor.full_name || "User"}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : hasActors ? (
                      <div className="h-10 w-10 rounded-full bg-[var(--bg-primary)] flex items-center justify-center">
                        <svg className="w-6 h-6 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)]">
                        {getNotificationIcon(groupedNotification.type)}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Icon for system notifications */}
                        {!hasActors && (
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-[var(--color-accent)]">
                              {getNotificationIcon(groupedNotification.type)}
                            </div>
                          </div>
                        )}
                        
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                          {hasActors ? (
                            <>
                              <span className="font-semibold">
                                {actorNames}
                              </span>{" "}
                              {getNotificationText(groupedNotification.type, groupedNotification.metadata)}
                            </>
                          ) : (
                            getNotificationText(groupedNotification.type, groupedNotification.metadata)
                          )}
                        </p>

                        {/* Metadata snippet for messages/comments */}
                        {groupedNotification.metadata?.snippet && (
                          <p className="text-xs text-[var(--text-secondary)] mt-1 italic truncate">
                            {groupedNotification.metadata.snippet}
                          </p>
                        )}
                      </div>

                      {/* Time */}
                      <span className="text-xs text-[var(--text-secondary)] shrink-0 whitespace-nowrap">
                        {getRelativeTime(groupedNotification.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef, memo, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getRelativeTime } from "@/utils/relativeTime";

const COMMENTS_PER_PAGE = 10;
const REPLIES_PER_PAGE = 10;

// Component to render comment body with clickable mentions
const CommentBodyWithMentions = ({ 
  body, 
  mentionedUserId, 
  mentionedUser 
}: { 
  body: string; 
  mentionedUserId?: string | null; 
  mentionedUser?: { id: string; username: string; full_name: string | null };
}) => {
  // Parse @username mentions and render them as links
  const parseMentions = (text: string) => {
    // Pattern to match @username (alphanumeric and underscore)
    const mentionPattern = /@(\w+)/g;
    const parts: Array<{ text: string; isMention: boolean; userId?: string; username?: string }> = [];
    let lastIndex = 0;
    let match;
    let isFirstMention = true;

    while ((match = mentionPattern.exec(text)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push({ text: text.slice(lastIndex, match.index), isMention: false });
      }

      const mentionedUsername = match[1];
      
      // If we have a mentioned_user_id and mentionedUser, make the FIRST @mention clickable
      // This handles the case where we're replying to a reply (the @username at the start)
      // Handles username changes by using mentioned_user_id instead of text matching
      if (isFirstMention && mentionedUserId && mentionedUser && mentionedUser.id === mentionedUserId) {
        // Use the stored user info (current username, even if text has old username)
        parts.push({ 
          text: `@${mentionedUsername}`, 
          isMention: true, 
          userId: mentionedUser.id,
          username: mentionedUser.username || mentionedUsername // Use current username
        });
        isFirstMention = false;
      } else {
        // Other @mentions in text - render as plain text (not clickable)
        // In future, could resolve these by querying username, but for now keep simple
        parts.push({ text: `@${mentionedUsername}`, isMention: false });
        isFirstMention = false;
      }

      lastIndex = mentionPattern.lastIndex;
    }

    // Add remaining text after last mention
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), isMention: false });
    }

    // If no mentions found, return original text as single part
    if (parts.length === 0) {
      parts.push({ text, isMention: false });
    }

    return parts;
  };

  const parts = parseMentions(body);

  return (
    <p className="text-sm text-[var(--text-primary)] mb-2 whitespace-pre-line">
      {parts.map((part, index) => {
        if (part.isMention && part.userId) {
          return (
            <Link
              key={index}
              href={`/users/${part.userId}`}
              className="text-[var(--color-accent)] font-semibold hover:underline"
            >
              @{part.username || part.text.replace("@", "")}
            </Link>
          );
        }
        return <span key={index}>{part.text}</span>;
      })}
    </p>
  );
};

type Comment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  parent_comment_id: string | null;
  mentioned_user_id?: string | null;
  author: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    graduation_year: number | null;
  };
  mentioned_user?: {
    id: string;
    username: string;
    full_name: string | null;
  };
  likeCount?: number;
  isLiked?: boolean;
  replies?: Comment[];
  totalReplies?: number;
  repliesCursor?: string; // For cursor-based pagination
  hasMoreReplies?: boolean;
  isRepliesExpanded?: boolean;
  isLoadingReplies?: boolean;
};

type CommentsProps = {
  postId: string;
};

export default function Comments({ postId }: CommentsProps) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [commentsCursor, setCommentsCursor] = useState<string | null>(null); // Cursor for pagination
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set()); // Track which comments have expanded replies
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Reset pagination when postId changes
    setCommentsCursor(null);
    setComments([]);
    setHasMore(true);
    setExpandedComments(new Set());
    loadComments(null, false);
  }, [postId]);

  // Focus comment textarea if hash is present
  useEffect(() => {
    const handleHashFocus = () => {
      if (window.location.hash === "#comments" && commentTextareaRef.current && !loading) {
        // Small delay to ensure the page has fully rendered
        setTimeout(() => {
          commentTextareaRef.current?.focus();
          commentTextareaRef.current?.scrollIntoView({ 
            behavior: "smooth", 
            block: "center" 
          });
          // Remove hash after focusing to allow re-focusing if needed
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }, 300);
      }
    };

    // Check on mount and when loading completes
    handleHashFocus();

    // Also listen for hash changes
    window.addEventListener("hashchange", handleHashFocus);
    return () => window.removeEventListener("hashchange", handleHashFocus);
  }, [loading]); // Run after comments are loaded

  // Load top-level comments with cursor-based pagination
  const loadComments = useCallback(async (cursor: string | null, append: boolean = false) => {
    try {
      // Build query with cursor-based pagination
      let query = supabase
        .from("comments")
        .select(
          `
          id,
          body,
          created_at,
          author_id,
          parent_comment_id,
          mentioned_user_id,
          profiles!comments_author_id_fkey (
            full_name,
            username,
            avatar_url,
            graduation_year
          )
        `
        )
        .eq("post_id", postId)
        .eq("is_deleted", false)
        .is("parent_comment_id", null)
        .order("created_at", { ascending: true })
        .limit(COMMENTS_PER_PAGE + 1); // Fetch one extra to check if there's more

      // Apply cursor if provided
      if (cursor) {
        query = query.gt("created_at", cursor);
      }

      const { data: rootCommentsData, error: rootError } = await query;

      if (rootError) {
        console.error("Error loading root comments:", rootError);
        if (!append) setLoading(false);
        return;
      }

      if (!rootCommentsData || rootCommentsData.length === 0) {
        if (!append) {
          setComments([]);
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
        setHasMore(false);
        return;
      }

      // Check if there are more comments (we fetched one extra)
      const hasMoreData = rootCommentsData.length > COMMENTS_PER_PAGE;
      const commentsToProcess = hasMoreData 
        ? rootCommentsData.slice(0, COMMENTS_PER_PAGE)
        : rootCommentsData;

      // Set cursor for next page (use the last comment's created_at)
      const lastComment = commentsToProcess[commentsToProcess.length - 1];
      setCommentsCursor(lastComment.created_at);
      setHasMore(hasMoreData);

      // Get root comment IDs to fetch reply counts
      const rootCommentIds = commentsToProcess.map((row: any) => row.id);

      // Get reply counts only (don't fetch reply data yet)
      const { data: replyCountsData } = await supabase
        .from("comments")
        .select("parent_comment_id")
        .eq("post_id", postId)
        .eq("is_deleted", false)
        .in("parent_comment_id", rootCommentIds);

      // Count replies per root comment
      const replyCountMap: Record<string, number> = {};
      (replyCountsData || []).forEach((row: any) => {
        const parentId = row.parent_comment_id;
        replyCountMap[parentId] = (replyCountMap[parentId] || 0) + 1;
      });

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      // Get like counts for root comments only
      const { data: likesData } = await supabase
        .from("comment_likes")
        .select("comment_id, user_id")
        .in("comment_id", rootCommentIds);

      // Create maps for quick lookup
      const likeCountMap: Record<string, number> = {};
      const userLikedSet = new Set<string>();

      (likesData || []).forEach((like: any) => {
        likeCountMap[like.comment_id] = (likeCountMap[like.comment_id] || 0) + 1;
        if (userId && like.user_id === userId) {
          userLikedSet.add(like.comment_id);
        }
      });

      // Map root comments (without replies - they'll be loaded on demand)
      const rootComments: Comment[] = commentsToProcess.map((row: any) => {
        const existingComment = append 
          ? comments.find(c => c.id === row.id)
          : null;

        // Preserve expanded state and loaded replies if comment already exists
        return {
          id: row.id,
          body: row.body,
          created_at: row.created_at,
          author_id: row.author_id,
          parent_comment_id: row.parent_comment_id,
          author: {
            full_name: row.profiles?.full_name || null,
            username: row.profiles?.username || null,
            avatar_url: row.profiles?.avatar_url || null,
            graduation_year: row.profiles?.graduation_year || null,
          },
          mentioned_user_id: row.mentioned_user_id || null,
          likeCount: likeCountMap[row.id] || 0,
          isLiked: userLikedSet.has(row.id),
          replies: existingComment?.replies || [],
          totalReplies: replyCountMap[row.id] || 0,
          repliesCursor: existingComment?.repliesCursor || undefined,
          hasMoreReplies: existingComment?.hasMoreReplies || false,
          isRepliesExpanded: existingComment?.isRepliesExpanded || expandedComments.has(row.id),
          isLoadingReplies: false,
        };
      });

      // Append or replace comments based on pagination
      if (append) {
        setComments((prev) => {
          // Merge with existing comments, preserving expanded state
          const existingIds = new Set(prev.map(c => c.id));
          const newComments = rootComments.map(newComment => {
            const existing = prev.find(c => c.id === newComment.id);
            if (existing) {
              // Preserve expanded replies
              return {
                ...newComment,
                replies: existing.replies,
                isRepliesExpanded: existing.isRepliesExpanded,
                repliesCursor: existing.repliesCursor,
                hasMoreReplies: existing.hasMoreReplies,
              };
            }
            return newComment;
          });
          return [...prev, ...newComments.filter(c => !existingIds.has(c.id))];
        });
      } else {
        setComments(rootComments);
      }
    } catch (err) {
      console.error("Unexpected error loading comments:", err);
    } finally {
      if (!append) setLoading(false);
      else setLoadingMore(false);
    }
  }, [postId, comments, expandedComments]);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be signed in to comment.");
        return;
      }

      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        author_id: user.id,
        body: newComment.trim(),
        parent_comment_id: null,
      });

      if (error) {
        console.error("Error creating comment:", error);
        alert("Failed to post comment. Please try again.");
        return;
      }

      // Optimistic update: add comment immediately (user already fetched above)
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, username, avatar_url, graduation_year")
          .eq("id", user.id)
          .single();

        const optimisticComment: Comment = {
          id: `temp-${Date.now()}`,
          body: newComment.trim(),
          created_at: new Date().toISOString(),
          author_id: user.id,
          parent_comment_id: null,
          mentioned_user_id: null,
          author: {
            full_name: profile?.full_name || null,
            username: profile?.username || null,
            avatar_url: profile?.avatar_url || null,
            graduation_year: profile?.graduation_year || null,
          },
          likeCount: 0,
          isLiked: false,
          replies: [],
          totalReplies: 0,
          hasMoreReplies: false,
          isRepliesExpanded: false,
        };

        setComments((prev) => [optimisticComment, ...prev]);
      }

      setNewComment("");
      // Reload to get the real comment with proper ID
      setCommentsCursor(null);
      setHasMore(true);
      loadComments(null, false);
    } catch (err) {
      console.error("Unexpected error creating comment:", err);
      alert("Failed to post comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (
    topLevelCommentId: string, 
    replyText: string, 
    mentionedUserId: string | null,
    onSuccess: () => void
  ) => {
    if (!replyText.trim()) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be signed in to reply.");
        return;
      }

      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        author_id: user.id,
        body: replyText.trim(),
        parent_comment_id: topLevelCommentId, // Always point to top-level comment
        mentioned_user_id: mentionedUserId, // Set if replying to a reply
      });

      if (error) {
        console.error("Error creating reply:", error);
        alert("Failed to post reply. Please try again.");
        return;
      }

      onSuccess();
      // Optimistic update: add reply immediately if parent is expanded (user already fetched above)
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, username, avatar_url, graduation_year")
          .eq("id", user.id)
          .single();

        // Fetch mentioned user profile if mentioned
        let mentionedUserProfile = null;
        if (mentionedUserId) {
          const { data } = await supabase
            .from("profiles")
            .select("id, username, full_name")
            .eq("id", mentionedUserId)
            .single();
          mentionedUserProfile = data;
        }

        setComments((prev) =>
          prev.map((comment) => {
            if (comment.id === topLevelCommentId && comment.isRepliesExpanded) {
              const optimisticReply: Comment = {
                id: `temp-${Date.now()}`,
                body: replyText.trim(),
                created_at: new Date().toISOString(),
                author_id: user.id,
                parent_comment_id: topLevelCommentId,
                mentioned_user_id: mentionedUserId,
                author: {
                  full_name: profile?.full_name || null,
                  username: profile?.username || null,
                  avatar_url: profile?.avatar_url || null,
                  graduation_year: profile?.graduation_year || null,
                },
                mentioned_user: mentionedUserProfile ? {
                  id: mentionedUserProfile.id,
                  username: mentionedUserProfile.username,
                  full_name: mentionedUserProfile.full_name,
                } : undefined,
                likeCount: 0,
                isLiked: false,
                replies: [],
              };

              return {
                ...comment,
                replies: [...(comment.replies || []), optimisticReply],
                totalReplies: (comment.totalReplies || 0) + 1,
              };
            }
            return comment;
          })
        );
      }

      // Reload replies for the top-level comment to get the real reply
      if (expandedComments.has(topLevelCommentId)) {
        loadReplies(topLevelCommentId, null, true);
      }
    } catch (err) {
      console.error("Unexpected error creating reply:", err);
      alert("Failed to post reply. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentLike = async (commentId: string, currentlyLiked: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be signed in to like comments.");
        return;
      }

      if (currentlyLiked) {
        // Unlike the comment
        const { error } = await supabase
          .from("comment_likes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", user.id);

        if (error) {
          console.error("Error unliking comment:", error);
          return;
        }
      } else {
        // Like the comment
        const { error } = await supabase
          .from("comment_likes")
          .insert({
            comment_id: commentId,
            user_id: user.id,
          });

        if (error) {
          // If it's a unique constraint error, the like already exists
          if (error.code !== "23505") {
            console.error("Error liking comment:", error);
            return;
          }
        }
      }

      // Update like count optimistically
      setComments((prev) =>
        prev.map((comment) => {
          if (comment.id === commentId) {
            return {
              ...comment,
              isLiked: !currentlyLiked,
              likeCount: (comment.likeCount || 0) + (currentlyLiked ? -1 : 1),
            };
          }
          // Also update in replies
          if (comment.replies) {
            return {
              ...comment,
              replies: comment.replies.map((reply) => {
                if (reply.id === commentId) {
                  return {
                    ...reply,
                    isLiked: !currentlyLiked,
                    likeCount: (reply.likeCount || 0) + (currentlyLiked ? -1 : 1),
                  };
                }
                return reply;
              }),
            };
          }
          return comment;
        })
      );
    } catch (err) {
      console.error("Unexpected error toggling comment like:", err);
    }
  };

  // Load replies for a specific comment (only when expanded)
  const loadReplies = useCallback(async (parentCommentId: string, cursor: string | null, append: boolean = false) => {
    const parentComment = comments.find(c => c.id === parentCommentId);
    if (!parentComment) return;

    // Set loading state
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === parentCommentId
          ? { ...comment, isLoadingReplies: true }
          : comment
      )
    );

    try {
      // Build query with cursor-based pagination
      let query = supabase
        .from("comments")
        .select(
          `
          id,
          body,
          created_at,
          author_id,
          parent_comment_id,
          mentioned_user_id,
          profiles!comments_author_id_fkey (
            full_name,
            username,
            avatar_url,
            graduation_year
          ),
          mentioned_user:profiles!comments_mentioned_user_id_fkey (
            id,
            username,
            full_name
          )
        `
        )
        .eq("post_id", postId)
        .eq("is_deleted", false)
        .eq("parent_comment_id", parentCommentId)
        .order("created_at", { ascending: true })
        .limit(REPLIES_PER_PAGE + 1); // Fetch one extra to check if there's more

      // Apply cursor if provided
      if (cursor) {
        query = query.gt("created_at", cursor);
      }

      const { data: repliesData, error: repliesError } = await query;

      if (repliesError) {
        console.error("Error loading replies:", repliesError);
        return;
      }

      if (!repliesData || repliesData.length === 0) {
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === parentCommentId
              ? { ...comment, isLoadingReplies: false, hasMoreReplies: false }
              : comment
          )
        );
        return;
      }

      // Check if there are more replies
      const hasMoreRepliesData = repliesData.length > REPLIES_PER_PAGE;
      const repliesToProcess = hasMoreRepliesData
        ? repliesData.slice(0, REPLIES_PER_PAGE)
        : repliesData;

      // Set cursor for next page
      const lastReply = repliesToProcess[repliesToProcess.length - 1];
      const nextCursor = lastReply.created_at;

      // Get current user for like status
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      // Get like counts for replies
      const replyIds = repliesToProcess.map((row: any) => row.id);
      const { data: likesData } = await supabase
        .from("comment_likes")
        .select("comment_id, user_id")
        .in("comment_id", replyIds);

      const likeCountMap: Record<string, number> = {};
      const userLikedSet = new Set<string>();

      (likesData || []).forEach((like: any) => {
        likeCountMap[like.comment_id] = (likeCountMap[like.comment_id] || 0) + 1;
        if (userId && like.user_id === userId) {
          userLikedSet.add(like.comment_id);
        }
      });

      // Map replies
      const newReplies: Comment[] = repliesToProcess.map((row: any) => ({
        id: row.id,
        body: row.body,
        created_at: row.created_at,
        author_id: row.author_id,
        parent_comment_id: row.parent_comment_id,
        mentioned_user_id: row.mentioned_user_id || null,
        author: {
          full_name: row.profiles?.full_name || null,
          username: row.profiles?.username || null,
          avatar_url: row.profiles?.avatar_url || null,
          graduation_year: row.profiles?.graduation_year || null,
        },
        mentioned_user: row.mentioned_user ? {
          id: row.mentioned_user.id,
          username: row.mentioned_user.username,
          full_name: row.mentioned_user.full_name,
        } : undefined,
        likeCount: likeCountMap[row.id] || 0,
        isLiked: userLikedSet.has(row.id),
        replies: [],
      }));

      // Update the parent comment with replies
      setComments((prev) =>
        prev.map((comment) => {
          if (comment.id === parentCommentId) {
            const existingReplies = append ? (comment.replies || []) : [];
            // Filter out duplicates by ID to prevent duplicate keys
            const existingIds = new Set(existingReplies.map(r => r.id));
            const uniqueNewReplies = newReplies.filter(r => !existingIds.has(r.id));
            const updatedReplies = [...existingReplies, ...uniqueNewReplies];
            
            return {
              ...comment,
              replies: updatedReplies,
              repliesCursor: nextCursor,
              hasMoreReplies: hasMoreRepliesData,
              isLoadingReplies: false,
            };
          }
          return comment;
        })
      );
    } catch (err) {
      console.error("Unexpected error loading replies:", err);
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === parentCommentId
            ? { ...comment, isLoadingReplies: false }
            : comment
        )
      );
    }
  }, [postId, comments]);

  // Toggle replies expansion
  const toggleReplies = useCallback((commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const isExpanded = expandedComments.has(commentId);
    
    if (!isExpanded) {
      // Expand: load replies if not already loaded
      setExpandedComments((prev) => new Set([...prev, commentId]));
      
      if (!comment.replies || comment.replies.length === 0) {
        loadReplies(commentId, null, false);
      }
    } else {
      // Collapse: just hide replies (keep them in state)
      setExpandedComments((prev) => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    }

    // Update comment state
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, isRepliesExpanded: !isExpanded }
          : c
      )
    );
  }, [comments, expandedComments, loadReplies]);

  const CommentItem = memo(({ comment, depth = 0, onToggleReplies, onLoadMoreReplies, topLevelCommentId }: { 
    comment: Comment; 
    depth?: number;
    onToggleReplies?: (commentId: string) => void;
    onLoadMoreReplies?: (commentId: string, cursor: string) => void;
    topLevelCommentId?: string; // The top-level comment ID (same as comment.id if depth=0)
  }) => {
    const commentRouter = useRouter();
    const [isReplying, setIsReplying] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [isLiking, setIsLiking] = useState(false);
    const [mentionedUserId, setMentionedUserId] = useState<string | null>(null);
    const [autocompleteQuery, setAutocompleteQuery] = useState("");
    const [autocompleteResults, setAutocompleteResults] = useState<Array<{ id: string; username: string; full_name: string | null }>>([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteCursor, setAutocompleteCursor] = useState(0);
    const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
    const autocompleteRef = useRef<HTMLDivElement>(null);
    const autocompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Determine top-level comment ID
    const effectiveTopLevelId = topLevelCommentId || comment.id;

    // Check if this is a reply (has parent_comment_id)
    const isReply = !!comment.parent_comment_id;

    // Focus reply textarea when it becomes visible
    useEffect(() => {
      if (isReplying && replyTextareaRef.current) {
        // Small delay to ensure the textarea is rendered
        const timeoutId = setTimeout(() => {
          const textarea = replyTextareaRef.current;
          if (textarea) {
            textarea.focus();
            // Move cursor to end if text is prefilled
            if (replyText) {
              textarea.setSelectionRange(replyText.length, replyText.length);
            }
          }
        }, 0);
        return () => clearTimeout(timeoutId);
      }
    }, [isReplying, replyText]);

    // Handle autocomplete search
    useEffect(() => {
      if (autocompleteTimeoutRef.current) {
        clearTimeout(autocompleteTimeoutRef.current);
      }

      if (!showAutocomplete || !autocompleteQuery.trim()) {
        setAutocompleteResults([]);
        return;
      }

      autocompleteTimeoutRef.current = setTimeout(async () => {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, username, full_name")
            .ilike("username", `${autocompleteQuery}%`)
            .limit(5);

          if (error) {
            console.error("Autocomplete error:", error);
            setAutocompleteResults([]);
          } else {
            setAutocompleteResults(data || []);
          }
        } catch (err) {
          console.error("Autocomplete failed:", err);
          setAutocompleteResults([]);
        }
      }, 300); // Debounce 300ms

      return () => {
        if (autocompleteTimeoutRef.current) {
          clearTimeout(autocompleteTimeoutRef.current);
        }
      };
    }, [autocompleteQuery, showAutocomplete]);

    // Handle textarea input changes for @mention detection
    const handleReplyTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setReplyText(text);

      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = text.slice(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex !== -1) {
        const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
        // Check if there's a space after @, meaning mention ended
        if (textAfterAt.includes(" ") || textAfterAt.includes("\n")) {
          setShowAutocomplete(false);
          setAutocompleteQuery("");
        } else {
          // Extract query after @
          setAutocompleteQuery(textAfterAt);
          setShowAutocomplete(true);
          setAutocompleteCursor(lastAtIndex);
        }
      } else {
        setShowAutocomplete(false);
        setAutocompleteQuery("");
      }
    };

    // Handle autocomplete selection
    const handleAutocompleteSelect = (user: { id: string; username: string }) => {
      const textBeforeCursor = replyText.slice(0, autocompleteCursor + 1);
      const textAfterMention = replyText.slice(autocompleteCursor + 1 + autocompleteQuery.length);
      const newText = `${textBeforeCursor}${user.username} ${textAfterMention}`;
      setReplyText(newText);
      setShowAutocomplete(false);
      setAutocompleteQuery("");
      
      // Focus back to textarea and position cursor after the inserted username
      setTimeout(() => {
        if (replyTextareaRef.current) {
          const newCursorPos = autocompleteCursor + 1 + user.username.length + 1;
          replyTextareaRef.current.focus();
          replyTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    };

    // Handle click outside to close autocomplete
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          showAutocomplete &&
          autocompleteRef.current &&
          replyTextareaRef.current &&
          !autocompleteRef.current.contains(event.target as Node) &&
          !replyTextareaRef.current.contains(event.target as Node)
        ) {
          setShowAutocomplete(false);
        }
      };

      if (showAutocomplete) {
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
      }
    }, [showAutocomplete]);

    // Handle clicking Reply button
    const handleReplyClick = () => {
      if (isReplying) {
        // Cancel reply
        setReplyText("");
        setIsReplying(false);
        setMentionedUserId(null);
        setShowAutocomplete(false);
      } else {
        // Start reply - always prefill @username (whether replying to comment or reply)
        setIsReplying(true);
        const usernameToMention = comment.author.username || comment.author.full_name?.replace(/\s+/g, "_").toLowerCase() || "user";
        setReplyText(`@${usernameToMention} `);
        setMentionedUserId(comment.author_id);
      }
    };

    const handleReplySubmit = () => {
      handleSubmitReply(effectiveTopLevelId, replyText, mentionedUserId, () => {
        setReplyText("");
        setIsReplying(false);
        setMentionedUserId(null);
        setShowAutocomplete(false);
      });
    };

    const handleCancelReply = () => {
      setReplyText("");
      setIsReplying(false);
      setMentionedUserId(null);
      setShowAutocomplete(false);
    };

    const handleLike = async () => {
      if (isLiking) return;
      setIsLiking(true);
      await handleCommentLike(comment.id, comment.isLiked || false);
      setIsLiking(false);
    };

    return (
      <div className={`${depth > 0 ? "ml-6 mt-3" : ""} border-l-2 border-[var(--card-border)] pl-4`}>
        <div className="flex gap-3">
          {comment.author_id ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                commentRouter.push(`/users/${comment.author_id}`);
              }}
              className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-[var(--color-accent)] transition-all"
            >
              <Image
                src={comment.author.avatar_url || "/images/avatar_placeholder.png"}
                alt={comment.author.full_name || "User"}
                width={32}
                height={32}
                className="h-full w-full object-cover"
                loading="lazy"
                unoptimized={!comment.author.avatar_url || comment.author.avatar_url.startsWith("/images/")}
              />
            </button>
          ) : (
            <Image
              src={comment.author.avatar_url || "/images/avatar_placeholder.png"}
              alt={comment.author.full_name || "User"}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover flex-shrink-0"
              loading="lazy"
              unoptimized={!comment.author.avatar_url || comment.author.avatar_url.startsWith("/images/")}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {comment.author_id ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    commentRouter.push(`/users/${comment.author_id}`);
                  }}
                  className="font-semibold text-sm text-[var(--text-primary)] hover:text-[var(--color-accent)] transition-colors"
                >
                  {comment.author.full_name || "Anonymous"}
                </button>
              ) : (
                <span className="font-semibold text-sm text-[var(--text-primary)]">
                  {comment.author.full_name || "Anonymous"}
                </span>
              )}
              <span className="text-xs text-[var(--text-secondary)]">
                {getRelativeTime(comment.created_at)}
              </span>
            </div>
            <CommentBodyWithMentions 
              body={comment.body}
              mentionedUserId={comment.mentioned_user_id}
              mentionedUser={comment.mentioned_user}
            />
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={handleLike}
                disabled={isLiking}
                className={`flex items-center gap-1.5 text-xs transition-colors ${
                  comment.isLiked
                    ? "text-[var(--color-accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                } disabled:opacity-50`}
              >
                <svg
                  className={`w-4 h-4 ${comment.isLiked ? "fill-current" : ""}`}
                  fill={comment.isLiked ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                  />
                </svg>
                {comment.likeCount && comment.likeCount > 0 && (
                  <span>{comment.likeCount}</span>
                )}
              </button>
              <button
                onClick={handleReplyClick}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                {isReplying ? "Cancel" : "Reply"}
              </button>
            </div>
            {isReplying && (
              <div className="mt-2 mb-3 relative">
                <textarea
                  ref={replyTextareaRef}
                  value={replyText}
                  onChange={handleReplyTextChange}
                  placeholder="Write a reply..."
                  rows={2}
                  className="w-full p-2 border border-[var(--card-border)] rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-[var(--text-primary)] bg-[var(--card-bg)] transition-colors"
                />
                {/* Autocomplete dropdown */}
                {showAutocomplete && autocompleteResults.length > 0 && (
                  <div
                    ref={autocompleteRef}
                    className="absolute z-50 mt-1 w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-md shadow-lg max-h-48 overflow-y-auto"
                  >
                    {autocompleteResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleAutocompleteSelect(user)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-primary)] text-left transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {user.full_name || user.username}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] truncate">
                            @{user.username}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleReplySubmit}
                    disabled={submitting || !replyText.trim()}
                    className="px-3 py-1.5 bg-[var(--color-accent)] text-white text-xs rounded-md hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] disabled:opacity-50 transition"
                  >
                    {submitting ? "Posting..." : "Post Reply"}
                  </button>
                  <button
                    onClick={handleCancelReply}
                    className="px-3 py-1.5 border border-[var(--card-border)] text-xs rounded-md hover:bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {/* View Replies Button - Show if not expanded and has replies */}
            {!comment.isRepliesExpanded && comment.totalReplies && comment.totalReplies > 0 && onToggleReplies && (
              <button
                onClick={() => onToggleReplies(comment.id)}
                className="mt-2 text-sm font-medium text-[var(--color-accent)] hover:underline"
              >
                View replies ({comment.totalReplies})
              </button>
            )}

            {/* Replies List - Show if expanded */}
            {comment.isRepliesExpanded && (
              <div className="mt-3">
                {comment.isLoadingReplies && (!comment.replies || comment.replies.length === 0) ? (
                  <div className="text-sm text-[var(--text-secondary)] py-2">Loading replies...</div>
                ) : comment.replies && comment.replies.length > 0 ? (
                  <>
                    {comment.replies.map((reply) => (
                      <CommentItem 
                        key={reply.id} 
                        comment={reply} 
                        depth={1}
                        topLevelCommentId={effectiveTopLevelId}
                        onToggleReplies={onToggleReplies}
                        onLoadMoreReplies={onLoadMoreReplies}
                      />
                    ))}
                    {comment.hasMoreReplies && comment.repliesCursor && onLoadMoreReplies && (
                      <button
                        onClick={() => {
                          if (comment.isLoadingReplies) return;
                          onLoadMoreReplies(comment.id, comment.repliesCursor!);
                        }}
                        disabled={comment.isLoadingReplies}
                        className="mt-2 px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--bg-primary)] rounded-md border border-[var(--card-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {comment.isLoadingReplies ? "Loading..." : "Load more replies"}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-[var(--text-secondary)] py-2">No replies yet</div>
                )}
                {/* Collapse button */}
                {onToggleReplies && (
                  <button
                    onClick={() => onToggleReplies(comment.id)}
                    className="mt-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Hide replies
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  });

  CommentItem.displayName = "CommentItem";

  if (loading) {
    return (
      <div className="text-center py-8 text-sm text-[var(--text-secondary)]">Loading comments...</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comment Input */}
      <div id="comments" className="border-b border-[var(--card-border)] pb-4">
        <textarea
          ref={commentTextareaRef}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          rows={3}
          className="w-full p-3 border border-[var(--card-border)] rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-[var(--text-primary)] bg-[var(--card-bg)] transition-colors"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSubmitComment}
            disabled={submitting || !newComment.trim()}
            className="px-4 py-2 bg-[var(--color-accent)] text-white text-sm rounded-md hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] disabled:opacity-50 transition"
          >
            {submitting ? "Posting..." : "Post Comment"}
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--text-secondary)]">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          <>
            {comments.map((comment) => (
              <CommentItem 
                key={comment.id} 
                comment={comment}
                depth={0}
                topLevelCommentId={comment.id}
                onToggleReplies={toggleReplies}
                onLoadMoreReplies={(commentId, cursor) => loadReplies(commentId, cursor, true)}
              />
            ))}
            
            {/* View More Comments */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => {
                    if (loadingMore) return;
                    setLoadingMore(true);
                    loadComments(commentsCursor, true);
                  }}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-md text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-primary)] hover:border-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? "Loading..." : "Load more comments"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


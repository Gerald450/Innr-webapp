"use client";

import { useEffect, useState, useRef, memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getRelativeTime } from "@/utils/relativeTime";

const COMMENTS_PER_PAGE = 10;
const REPLIES_PER_PAGE = 10;

type Comment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  parent_comment_id: string | null;
  author: {
    full_name: string | null;
    avatar_url: string | null;
    graduation_year: number | null;
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
          profiles (
            full_name,
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
            avatar_url: row.profiles?.avatar_url || null,
            graduation_year: row.profiles?.graduation_year || null,
          },
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
          .select("full_name, avatar_url, graduation_year")
          .eq("id", user.id)
          .single();

        const optimisticComment: Comment = {
          id: `temp-${Date.now()}`,
          body: newComment.trim(),
          created_at: new Date().toISOString(),
          author_id: user.id,
          parent_comment_id: null,
          author: {
            full_name: profile?.full_name || null,
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

  const handleSubmitReply = async (parentId: string, replyText: string, onSuccess: () => void) => {
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
        parent_comment_id: parentId,
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
          .select("full_name, avatar_url, graduation_year")
          .eq("id", user.id)
          .single();

        setComments((prev) =>
          prev.map((comment) => {
            if (comment.id === parentId && comment.isRepliesExpanded) {
              const optimisticReply: Comment = {
                id: `temp-${Date.now()}`,
                body: replyText.trim(),
                created_at: new Date().toISOString(),
                author_id: user.id,
                parent_comment_id: parentId,
                author: {
                  full_name: profile?.full_name || null,
                  avatar_url: profile?.avatar_url || null,
                  graduation_year: profile?.graduation_year || null,
                },
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

      // Reload replies for the parent comment to get the real reply
      if (expandedComments.has(parentId)) {
        loadReplies(parentId, null, true);
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
          profiles (
            full_name,
            avatar_url,
            graduation_year
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
        author: {
          full_name: row.profiles?.full_name || null,
          avatar_url: row.profiles?.avatar_url || null,
          graduation_year: row.profiles?.graduation_year || null,
        },
        likeCount: likeCountMap[row.id] || 0,
        isLiked: userLikedSet.has(row.id),
        replies: [],
      }));

      // Update the parent comment with replies
      setComments((prev) =>
        prev.map((comment) => {
          if (comment.id === parentCommentId) {
            const existingReplies = append ? (comment.replies || []) : [];
            const updatedReplies = [...existingReplies, ...newReplies];
            
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

  const CommentItem = memo(({ comment, depth = 0, onToggleReplies, onLoadMoreReplies }: { 
    comment: Comment; 
    depth?: number;
    onToggleReplies?: (commentId: string) => void;
    onLoadMoreReplies?: (commentId: string, cursor: string) => void;
  }) => {
    const commentRouter = useRouter();
    const [isReplying, setIsReplying] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [isLiking, setIsLiking] = useState(false);
    const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
    const maxDepth = 3; // Limit nesting depth

    // Focus reply textarea when it becomes visible
    useEffect(() => {
      if (isReplying && replyTextareaRef.current) {
        // Small delay to ensure the textarea is rendered
        const timeoutId = setTimeout(() => {
          replyTextareaRef.current?.focus();
        }, 0);
        return () => clearTimeout(timeoutId);
      }
    }, [isReplying]);

    const handleReplySubmit = () => {
      handleSubmitReply(comment.id, replyText, () => {
        setReplyText("");
        setIsReplying(false);
      });
    };

    const handleCancelReply = () => {
      setReplyText("");
      setIsReplying(false);
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
              <img
                src={comment.author.avatar_url || "/images/avatar_placeholder.png"}
                alt={comment.author.full_name || "User"}
                className="h-full w-full object-cover"
              />
            </button>
          ) : (
            <img
              src={comment.author.avatar_url || "/images/avatar_placeholder.png"}
              alt={comment.author.full_name || "User"}
              className="h-8 w-8 rounded-full object-cover flex-shrink-0"
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
            <p className="text-sm text-[var(--text-primary)] mb-2 whitespace-pre-line">
              {comment.body}
            </p>
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
              {depth < maxDepth && (
                <button
                  onClick={() => setIsReplying(!isReplying)}
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  {isReplying ? "Cancel" : "Reply"}
                </button>
              )}
            </div>
            {isReplying && (
              <div className="mt-2 mb-3">
                <textarea
                  ref={replyTextareaRef}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  rows={2}
                  className="w-full p-2 border border-[var(--card-border)] rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-[var(--text-primary)] bg-[var(--card-bg)] transition-colors"
                />
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
                        depth={depth + 1}
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


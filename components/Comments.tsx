"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

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
};

type CommentsProps = {
  postId: string;
};

export default function Comments({ postId }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadComments();
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

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
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
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading comments:", error);
        return;
      }

      // Get all comment IDs
      const commentIds = (data || []).map((row: any) => row.id);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      // Get like counts for all comments
      const { data: likesData } = await supabase
        .from("comment_likes")
        .select("comment_id, user_id")
        .in("comment_id", commentIds);

      // Create maps for quick lookup
      const likeCountMap: Record<string, number> = {};
      const userLikedSet = new Set<string>();

      // Count likes per comment and track user's likes
      (likesData || []).forEach((like: any) => {
        likeCountMap[like.comment_id] = (likeCountMap[like.comment_id] || 0) + 1;
        if (userId && like.user_id === userId) {
          userLikedSet.add(like.comment_id);
        }
      });

      // Organize comments into a tree structure
      const commentsMap = new Map<string, Comment>();
      const rootComments: Comment[] = [];

      (data || []).forEach((row: any) => {
        const comment: Comment = {
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
        };

        commentsMap.set(comment.id, comment);

        if (comment.parent_comment_id) {
          const parent = commentsMap.get(comment.parent_comment_id);
          if (parent) {
            if (!parent.replies) parent.replies = [];
            parent.replies.push(comment);
          }
        } else {
          rootComments.push(comment);
        }
      });

      setComments(rootComments);
    } catch (err) {
      console.error("Unexpected error loading comments:", err);
    } finally {
      setLoading(false);
    }
  };

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

      setNewComment("");
      loadComments(); // Reload comments
    } catch (err) {
      console.error("Unexpected error creating comment:", err);
      alert("Failed to post comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
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

      setReplyText("");
      setReplyingTo(null);
      loadComments(); // Reload comments
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

      // Reload comments to update like counts
      loadComments();
    } catch (err) {
      console.error("Unexpected error toggling comment like:", err);
    }
  };

  const CommentItem = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => {
    const isReplying = replyingTo === comment.id;
    const maxDepth = 3; // Limit nesting depth
    const [isLiking, setIsLiking] = useState(false);

    const handleLike = async () => {
      if (isLiking) return;
      setIsLiking(true);
      await handleCommentLike(comment.id, comment.isLiked || false);
      setIsLiking(false);
    };

    return (
      <div className={`${depth > 0 ? "ml-6 mt-3" : ""} border-l-2 border-neutral-200 pl-4`}>
        <div className="flex gap-3">
          <img
            src={comment.author.avatar_url || "/images/avatar_placeholder.png"}
            alt={comment.author.full_name || "User"}
            className="h-8 w-8 rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-slate-900">
                {comment.author.full_name || "Anonymous"}
              </span>
              {comment.author.graduation_year && (
                <span className="text-xs text-slate-500">
                  {String(comment.author.graduation_year).slice(-2)}
                </span>
              )}
              <span className="text-xs text-slate-500">
                {new Date(comment.created_at).toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-slate-700 mb-2 whitespace-pre-line">
              {comment.body}
            </p>
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={handleLike}
                disabled={isLiking}
                className={`flex items-center gap-1.5 text-xs transition-colors ${
                  comment.isLiked
                    ? "text-[var(--color-accent)]"
                    : "text-slate-500 hover:text-slate-700"
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
                  onClick={() => setReplyingTo(isReplying ? null : comment.id)}
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  {isReplying ? "Cancel" : "Reply"}
                </button>
              )}
            </div>
            {isReplying && (
              <div className="mt-2 mb-3">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  rows={2}
                  className="w-full p-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleSubmitReply(comment.id)}
                    disabled={submitting || !replyText.trim()}
                    className="px-3 py-1.5 bg-[var(--color-accent)] text-white text-xs rounded-md hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] disabled:opacity-50 transition"
                  >
                    {submitting ? "Posting..." : "Post Reply"}
                  </button>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText("");
                    }}
                    className="px-3 py-1.5 border text-xs rounded-md hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {comment.replies && comment.replies.length > 0 && (
              <div className="mt-3">
                {comment.replies.map((reply) => (
                  <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-sm text-slate-500">Loading comments...</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comment Input */}
      <div id="comments" className="border-b border-neutral-200 pb-4">
        <textarea
          ref={commentTextareaRef}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          rows={3}
          className="w-full p-3 border rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-black"
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
          <div className="text-center py-8 text-sm text-slate-500">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </div>
  );
}


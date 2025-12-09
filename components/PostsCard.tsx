// app/components/Post.tsx
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import TooltipButton from "./TooltipButton";
import { getRelativeTime } from "@/utils/relativeTime";

interface PostProps {
  id: string | number;
  name: string;
  gradYear?: string;
  avatar?: string;
  authorId?: string; // User ID of the post author
  text: string;
  created_at?: string; // ISO timestamp string
  image?: string;
  images?: string[]; // Multiple images for carousel
  likeCount?: number;
  isLiked?: boolean;
  commentCount?: number;
  repostCount?: number;
  isReposted?: boolean;
  bookmarkCount?: number;
  isBookmarked?: boolean;
  onLikeChange?: (postId: string | number, newLikeCount: number, isLiked: boolean) => void;
  onRepostChange?: (postId: string | number, newRepostCount: number, isReposted: boolean) => void;
  onBookmarkChange?: (postId: string | number, newBookmarkCount: number, isBookmarked: boolean) => void;
  isAuthor?: boolean; // Whether the current user is the author
  showMenu?: boolean; // Whether to show the three-dot menu (only on detail page)
  onPostUpdate?: (postId: string | number, newText: string) => void; // Callback when post is updated
  onPostDelete?: (postId: string | number) => void; // Callback when post is deleted
}

export const Post: React.FC<PostProps> = ({
  id,
  name,
  gradYear,
  avatar,
  authorId,
  text,
  created_at,
  image,
  images,
  likeCount: initialLikeCount = 0,
  isLiked: initialIsLiked = false,
  commentCount = 0,
  repostCount: initialRepostCount = 0,
  isReposted: initialIsReposted = false,
  bookmarkCount: initialBookmarkCount = 0,
  isBookmarked: initialIsBookmarked = false,
  onLikeChange,
  onRepostChange,
  onBookmarkChange,
  isAuthor = false,
  showMenu = false,
  onPostUpdate,
  onPostDelete,
}) => {
  const router = useRouter();
  const [liked, setLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLiking, setIsLiking] = useState(false);
  const [commented, setCommented] = useState(false);
  const [reposted, setReposted] = useState(initialIsReposted);
  const [repostCount, setRepostCount] = useState(initialRepostCount);
  const [isReposting, setIsReposting] = useState(false);
  const [bookmarked, setBookmarked] = useState(initialIsBookmarked);
  const [bookmarkCount, setBookmarkCount] = useState(initialBookmarkCount);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Update state when props change
  useEffect(() => {
    setLiked(initialIsLiked);
    setLikeCount(initialLikeCount);
    setReposted(initialIsReposted);
    setRepostCount(initialRepostCount);
    setBookmarked(initialIsBookmarked);
    setBookmarkCount(initialBookmarkCount);
    setEditedText(text);
  }, [initialIsLiked, initialLikeCount, initialIsReposted, initialRepostCount, initialIsBookmarked, initialBookmarkCount, text]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);
  
  // Carousel state
  const imageList = images && images.length > 0 ? images : image ? [image] : [];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const hasMultipleImages = imageList.length > 1;

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % imageList.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + imageList.length) % imageList.length);
  };

  const goToImage = (index: number) => {
    setCurrentImageIndex(index);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent post click
    if (isLiking) return;

    setIsLiking(true);
    const newLikedState = !liked;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("User not authenticated");
        setIsLiking(false);
        return;
      }

      if (newLikedState) {
        // Like the post
        const { error } = await supabase
          .from("post_likes")
          .insert({
            post_id: id,
            user_id: user.id,
          });

        if (error) {
          // If it's a unique constraint error, the like already exists
          if (error.code !== "23505") {
            console.error("Error liking post:", error);
            setIsLiking(false);
            return;
          }
        }
        setLiked(true);
        setLikeCount((prev) => prev + 1);
        onLikeChange?.(id, likeCount + 1, true);
      } else {
        // Unlike the post
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", id)
          .eq("user_id", user.id);

        if (error) {
          console.error("Error unliking post:", error);
          setIsLiking(false);
          return;
        }
        setLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
        onLikeChange?.(id, Math.max(0, likeCount - 1), false);
      }
    } catch (err) {
      console.error("Unexpected error toggling like:", err);
    } finally {
      setIsLiking(false);
    }
  };

  const handleRepost = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent post click
    if (isReposting) return;

    setIsReposting(true);
    const newRepostedState = !reposted;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("User not authenticated");
        setIsReposting(false);
        return;
      }

      if (newRepostedState) {
        // Repost the post
        const { error } = await supabase
          .from("reposts")
          .insert({
            post_id: id,
            user_id: user.id,
            comment: null, // Can add comment modal later if needed
          });

        if (error) {
          // If it's a unique constraint error, the repost already exists
          if (error.code !== "23505") {
            console.error("Error reposting:", error);
            setIsReposting(false);
            return;
          }
        }
        setReposted(true);
        setRepostCount((prev) => prev + 1);
        onRepostChange?.(id, repostCount + 1, true);
      } else {
        // Unrepost the post
        const { error } = await supabase
          .from("reposts")
          .delete()
          .eq("post_id", id)
          .eq("user_id", user.id);

        if (error) {
          console.error("Error unreposting:", error);
          setIsReposting(false);
          return;
        }
        setReposted(false);
        setRepostCount((prev) => Math.max(0, prev - 1));
        onRepostChange?.(id, Math.max(0, repostCount - 1), false);
      }
    } catch (err) {
      console.error("Unexpected error toggling repost:", err);
    } finally {
      setIsReposting(false);
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent post click
    if (isBookmarking) return;

    setIsBookmarking(true);
    const newBookmarkedState = !bookmarked;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("User not authenticated");
        setIsBookmarking(false);
        return;
      }

      if (newBookmarkedState) {
        // Bookmark the post
        const { error } = await supabase
          .from("bookmarks")
          .insert({
            post_id: id,
            user_id: user.id,
          });

        if (error) {
          // If it's a unique constraint error, the bookmark already exists
          if (error.code !== "23505") {
            console.error("Error bookmarking:", error);
            setIsBookmarking(false);
            return;
          }
        }
        setBookmarked(true);
        setBookmarkCount((prev) => prev + 1);
        onBookmarkChange?.(id, bookmarkCount + 1, true);
      } else {
        // Unbookmark the post
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("post_id", id)
          .eq("user_id", user.id);

        if (error) {
          console.error("Error unbookmarking:", error);
          setIsBookmarking(false);
          return;
        }
        setBookmarked(false);
        setBookmarkCount((prev) => Math.max(0, prev - 1));
        onBookmarkChange?.(id, Math.max(0, bookmarkCount - 1), false);
      }
    } catch (err) {
      console.error("Unexpected error toggling bookmark:", err);
    } finally {
      setIsBookmarking(false);
    }
  };

  const handleEdit = async () => {
    if (isEditing) return;
    if (!editedText.trim()) {
      alert("Post text cannot be empty");
      return;
    }

    setIsEditing(true);
    try {
      const { error } = await supabase
        .from("posts")
        .update({ body: editedText.trim() })
        .eq("id", id);

      if (error) {
        console.error("Error updating post:", error);
        alert("Failed to update post. Please try again.");
        setIsEditing(false);
        return;
      }

      setEditModalOpen(false);
      setMenuOpen(false);
      onPostUpdate?.(id, editedText.trim());
    } catch (err) {
      console.error("Unexpected error updating post:", err);
      alert("Failed to update post. Please try again.");
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("posts")
        .update({ is_deleted: true })
        .eq("id", id);

      if (error) {
        console.error("Error deleting post:", error);
        alert("Failed to delete post. Please try again.");
        setIsDeleting(false);
        return;
      }

      setDeleteModalOpen(false);
      setMenuOpen(false);
      onPostDelete?.(id);
    } catch (err) {
      console.error("Unexpected error deleting post:", err);
      alert("Failed to delete post. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <article className="w-full max-w-xl md:max-w-2xl mx-auto bg-[var(--card-bg)] rounded-lg shadow-sm border border-[var(--card-border)] mb-[10px] transition-colors">

      {/* TOP ROW */}
      <header className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4">
        {authorId ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/users/${authorId}`);
            }}
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-full overflow-hidden bg-[var(--bg-primary)] flex-shrink-0 hover:ring-2 hover:ring-[var(--color-accent)] transition-all"
          >
            <img
              src={avatar || "/images/avatar_placeholder.png"}
              className="h-full w-full object-cover"
              alt={`${name} avatar`}
            />
          </button>
        ) : (
          <img
            src={avatar || "/images/avatar_placeholder.png"}
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover bg-[var(--bg-primary)] flex-shrink-0"
            alt={`${name} avatar`}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0">
              {authorId ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/users/${authorId}`);
                  }}
                  className="font-semibold text-[var(--text-primary)] text-sm leading-none truncate flex items-center gap-1 hover:text-[var(--color-accent)] transition-colors"
                >
                  <span className="truncate">{name}</span>
                  {gradYear && (
                    <span className="flex items-center gap-1 text-[var(--text-secondary)] text-xs shrink-0">
                      <img
                        src="/svgs/graduate.svg"
                        alt="Graduate cap"
                        className="h-3 w-3 object-contain svg-icon"
                      />
                      <span className="leading-none">{gradYear}</span>
                    </span>
                  )}
                </button>
              ) : (
                <p className="font-semibold text-[var(--text-primary)] text-sm leading-none truncate flex items-center gap-1">
                  <span className="truncate">{name}</span>
                  {gradYear && (
                    <span className="flex items-center gap-1 text-[var(--text-secondary)] text-xs shrink-0">
                      <img
                        src="/svgs/graduate.svg"
                        alt="Graduate cap"
                        className="h-3 w-3 object-contain svg-icon"
                      />
                      <span className="leading-none">{gradYear}</span>
                    </span>
                  )}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)] ml-1 shrink-0">
                {created_at ? getRelativeTime(created_at) : "just now"}
              </span>
              
              {/* Three-dot menu - only show on detail page for author */}
              {showMenu && isAuthor && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(!menuOpen);
                    }}
                    className="p-1.5 rounded-full hover:bg-[var(--bg-primary)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    aria-label="Post options"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {menuOpen && (
                    <div className="absolute right-0 top-10 z-50 w-48 bg-[var(--card-bg)] rounded-lg shadow-lg border border-[var(--card-border)] py-1 transition-colors">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditModalOpen(true);
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors flex items-center gap-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteModalOpen(true);
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* TEXT */}
      <div className="px-3 sm:px-4 pb-3 border-b border-[var(--card-border)]">
        <p className="text-[var(--text-primary)] text-sm leading-relaxed whitespace-pre-line">
          {text}
        </p>
      </div>

      {/* IMAGE SECTION – full width, no padding with carousel */}
      {imageList.length > 0 && (
        <div className="w-full bg-black relative">
          <div className="w-full max-h-[80vh] overflow-hidden bg-[var(--bg-primary)] relative">
            {/* Carousel Container */}
            <div className="relative w-full">
              {imageList.map((img, index) => (
                <div
                  key={index}
                  className={`transition-opacity duration-500 ${
                    index === currentImageIndex ? "opacity-100 relative" : "opacity-0 absolute inset-0"
                  }`}
                >
                  <img
                    src={img}
                    alt={`Post Media ${index + 1}`}
                    className="w-full h-auto object-cover"
                    style={{ display: "block" }}
                  />
                </div>
              ))}

              {/* Navigation Arrows - Fixed position, centered vertically on image */}
              {hasMultipleImages && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all duration-200 hover:scale-110 z-20"
                    style={{ 
                      top: "35%",
                      transform: "translateY(-50%)"
                    }}
                    aria-label="Previous image"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all duration-200 hover:scale-110 z-20"
                    style={{ 
                      top: "35%",
                      transform: "translateY(-50%)"
                    }}
                    aria-label="Next image"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </>
              )}

              {/* Carousel Indicators - Only show if multiple images */}
              {hasMultipleImages && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                  {imageList.map((_, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        goToImage(index);
                      }}
                      className={`transition-all duration-200 rounded-full ${
                        index === currentImageIndex
                          ? "bg-white w-8 h-2"
                          : "bg-white/50 w-2 h-2 hover:bg-white/75"
                      }`}
                      aria-label={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Image Counter - Only show if multiple images */}
              {hasMultipleImages && (
                <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
                  {currentImageIndex + 1} / {imageList.length}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACTION BAR */}
      <div className="flex justify-between items-center py-2 text-[var(--text-secondary)] border-t border-[var(--card-border)] px-3 sm:px-4">
        <div className="flex w-full justify-between">

          <TooltipButton
            label="Like"
            as="button"
            onClick={handleLike}
            disabled={isLiking}
            className={`flex items-center justify-center gap-1.5 flex-1 p-2 rounded-md transition-all duration-300 ${
              liked
                ? "text-[var(--color-accent)] scale-110"
                : "hover:text-[var(--text-primary)] hover:scale-105"
            } active:scale-95 disabled:opacity-50`}
          >
            <img
              src="/svgs/like.svg"
              alt="Like"
              className={`h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 svg-icon ${
                liked ? "scale-125 rotate-12" : ""
              }`}
            />
            {likeCount > 0 && (
              <span className="text-xs font-medium">{likeCount}</span>
            )}
          </TooltipButton>

          <TooltipButton
            label="Comments"
            as="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/posts/${id}#comments`);
            }}
            className={`flex items-center justify-center gap-1.5 flex-1 p-2 rounded-md transition-all duration-300 ${
              commented
                ? "text-[var(--color-accent)] scale-110"
                : "hover:text-[var(--text-primary)] hover:scale-105"
            } active:scale-95`}
          >
            <img
              src="/svgs/comment.svg"
              alt="Comment"
              className={`h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 svg-icon ${
                commented ? "scale-125" : ""
              }`}
            />
            {commentCount > 0 && (
              <span className="text-xs font-medium">{commentCount}</span>
            )}
          </TooltipButton>

          <TooltipButton
            label="Repost"
            as="button"
            onClick={handleRepost}
            disabled={isReposting}
            className={`flex items-center justify-center gap-1.5 flex-1 p-2 rounded-md transition-all duration-300 ${
              reposted
                ? "text-[var(--color-accent)] scale-110"
                : "hover:text-[var(--text-primary)] hover:scale-105"
            } active:scale-95 disabled:opacity-50`}
          >
            <img
              src="/svgs/repost.svg"
              alt="Repost"
              className={`h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 svg-icon ${
                reposted ? "scale-125 rotate-180" : ""
              }`}
            />
            {repostCount > 0 && (
              <span className="text-xs font-medium">{repostCount}</span>
            )}
          </TooltipButton>

          <TooltipButton
            label="Save"
            as="button"
            onClick={handleBookmark}
            disabled={isBookmarking}
            className={`flex items-center justify-center gap-1.5 flex-1 p-2 rounded-md transition-all duration-300 ${
              bookmarked
                ? "text-[var(--color-accent)] scale-110"
                : "hover:text-[var(--text-primary)] hover:scale-105"
            } active:scale-95 disabled:opacity-50`}
          >
            <svg
              className={`h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${
                bookmarked ? "fill-current scale-125" : ""
              }`}
              fill={bookmarked ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            {bookmarkCount > 0 && (
              <span className="text-xs font-medium">{bookmarkCount}</span>
            )}
          </TooltipButton>

        </div>
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="bg-[var(--card-bg)] rounded-lg shadow-xl w-full max-w-lg p-6 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Edit Post</h2>
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full min-h-[120px] p-3 border border-[var(--card-border)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent text-sm bg-[var(--bg-primary)] text-[var(--text-primary)]"
              placeholder="What's on your mind?"
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditedText(text);
                }}
                className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-primary)] rounded-lg hover:bg-[var(--card-bg)] transition-colors"
                disabled={isEditing}
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={isEditing || !editedText.trim() || editedText.trim() === text}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-accent)] rounded-lg hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,black)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEditing ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="bg-[var(--card-bg)] rounded-lg shadow-xl w-full max-w-md p-6 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Delete Post</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-primary)] rounded-lg hover:bg-[var(--card-bg)] transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};

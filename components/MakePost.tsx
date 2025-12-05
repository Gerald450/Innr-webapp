// app/components/MakePost.tsx
"use client";

import Image from "next/image";

type MakePostProps = {
  placeholder?: string;
  onStartPost?: () => void;
  onVideoClick?: () => void;
  onPhotoClick?: () => void;
  onArticleClick?: () => void;
};

export function MakePost({
  placeholder = "Start a post",
  onStartPost,
  onVideoClick,
  onPhotoClick,
  onArticleClick,
}: MakePostProps) {
  return (
    <div className="w-full max-w-2xl rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 shadow-sm transition-colors">
      {/* Top row: avatar + input */}
      <div className="flex items-center gap-3">

        <button
          type="button"
          onClick={onStartPost}
          className="flex-1 rounded-full border border-[var(--card-border)] bg-[var(--bg-primary)] px-4 py-2 text-left text-sm text-[var(--text-secondary)]
                     hover:bg-[var(--card-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-colors"
        >
          {placeholder}
        </button>
      </div>

      {/* Bottom row: actions */}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs sm:text-sm">
        <ActionButton label="Video" onClick={onVideoClick} iconType="video" />
        <ActionButton label="Photo" onClick={onPhotoClick} iconType="photo" />
        <ActionButton
          label="Write article"
          onClick={onArticleClick}
          iconType="article"
        />
      </div>
    </div>
  );
}

type ActionButtonProps = {
  label: string;
  onClick?: () => void;
  iconType: "video" | "photo" | "article";
};

function ActionButton({ label, onClick, iconType }: ActionButtonProps) {
  // simple inline SVG icons so you don't need any extra libs
  const icon = {
    video: (
      <svg
        className="h-5 w-5 flex-shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M4 5h11a2 2 0 0 1 2 2v2.382l2.553-1.702A1 1 0 0 1 21 8.528v6.944a1 1 0 0 1-1.447.848L17 14.618V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      </svg>
    ),
    photo: (
      <svg
        className="h-5 w-5 flex-shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M4 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H4zm3 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-2 9 3.5-4.5 2.5 3 3.5-4.5L20 17H5z" />
      </svg>
    ),
    article: (
      <svg
        className="h-5 w-5 flex-shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M6 4a2 2 0 0 0-2 2v12.5A1.5 1.5 0 0 0 5.5 20H18a2 2 0 0 0 2-2V8.414a2 2 0 0 0-.586-1.414l-2.414-2.414A2 2 0 0 0 15.586 4H6zm8 1.5V8h2.5L14 5.5zM8 10h8v1.5H8V10zm0 3h6v1.5H8V13zm0 3h4v1.5H8V16z" />
      </svg>
    ),
  }[iconType];

  const baseColor =
    iconType === "video"
      ? "text-[var(--color-accent)]"
      : iconType === "photo"
      ? "text-[var(--color-accent)]"
      : "text-[var(--color-accent)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2 text-[var(--text-secondary)]
                 hover:bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--card-border)] transition-colors"
    >
      <span className={baseColor}>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

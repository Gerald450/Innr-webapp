// app/components/Post.tsx
import React, { useState } from "react";

interface PostProps {
  name: string;
  gradYear?: string;
  avatar?: string;
  text: string;
  time?: string;
  image?: string;
  images?: string[]; // Multiple images for carousel
}

export const Post: React.FC<PostProps> = ({
  name,
  gradYear,
  avatar,
  text,
  time = "2w",
  image,
  images,
}) => {
  const [liked, setLiked] = useState(false);
  const [commented, setCommented] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  
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
  return (
    <article className="w-full max-w-xl md:max-w-2xl mx-auto bg-white rounded-lg shadow-sm border border-neutral-200 mb-5">

      {/* TOP ROW */}
      <header className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4">
        <img
          src={avatar || "/images/avatar_placeholder.png"}
          className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover bg-gray-300 flex-shrink-0"
          alt={`${name} avatar`}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0">
              <p className="font-semibold text-neutral-900 text-sm leading-none truncate flex items-center gap-1">
                <span className="truncate">{name}</span>
                {gradYear && (
                  <span className="flex items-center gap-1 text-neutral-500 text-xs shrink-0">
                    <img
                      src="/svgs/graduate.svg"
                      alt="Graduate cap"
                      className="h-3 w-3 object-contain"
                    />
                    <span className="leading-none">{gradYear}</span>
                  </span>
                )}
              </p>
            </div>

            <span className="text-xs text-neutral-500 ml-1 shrink-0">
              {time}
            </span>
          </div>
        </div>
      </header>

      {/* TEXT */}
      <div className="px-3 sm:px-4 pb-3 border-b border-[#E5E7EB]">
        <p className="text-neutral-800 text-sm leading-relaxed whitespace-pre-line">
          {text}
        </p>
      </div>

      {/* IMAGE SECTION – full width, no padding with carousel */}
      {imageList.length > 0 && (
        <div className="w-full bg-black relative">
          <div className="w-full max-h-[80vh] overflow-hidden bg-[#F3F3F3] relative">
            {/* Carousel Container */}
            <div className="relative w-full h-full">
              {imageList.map((img, index) => (
                <div
                  key={index}
                  className={`transition-opacity duration-500 ${
                    index === currentImageIndex ? "opacity-100" : "opacity-0 absolute inset-0"
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

              {/* Navigation Arrows - Only show if multiple images */}
              {hasMultipleImages && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all duration-200 hover:scale-110 z-10"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all duration-200 hover:scale-110 z-10"
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
      <div className="flex justify-between items-center py-2 text-neutral-600 border-t border-[#E5E7EB] px-3 sm:px-4">
        <div className="flex w-full justify-between">

          <button
            aria-label="Like"
            onClick={() => setLiked(!liked)}
            className={`flex items-center justify-center flex-1 p-2 rounded-md transition-all duration-300 ${
              liked
                ? "text-[var(--color-accent)] scale-110"
                : "hover:text-neutral-800 hover:scale-105"
            } active:scale-95`}
          >
            <img
              src="/svgs/like.svg"
              alt="Like"
              className={`h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${
                liked ? "scale-125 rotate-12" : ""
              }`}
            />
          </button>

          <button
            aria-label="Comment"
            onClick={() => setCommented(!commented)}
            className={`flex items-center justify-center flex-1 p-2 rounded-md transition-all duration-300 ${
              commented
                ? "text-[var(--color-accent)] scale-110"
                : "hover:text-neutral-800 hover:scale-105"
            } active:scale-95`}
          >
            <img
              src="/svgs/comment.svg"
              alt="Comment"
              className={`h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${
                commented ? "scale-125" : ""
              }`}
            />
          </button>

          <button
            aria-label="Repost"
            onClick={() => setReposted(!reposted)}
            className={`flex items-center justify-center flex-1 p-2 rounded-md transition-all duration-300 ${
              reposted
                ? "text-[var(--color-accent)] scale-110"
                : "hover:text-neutral-800 hover:scale-105"
            } active:scale-95`}
          >
            <img
              src="/svgs/repost.svg"
              alt="Repost"
              className={`h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${
                reposted ? "scale-125 rotate-180" : ""
              }`}
            />
          </button>

          <button
            aria-label="Download"
            onClick={() => {
              setDownloaded(true);
              setTimeout(() => setDownloaded(false), 600);
            }}
            className={`flex items-center justify-center flex-1 p-2 rounded-md transition-all duration-300 ${
              downloaded
                ? "text-[var(--color-accent)] scale-110"
                : "hover:text-neutral-800 hover:scale-105"
            } active:scale-95`}
          >
            <img
              src="/svgs/download.svg"
              alt="Download"
              className={`h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${
                downloaded ? "scale-125 translate-y-1" : ""
              }`}
            />
          </button>

        </div>
      </div>
    </article>
  );
};

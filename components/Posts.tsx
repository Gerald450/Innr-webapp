// app/components/Post.tsx
import React from "react";

interface PostProps {
  name: string;
  gradYear?: string;
  avatar?: string;
  text: string;
  time?: string;
  image?: string;
}

export const Post: React.FC<PostProps> = ({
  name,
  gradYear,
  avatar,
  text,
  time = "2w",
  image,
}) => {
  return (
    <article className="w-full px-4 sm:px-5 max-w-2xl md:max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-neutral-200 mb-6">
      {/* TOP ROW */}
      <header className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5">
        <img
          src={avatar || "/images/avatar_placeholder.png"}
          className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover bg-gray-300 flex-shrink-0"
          alt={`${name} avatar`}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-semibold text-neutral-900 text-sm sm:text-base leading-none truncate flex items-center gap-2">
                <span className="truncate">{name}</span>
                {gradYear && (
                  <span className="flex items-center gap-1 text-neutral-500 text-xs sm:text-sm shrink-0">
                    <img
                      src="/svgs/graduate.svg"
                      alt="Graduate cap"
                      className="h-3.5 w-3.5 sm:h-4 sm:w-4 object-contain"
                    />
                    <span className="leading-none">{gradYear}</span>
                  </span>
                )}
              </p>
            </div>

            <span className="text-sm text-neutral-500 ml-2 shrink-0">
              {time}
            </span>
          </div>

          {/* optional subtitle row if you want more info later */}
        </div>
      </header>

      {/* TEXT */}
      <div className="px-0 sm:px-0 pb-4 sm:pb-4">
        <div className="px-0 sm:px-0">
          <p className="text-neutral-800 text-sm sm:text-[15px] leading-relaxed whitespace-pre-line px-0 sm:px-0">
            {text}
          </p>
        </div>
      </div>

      {/* IMAGE / MEDIA - contained in same horizontal padding */}
      <div className="px-0 sm:px-0 pb-4">
        <div className="px-0 sm:px-0">
          {image ? (
            <div className="px-0 sm:px-0">
              <img
                src={image}
                alt="Post Media"
                className="w-full rounded-md object-cover max-h-[320px] sm:max-h-[420px] md:max-h-[550px]"
                style={{ display: "block" }}
              />
            </div>
          ) : (
            <div className="h-[220px] sm:h-[320px] md:h-[420px] w-full bg-neutral-200 rounded-md" />
          )}
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="flex justify-between items-center py-3 text-neutral-600">
        {/* LEFT ICON ROW */}
        <div className="flex flex-1 items-center px-2 sm:px-4">
          <div className="flex w-full justify-between">
            <button
              aria-label="Like"
              className="flex items-center justify-center flex-1 p-2 rounded-md hover:text-neutral-800 transition"
            >
              <img
                src="/svgs/like.svg"
                alt="Like"
                className="h-5 w-5 sm:h-6 sm:w-6"
              />
            </button>

            <button
              aria-label="Comment"
              className="flex items-center justify-center flex-1 p-2 rounded-md hover:text-neutral-800 transition"
            >
              <img
                src="/svgs/comment.svg"
                alt="Comment"
                className="h-5 w-5 sm:h-6 sm:w-6"
              />
            </button>

            <button
              aria-label="Repost"
              className="flex items-center justify-center flex-1 p-2 rounded-md hover:text-neutral-800 transition"
            >
              <img
                src="/svgs/repost.svg"
                alt="Repost"
                className="h-5 w-5 sm:h-6 sm:w-6"
              />
            </button>

            <button
              aria-label="Download"
              className="flex items-center justify-center flex-1 p-2 rounded-md hover:text-neutral-800 transition"
            >
              <img
                src="/svgs/download.svg"
                alt="Download"
                className="h-5 w-5 sm:h-6 sm:w-6"
              />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

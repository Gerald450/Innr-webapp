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
   <article className="w-full px-3 sm:px-4 max-w-xl md:max-w-2xl mx-auto bg-white rounded-lg shadow-sm border border-neutral-200 mb-5">
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
              <p className="font-semibold text-neutral-900 text-sm sm:text-sm leading-none truncate flex items-center gap-1">
                <span className="truncate">{name}</span>
                {gradYear && (
                  <span className="flex items-center gap-1 text-neutral-500 text-xs sm:text-xs shrink-0">
                    <img
                      src="/svgs/graduate.svg"
                      alt="Graduate cap"
                      className="h-3 w-3 sm:h-3 sm:w-3 object-contain"
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
      <div className="px-2 sm:px-3 pb-3 sm:pb-4">
        <p className="text-neutral-800 text-sm sm:text-sm leading-relaxed whitespace-pre-line">
          {text}
        </p>
      </div>

      {/* IMAGE / MEDIA */}
      <div className="px-2 sm:px-3 pb-3">
        {image ? (
          <img
            src={image}
            alt="Post Media"
            className="w-full rounded-md object-cover max-h-[250px] sm:max-h-[350px] md:max-h-[450px]"
            style={{ display: "block" }}
          />
        ) : (
          <div className="h-[180px] sm:h-[250px] md:h-[350px] w-full bg-neutral-200 rounded-md" />
        )}
      </div>

      {/* ACTION BAR */}
      <div className="flex justify-between items-center py-2 text-neutral-600">
        <div className="flex flex-1 items-center px-2 sm:px-3">
          <div className="flex w-full justify-between">
            <button
              aria-label="Like"
              className="flex items-center justify-center flex-1 p-2 rounded-md hover:text-neutral-800 transition"
            >
              <img
                src="/svgs/like.svg"
                alt="Like"
                className="h-4 w-4 sm:h-5 sm:w-5"
              />
            </button>

            <button
              aria-label="Comment"
              className="flex items-center justify-center flex-1 p-2 rounded-md hover:text-neutral-800 transition"
            >
              <img
                src="/svgs/comment.svg"
                alt="Comment"
                className="h-4 w-4 sm:h-5 sm:w-5"
              />
            </button>

            <button
              aria-label="Repost"
              className="flex items-center justify-center flex-1 p-2 rounded-md hover:text-neutral-800 transition"
            >
              <img
                src="/svgs/repost.svg"
                alt="Repost"
                className="h-4 w-4 sm:h-5 sm:w-5"
              />
            </button>

            <button
              aria-label="Download"
              className="flex items-center justify-center flex-1 p-2 rounded-md hover:text-neutral-800 transition"
            >
              <img
                src="/svgs/download.svg"
                alt="Download"
                className="h-4 w-4 sm:h-5 sm:w-5"
              />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

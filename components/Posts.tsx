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
    <div className="w-full px-4 max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-neutral-200 mb-6">
      {/* TOP ROW */}
      <div className="flex items-center gap-4 p-5">
        <img
          src={avatar || "/images/avatar_placeholder.png"}
          className="h-12 w-12 rounded-full object-cover bg-gray-300"
          alt="Avatar"
        />

        <div className="flex justify-between items-start w-full">
          <p className="font-semibold text-neutral-900 text-base leading-none flex items-center gap-1">
            {name}
            {gradYear && (
              <span className="flex items-center gap-1 text-neutral-500 text-sm">
                <img
                  src="/svgs/graduate.svg"
                  alt="Graduate cap"
                  className="h-4 w-4 object-contain"
                />
                {gradYear}
              </span>
            )}
          </p>

          <span className="text-sm text-neutral-500">{time}</span>
        </div>
      </div>

      {/* TEXT */}
      <div className="px-5 pb-4">
        <p className="text-neutral-800 text-[15px] leading-relaxed whitespace-pre-line">
          {text}
        </p>
      </div>

      {/* IMAGE / MEDIA */}
   
        {image ? (
          <img
            src={image}
            className="w-full max-h-[550px] object-cover"
            alt="Post Media"
          />
        ) : (
          <div className="h-[420px] w-full bg-neutral-200 rounded-md" />
        )}
     

      {/* ACTION BAR */}
      <div className="flex justify-around items-center py-4 text-neutral-600 text-2xl">
        <button className="hover:text-neutral-800 transition">
          <img
            src="/svgs/like.svg"
            alt="Like"
            className="h-6 w-6 object-contain"
          />
        </button>
        <button className="hover:text-neutral-800 transition">
          <img
            src="/svgs/comment.svg"
            alt="Comment"
            className="h-6 w-6 object-contain"
          />
        </button>
        <button className="hover:text-neutral-800 transition">
          <img
            src="/svgs/repost.svg"
            alt="Repost"
            className="h-6 w-6 object-contain"
          />
        </button>
        <button className="hover:text-neutral-800 transition">
          <img
            src="/svgs/download.svg"
            alt="download"
            className="h-6 w-6 object-contain"
          />
        </button>
      </div>
    </div>
  );
};

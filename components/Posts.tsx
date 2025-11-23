// app/components/Post.tsx
import React from "react";

interface PostProps {
  name: string;
  avatar?: string;
  text: string;
  time?: string;
  image?: string;
}

export const Post: React.FC<PostProps> = ({
  name,
  avatar,
  text,
  time = "2w",
  image,
}) => {
  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-neutral-200 mb-4">
      
      {/* TOP ROW */}
      <div className="flex items-center gap-3 p-4">
        <img
          src={avatar || "images/avatar_placeholder.png"}
          className="h-10 w-10 rounded-full object-cover bg-gray-300"
          alt="Avatar"
        />

        <div className="flex-1">
          <p className="font-medium text-neutral-900 leading-none">{name}</p>
          <span className="text-sm text-neutral-500">{time}</span>
        </div>
      </div>

      {/* TEXT */}
      <div className="px-4 pb-3">
        <p className="text-neutral-800 text-sm leading-relaxed">{text}</p>
      </div>

      {/* IMAGE / MEDIA */}
      <div className="w-full bg-neutral-300">
        {image ? (
          <img src={image} className="w-full object-cover" alt="Post Media" />
        ) : (
          <div className="h-72 w-full bg-neutral-300" />
        )}
      </div>

      {/* ACTION BAR */}
      <div className="flex justify-around items-center py-3 text-neutral-500 text-xl">
        <button className="hover:text-neutral-700 transition">❤️</button>
        <button className="hover:text-neutral-700 transition">💬</button>
        <button className="hover:text-neutral-700 transition">↻</button>
        <button className="hover:text-neutral-700 transition">📤</button>
      </div>
    </div>
  );
};

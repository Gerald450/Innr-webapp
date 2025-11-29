"use client";
import { useEffect, useRef, useState } from "react";
import { Post } from "../components/Posts";
import { MakePost } from "@/components/MakePost";
import CreatePostModal from "@/components/CreatePostModal";
import { postsData } from "../data/postsData";

type PostItem = {
  id: number;
  name: string;
  text: string;
  time: string;
  gradYear: string;
  image: string;
};

export default function Home() {
  const postRef = useRef<HTMLDivElement | null>(null);
  const [showBubble, setShowBubble] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Initialize posts from postsData, map to include an id if missing
  const [posts, setPosts] = useState<PostItem[]>(
    () =>
      postsData.map((p, i) => ({
        id: typeof (p as any).id === "number" ? (p as any).id : Date.now() + i,
        name: p.name,
        text: p.text,
        time: p.time,
        gradYear: p.gradYear,
        image: p.image,
      })) as PostItem[]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowBubble(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    const el = postRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
      observer.disconnect();
    };
  }, []);

  const openCreatePost = () => setShowModal(true);

  const handleCreatePost = (newPost: Omit<PostItem, "id"> | PostItem) => {
    const postWithId: PostItem = {
      id:
        typeof (newPost as any).id === "number"
          ? (newPost as any).id
          : Date.now(),
      name: (newPost as any).name,
      text: (newPost as any).text,
      time: (newPost as any).time ?? "just now",
      gradYear: (newPost as any).gradYear,
      image: (newPost as any).image ?? "",
    };

    setPosts((prev) => [postWithId, ...prev]);
  };

  return (
    <div className="bg-[#F2F4F7] min-h-screen py-10 flex flex-col items-center gap-6">
      {/* MakePost with ref observed by IntersectionObserver */}
      <div ref={postRef} className="w-full flex justify-center">
        <MakePost
          avatarUrl="/images/avatar_placeholder.png"
          onStartPost={openCreatePost}
          onVideoClick={() => console.log("open video upload")}
          onPhotoClick={() => console.log("open photo upload")}
          onArticleClick={() => console.log("open write-article editor")}
        />
      </div>

      {/* Posts list */}
      <div className="w-full max-w-2xl flex flex-col gap-6">
        {posts.map((p) => (
          <Post
            key={p.id}
            name={p.name}
            text={p.text}
            time={p.time}
            gradYear={p.gradYear}
            image={p.image}
          />
        ))}
      </div>

      {/* Floating circular bubble (appears only when MakePost is out of view) */}
      {showBubble && (
        <button
          onClick={openCreatePost}
          aria-label="Start a post"
          className="
      fixed
      bottom-20 right-[350px]        /* default: for large screens, bubble sits near posts */
      max-[1625px]:bottom-20          /* when screen < 1625px, move to bottom-right */
      max-[1625px]:right-5
      z-50
      flex h-20 w-20 items-center justify-center
      rounded-full bg-blue-600 text-white shadow-xl
      hover:scale-105 active:scale-95 transition-transform
    "
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      )}

      {/* Create post modal */}
      {showModal && (
        <CreatePostModal
          initialName=""
          initialGradYear=""
          onClose={() => setShowModal(false)}
          onSubmit={(post) => {
            handleCreatePost(post);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

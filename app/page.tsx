"use client";
import { useEffect, useRef, useState } from "react";
import { Post } from "../components/Posts";
import { MakePost } from "@/components/MakePost";

export default function Home() {
  const postRef = useRef<HTMLDivElement | null>(null);
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowBubble(!entry.isIntersecting); // show bubble when MakePost is not visible
      },
      { threshold: 0.1 }
    );

    if (postRef.current) observer.observe(postRef.current);

    return () => {
      if (postRef.current) observer.unobserve(postRef.current);
    };
  }, []);

  const handleStartPost = () => {
    console.log("open create-post modal");
  };

  return (
    <div className="bg-[#F2F4F7]">
      <div
        ref={postRef}
        className="flex justify-center items-start pt-10 pb-10"
      >
        <MakePost
          avatarUrl="/images/avatar_placeholder.png"
          onStartPost={handleStartPost}
          onVideoClick={() => console.log("open video upload")}
          onPhotoClick={() => console.log("open photo upload")}
          onArticleClick={() => console.log("open write-article editor")}
        />
      </div>

      <Post
        name="Gerald Shimo"
        text="Come enjoy soccer with us every Friday at 4pm at the campus field. We run friendly matches, meet new people, and have fun on the field. All skill levels welcome!"
        time="2w"
        gradYear="27"
        image="images/bros_in_street.jpeg"
      />

      <Post
        name="Aaliyah Carter"
        text="The campus hackathon kicks off this weekend! Join us to build creative projects, network with peers, and win prizes."
        time="2h"
        gradYear="26"
        image="images/hakathon.jpeg"
      />

      <Post
        name="Marcus Lee"
        text="Don’t miss the 10k charity run on Saturday morning! Proceeds go to local scholarships, and refreshments will be provided."
        time="6h"
        gradYear="27"
        image="images/Volunteering.jpeg"
      />

      <Post
        name="Sofia Nguyen"
        text="Campus volunteering day at the community garden is happening tomorrow! Help plant, clean, and beautify our green spaces."
        time="1d"
        gradYear="28"
        image="images/scarecrow.jpeg"
      />

      <Post
        name="David Kim"
        text="Student soccer tournament finals are on Friday! Come cheer for your favorite teams and enjoy snacks and music."
        time="2d"
        gradYear="27"
        image="images/football.jpeg"
      />

      <Post
        name="Lila Thompson"
        text="Coffee and Conversation event at the student center today! Meet new people, enjoy free coffee, and discuss campus life."
        time="3d"
        gradYear="26"
        image="images/meet.jpeg"
      />

      {/* Floating "Start a Post" bubble */}
      {showBubble && (
        <button
          onClick={handleStartPost}
          className="fixed bottom-10 right-5 z-50 rounded-full bg-blue-600 text-white px-5 py-3 shadow-lg hover:bg-blue-700 transition"
        >
          Post
        </button>
      )}
    </div>
  );
}

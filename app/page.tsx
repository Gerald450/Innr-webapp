"use client";
import { Post } from "../components/Posts";
import { MakePost } from "@/components/MakePost";

export default function Home() {
  return (
    <div className="pt-10">
      <div className="flex justify-center items-start pb-10 bg-[#F2F4F7]">
        <MakePost
          avatarUrl="/images/avatar_placeholder.png"
          onStartPost={() => console.log("open create-post modal")}
          onVideoClick={() => console.log("open video upload")}
          onPhotoClick={() => console.log("open photo upload")}
          onArticleClick={() => console.log("open write-article editor")}
        />
      </div>

      <Post
        name="Gerald Shimo"
        text="Come enjoy soccer with us every Friday at 4pm. We run friendly matches, meet new people, and just have a good time on the field. Whether you play competitively or just want to get some exercise, you’re welcome to join. Bring your friends and let’s make it a fun weekly routine."
        time="2w"
        gradYear="27"
        image="images/bros_in_street.jpeg"
      />
      <Post
        name="Gerald Shimo"
        text="Come enjoy soccer with us every Friday at 4pm. We run friendly matches, meet new people, and just have a good time on the field. Whether you play competitively or just want to get some exercise, you’re welcome to join. Bring your friends and let’s make it a fun weekly routine."
        time="2w"
        gradYear="27"
        image="images/bros_in_street.jpeg"
      />
    </div>
  );
}

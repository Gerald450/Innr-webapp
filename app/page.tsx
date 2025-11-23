import { Post } from "../components/Posts";

export default function Home() {
  return (
    <div className="pt-20">
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

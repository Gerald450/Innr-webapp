import { Post } from "../components/Posts";

export default function Home() {
  return (
    <div className="pt-20">
      <Post
        name="Gerald Shimo"
        text="This is the text that the post will have, it is a pretty neat gimmick isn't it?"
        time="2w"
        gradYear="27"
      />
    </div>
  );
}

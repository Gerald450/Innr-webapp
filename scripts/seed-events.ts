/**
 * Seed 20 events with consecutive dates, same image and location.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY so RLS doesn't block (or the script will
 * use the first profile with university_id when using service role).
 *
 * Run from my-app: npm run seed:events
 * Loads .env.local automatically.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env.local if present
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  content.split("\n").forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

const key = serviceRoleKey || anonKey;
if (!key) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, key, {
  auth: { persistSession: false },
});

const SAME_IMAGE_URL = "/images/logo.png";
const SAME_LOCATION = {
  location_name: "Main Campus Hall",
  location_address: "123 University Ave",
};

const EVENT_COUNT = 20;

function getConsecutiveStartEnd(dayOffset: number): { starts_at: string; ends_at: string } {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(18, 0, 0, 0);
  const starts_at = d.toISOString();
  d.setHours(20, 0, 0, 0);
  const ends_at = d.toISOString();
  return { starts_at, ends_at };
}

async function main() {
  // Resolve author and university (use first profile with university_id when using service role)
  let authorId = process.env.AUTHOR_ID;
  let universityId = process.env.UNIVERSITY_ID;

  if (!authorId || !universityId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, university_id")
      .not("university_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (profileError || !profile?.university_id) {
      console.error("Could not get a profile with university_id. Set AUTHOR_ID and UNIVERSITY_ID in env, or run with SUPABASE_SERVICE_ROLE_KEY.");
      process.exit(1);
    }
    authorId = authorId ?? profile.id;
    universityId = universityId ?? profile.university_id;
  }

  // Build posts array
  const posts = Array.from({ length: EVENT_COUNT }, (_, i) => ({
    author_id: authorId,
    university_id: universityId,
    post_type: "event" as const,
    title: `Seed Event ${i + 1}`,
    body: `Event on day ${i + 1}. Same image and location.`,
    visibility: "public" as const,
  }));

  const { data: insertedPosts, error: postsError } = await supabase
    .from("posts")
    .insert(posts)
    .select("id");

  if (postsError || !insertedPosts?.length) {
    console.error("Posts insert failed:", postsError);
    process.exit(1);
  }

  // Build post_media and events arrays from post ids
  const postMedia = insertedPosts.map((p, i) => ({
    post_id: p.id,
    media_type: "image" as const,
    storage_path: `seed/event-${i + 1}.png`,
    url: SAME_IMAGE_URL,
    order_index: 0,
  }));

  const events = insertedPosts.map((p, i) => {
    const { starts_at, ends_at } = getConsecutiveStartEnd(i + 1);
    return {
      post_id: p.id,
      starts_at,
      ends_at,
      ...SAME_LOCATION,
    };
  });

  const [mediaResult, eventsResult] = await Promise.all([
    supabase.from("post_media").insert(postMedia).select("id"),
    supabase.from("events").insert(events).select("id"),
  ]);

  if (mediaResult.error) {
    console.error("post_media insert failed:", mediaResult.error);
    process.exit(1);
  }
  if (eventsResult.error) {
    console.error("events insert failed:", eventsResult.error);
    process.exit(1);
  }

  console.log(`Inserted ${insertedPosts.length} posts, ${postMedia.length} post_media, ${events.length} events.`);
}

main();

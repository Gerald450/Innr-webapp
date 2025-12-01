// app/api/signed-upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // throw on startup to fail fast in dev if env is missing
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable");
  throw new Error("Missing Supabase server env variables");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * POST body:
 * { bucket: string, name: string, contentType: string }
 *
 * Response:
 * { uploadUrl: string, path: string, token?: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bucket, name, contentType } = body ?? {};

    if (!bucket || !name || !contentType) {
      return NextResponse.json({ error: "Missing params (bucket, name, contentType)" }, { status: 400 });
    }

    // Quick bucket existence diagnostic (gives clearer error than createSignedUploadUrl 404)
    const { error: listErr } = await supabaseAdmin.storage
      .from(bucket)
      .list("", { limit: 1 })
      .catch((e) => ({ error: e }));

    if (listErr) {
      console.error("Bucket list error:", listErr);
      return NextResponse.json({
        error: `Bucket "${bucket}" not found or inaccessible. Ensure the bucket exists and the service role key is valid.`,
        detail: listErr.message ?? listErr,
      }, { status: 404 });
    }

    // Create signed upload URL (new SDK signature uses options, upsert boolean)
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(name, { upsert: false });

    if (error || !data) {
      console.error("createSignedUploadUrl error:", error);
      return NextResponse.json({ error: error?.message ?? "createSignedUploadUrl failed" }, { status: 500 });
    }

    // data: { signedUrl, token, path }
    return NextResponse.json({
      uploadUrl: data.signedUrl,
      path: data.path,
      token: data.token,
    });
  } catch (err: any) {
    console.error("signed-upload unexpected error:", err);
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}

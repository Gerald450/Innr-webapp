// app/signin/page.tsx
import { Suspense } from "react";
import AuthPageSupabase from "./authPage";

export default function SignInPage() {
  return (
    <main>
      <h1 className="sr-only">Sign in</h1>

      {/* Keep the Suspense boundary as small as possible */}
      <Suspense fallback={<div aria-busy>Loading sign-in…</div>}>
        <AuthPageSupabase />
      </Suspense>

      {/* Static content (optional) can live here if you want */}
    </main>
  );
}

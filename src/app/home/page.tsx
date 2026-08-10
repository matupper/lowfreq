import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    redirect("/login");
  }

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-10">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs text-kraft">signed in</span>
        <form action={signOut}>
          <button className="font-mono text-xs text-kraft border border-line rounded-full px-3 py-1.5 hover:border-kraft transition-colors">
            log out
          </button>
        </form>
      </div>

      <div className="space-y-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          YOU&apos;RE IN.
        </h1>
        <p className="text-sm text-kraft leading-relaxed max-w-xs pt-4">
          {claims.email} — founder account. Event browse and invite
          creation are next.
        </p>
      </div>
    </main>
  );
}

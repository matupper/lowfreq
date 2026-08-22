import { redirect } from "next/navigation";
import Link from "next/link";
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
          {claims.email} — founder account. Invite creation is next.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <Link
          href="/events"
          className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium text-center"
        >
          Browse shows
        </Link>
        <Link
          href="/profile"
          className="text-kraft font-mono text-xs py-1.5 text-center"
        >
          Profile &amp; invites
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { approveEvent, rejectEvent } from "./actions";

type PendingEventRow = {
  event_id: string;
  title: string;
  venue_name: string;
  host_name: string;
  created_at: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// Plain table, not a designed screen (per docs/designdoc.md §4.12a) — this
// is reached by direct URL only, with no BottomNav entry. Track B adds a
// second section (venue claims) to this same page later; see CLAUDE.md's
// note on reconciling a merge conflict here by keeping both sections.
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // proxy.ts's /admin entry only redirects signed-out visitors — this is
  // the actual gate. The real security boundary is the RPCs' own internal
  // is_admin check (db/schema.sql), not this redirect.
  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) redirect("/home");

  const { data: pendingEvents } = await supabase.rpc("list_pending_events");
  const rows = (pendingEvents ?? []) as PendingEventRow[];

  return (
    <main className="max-w-3xl mx-auto w-full px-6 pt-10 pb-20">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl leading-none tracking-wide">
          ADMIN
        </h1>
        <Link href="/home" className="font-mono text-xs text-kraft">
          &larr; home
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] text-kraft uppercase tracking-wide">
          pending events ({rows.length})
        </h2>

        {rows.length === 0 ? (
          <p className="text-sm text-kraft">Nothing waiting on review.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="font-mono text-[10px] text-kraft uppercase tracking-wide py-2 pr-3">
                  title
                </th>
                <th className="font-mono text-[10px] text-kraft uppercase tracking-wide py-2 pr-3">
                  venue
                </th>
                <th className="font-mono text-[10px] text-kraft uppercase tracking-wide py-2 pr-3">
                  host
                </th>
                <th className="font-mono text-[10px] text-kraft uppercase tracking-wide py-2 pr-3">
                  submitted
                </th>
                <th className="font-mono text-[10px] text-kraft uppercase tracking-wide py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.event_id} className="border-b border-line last:border-none">
                  <td className="py-3 pr-3">{row.title}</td>
                  <td className="py-3 pr-3 text-kraft">{row.venue_name}</td>
                  <td className="py-3 pr-3 text-kraft">{row.host_name}</td>
                  <td className="py-3 pr-3 font-mono text-[11px] text-kraft">
                    {dateFormatter.format(new Date(row.created_at))}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <form action={approveEvent.bind(null, row.event_id)}>
                        <button
                          type="submit"
                          className="font-mono text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 border border-riso-pink text-riso-pink hover:bg-riso-pink/10 transition-colors"
                        >
                          approve
                        </button>
                      </form>
                      <form action={rejectEvent.bind(null, row.event_id)}>
                        <button
                          type="submit"
                          className="font-mono text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 border border-line text-kraft hover:border-kraft transition-colors"
                        >
                          reject
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

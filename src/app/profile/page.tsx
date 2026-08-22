import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatInviteToken } from "@/lib/invites";
import ThemeToggle from "@/components/ThemeToggle";
import { signOut } from "@/app/home/actions";
import { createInvite } from "./actions";

const SCENE_TIMEZONE = "America/Los_Angeles";
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SCENE_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});

type InviteTreeRow = {
  invite_id: string;
  token: string;
  status: string;
  created_at: string;
  invitee_id: string | null;
  invitee_name: string | null;
  invitee_joined_at: string | null;
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [rsvpsResult, treeResult] = await Promise.all([
    supabase
      .from("rsvps")
      .select("status, event:events(id, title, start_time)")
      .eq("user_id", user.id),
    supabase.rpc("get_invite_tree"),
  ]);

  const rsvps = rsvpsResult.data ?? [];
  const going = rsvps.filter((r) => r.status === "going");
  const saved = rsvps.filter((r) => r.status === "saved");
  const tree = (treeResult.data ?? []) as InviteTreeRow[];

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-10">
      <div className="flex justify-between items-center">
        <Link href="/home" className="font-mono text-xs text-kraft">
          &larr; home
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <form action={signOut}>
            <button className="font-mono text-xs text-kraft border border-line rounded-full px-3 py-1.5 hover:border-kraft transition-colors">
              log out
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          PROFILE
        </h1>
        <p className="text-sm text-kraft leading-relaxed pt-1">{user.email}</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] text-kraft uppercase tracking-wide">
          your shows
        </h2>
        {going.length === 0 && saved.length === 0 ? (
          <p className="text-sm text-kraft">
            No RSVPs yet.{" "}
            <Link href="/events" className="underline underline-offset-2">
              browse shows
            </Link>
            .
          </p>
        ) : (
          <ShowList going={going} saved={saved} />
        )}
      </section>

      <section className="space-y-3 border-t border-dashed border-line pt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[11px] text-kraft uppercase tracking-wide">
            invites
          </h2>
        </div>
        <form action={createInvite}>
          <button
            type="submit"
            className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium w-full"
          >
            Stamp a new invite
          </button>
        </form>

        {tree.length > 0 && (
          <ul className="flex flex-col gap-2 pt-2">
            {tree.map((row) => (
              <li
                key={row.invite_id}
                className="flex items-center justify-between border-b border-line py-2 last:border-none"
              >
                <span className="font-mono text-xs text-kraft">
                  {formatInviteToken(row.token)}
                </span>
                {row.invitee_name ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-kraft border border-riso-pink rounded-full px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-riso-pink" />
                    {row.invitee_name} joined
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-kraft">
                    not redeemed yet
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ShowList({
  going,
  saved,
}: {
  going: { status: string; event: EventStub | EventStub[] | null }[];
  saved: { status: string; event: EventStub | EventStub[] | null }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {going.length > 0 && (
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] text-kraft uppercase tracking-wide">
            going
          </p>
          {going.map((r) => (
            <EventRow key={eventOf(r.event)?.id} event={eventOf(r.event)} />
          ))}
        </div>
      )}
      {saved.length > 0 && (
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] text-kraft uppercase tracking-wide">
            saved
          </p>
          {saved.map((r) => (
            <EventRow key={eventOf(r.event)?.id} event={eventOf(r.event)} />
          ))}
        </div>
      )}
    </div>
  );
}

type EventStub = { id: string; title: string; start_time: string };

function eventOf(event: EventStub | EventStub[] | null): EventStub | null {
  if (!event) return null;
  return Array.isArray(event) ? (event[0] ?? null) : event;
}

function EventRow({ event }: { event: EventStub | null }) {
  if (!event) return null;
  return (
    <Link
      href="/events"
      className="flex items-center justify-between text-sm py-1"
    >
      <span>{event.title}</span>
      <span className="font-mono text-[11px] text-kraft">
        {timeFormatter.format(new Date(event.start_time)).toLowerCase()}
      </span>
    </Link>
  );
}

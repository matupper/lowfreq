import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import GenerateInviteButton from "@/components/GenerateInviteButton";
import { signOut } from "@/app/home/actions";
import { InvitedByCard, InviteeList, type Inviter, type InviteTreeRow } from "./InviteFriends";

const SCENE_TIMEZONE = "America/Los_Angeles";
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SCENE_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [rsvpsResult, treeResult, inviterResult] = await Promise.all([
    supabase
      .from("rsvps")
      .select("going, saved, event:events(id, title, start_time)")
      .eq("user_id", user.id),
    supabase.rpc("get_invite_tree"),
    supabase.rpc("get_my_inviter"),
  ]);

  const rsvps = rsvpsResult.data ?? [];
  const going = rsvps.filter((r) => r.going);
  const saved = rsvps.filter((r) => r.saved);
  const tree = (treeResult.data ?? []) as InviteTreeRow[];
  const inviter = (((inviterResult.data ?? []) as Inviter[])[0]) ?? null;

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
        <h2 className="font-mono text-[11px] text-kraft uppercase tracking-wide">
          friends
        </h2>

        <InvitedByCard inviter={inviter} />

        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-[11px] text-kraft uppercase tracking-wide">
              who you&rsquo;ve invited
            </h3>
          </div>
          <GenerateInviteButton />
          <InviteeList tree={tree} />
        </div>
      </section>
    </main>
  );
}

function ShowList({
  going,
  saved,
}: {
  going: { event: EventStub | EventStub[] | null }[];
  saved: { event: EventStub | EventStub[] | null }[];
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

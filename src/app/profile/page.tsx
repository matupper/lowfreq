import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import BottomNav from "@/components/BottomNav";
import GenerateInviteButton from "@/components/GenerateInviteButton";
import { signOut } from "@/app/home/actions";
import { InvitedByCard, InviteeList, type Inviter, type InviteTreeRow } from "./InviteFriends";
import { buildMusicPillGroups } from "@/lib/profile-fields";

type ProfileFieldsRow = {
  bio: string | null;
  instruments: string[];
  favorite_artists: string[];
  favorite_albums: string[];
  favorite_songs: string[];
} | null;

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

  const [
    rsvpsResult,
    treeResult,
    inviterResult,
    identityResult,
    profileFieldsResult,
    ownedVenueResult,
  ] = await Promise.all([
    supabase
      .from("rsvps")
      .select("going, saved, event:events(id, title, start_time)")
      .eq("user_id", user.id),
    supabase.rpc("get_invite_tree"),
    supabase.rpc("get_my_inviter"),
    supabase.from("users").select("handle, avatar_url").eq("id", user.id).single(),
    supabase
      .from("user_profiles")
      .select("bio, instruments, favorite_artists, favorite_albums, favorite_songs")
      .eq("user_id", user.id)
      .maybeSingle(),
    // Only used to decide which of "claim a venue"/"manage your venue" to
    // show below — a venue owner has already been through the claim flow.
    supabase.from("venues").select("id").eq("owner_id", user.id).limit(1),
  ]);

  const rsvps = rsvpsResult.data ?? [];
  const going = rsvps.filter((r) => r.going);
  const saved = rsvps.filter((r) => r.saved);
  const tree = (treeResult.data ?? []) as InviteTreeRow[];
  const ownsVenue = (ownedVenueResult.data ?? []).length > 0;
  if (inviterResult.error) {
    throw new Error(
      `Failed to load inviter: ${inviterResult.error.message}`,
    );
  }
  const inviter = (((inviterResult.data ?? []) as Inviter[])[0]) ?? null;
  const identity = identityResult.data;
  const profileFields = profileFieldsResult.data as ProfileFieldsRow;
  const musicPillGroups = buildMusicPillGroups(profileFields);

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 pt-10 pb-28 gap-10">
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
        </div>

        <section className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full bg-surface-2 border border-line bg-cover bg-center shrink-0"
            style={identity?.avatar_url ? { backgroundImage: `url(${identity.avatar_url})` } : undefined}
          />
          <div className="space-y-0.5 min-w-0">
            {identity?.handle ? (
              <p className="text-sm font-medium truncate">@{identity.handle}</p>
            ) : (
              <p className="text-sm text-kraft italic">no handle yet</p>
            )}
            <p className="text-xs text-kraft truncate">{user.email}</p>
            <Link
              href="/profile/edit"
              className="font-mono text-[11px] text-riso-pink underline underline-offset-2"
            >
              edit profile
            </Link>
          </div>
        </section>

        {profileFields?.bio && (
          <p className="text-sm text-ink leading-relaxed">{profileFields.bio}</p>
        )}

        {musicPillGroups.length > 0 && (
          <section className="space-y-3">
            {musicPillGroups.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <h2 className="font-mono text-[10px] text-kraft uppercase tracking-wide">
                  {group.label}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="font-mono text-[11px] text-kraft border border-line rounded-full px-2.5 py-1"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="font-mono text-[11px] text-kraft uppercase tracking-wide">
            your shows
          </h2>
          {going.length === 0 && saved.length === 0 ? (
            <p className="text-sm text-kraft">
              No RSVPs yet.{" "}
              <Link href="/home" className="underline underline-offset-2">
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

        <div className="pt-2">
          {ownsVenue ? (
            <Link
              href="/venues/mine"
              className="font-mono text-[11px] text-kraft underline underline-offset-2"
            >
              manage your venue
            </Link>
          ) : (
            <Link
              href="/venues/claim"
              className="font-mono text-[11px] text-kraft underline underline-offset-2"
            >
              run a venue? claim it
            </Link>
          )}
        </div>
      </main>
      <BottomNav active="profile" />
    </div>
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
      href="/home"
      className="flex items-center justify-between text-sm py-1"
    >
      <span>{event.title}</span>
      <span className="font-mono text-[11px] text-kraft">
        {timeFormatter.format(new Date(event.start_time)).toLowerCase()}
      </span>
    </Link>
  );
}

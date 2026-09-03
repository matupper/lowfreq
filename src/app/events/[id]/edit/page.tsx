import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventForm from "@/app/events/EventForm";
import { updateEvent } from "./actions";

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditEventPage({
  params,
}: PageProps<"/events/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: event }, { data: venues }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, description, start_time, venue_id, status, poster_url, host_id")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("venues").select("id, name").order("name"),
  ]);

  // Editing is only for a submission's own host, and only pre-approval —
  // matches the "hosts can edit their own unapproved events" RLS policy
  // this action relies on (db/migrations/0008_event_posters.sql).
  if (!event || event.host_id !== user.id || event.status === "approved") {
    redirect("/profile");
  }

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-8">
      <Link href="/profile" className="font-mono text-xs text-kraft">
        &larr; profile
      </Link>

      <div className="space-y-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          EDIT SUBMISSION
        </h1>
        {event.status === "rejected" && (
          <p className="text-sm text-stamp-red">
            This submission was rejected. Edit and resubmit for review.
          </p>
        )}
      </div>

      <EventForm
        action={updateEvent.bind(null, event.id)}
        venues={venues ?? []}
        defaults={{
          title: event.title,
          description: event.description ?? "",
          startTime: toDatetimeLocalValue(event.start_time),
          venueId: event.venue_id,
          posterUrl: event.poster_url,
        }}
        submitLabel="save changes"
        pendingLabel="saving…"
        cancelHref="/profile"
      />
    </main>
  );
}

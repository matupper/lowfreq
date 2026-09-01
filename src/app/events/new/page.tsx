import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventForm from "@/app/events/EventForm";
import { createEvent } from "./actions";

export default async function NewEventPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name")
    .order("name");

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-8">
      <Link href="/profile" className="font-mono text-xs text-kraft">
        &larr; profile
      </Link>

      <div className="space-y-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          SUBMIT AN EVENT
        </h1>
        <p className="text-sm text-kraft">
          Goes to admin review before it shows up on the feed.
        </p>
      </div>

      <EventForm
        action={createEvent}
        venues={venues ?? []}
        submitLabel="submit for review"
        pendingLabel="submitting…"
        cancelHref="/profile"
      />
    </main>
  );
}

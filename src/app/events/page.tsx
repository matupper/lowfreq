import { redirect } from "next/navigation";

// The Browse Shows view now lives at the landing route (see CLAUDE.md's
// "Landing page" section) — this route is kept only so existing links/
// bookmarks to /events keep working.
export default function EventsPage() {
  redirect("/home");
}
